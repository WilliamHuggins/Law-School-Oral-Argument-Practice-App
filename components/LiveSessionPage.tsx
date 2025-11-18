
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { useAppContext } from '../App';
import { Page, TranscriptEntry, Court } from '../types';
import { MicIcon, EndCallIcon } from './icons';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';
import { COURT_RULE_PRESETS, JUDGE_VOICE_NAME } from '../constants';

const API_KEY = process.env.API_KEY;

// VAD Constants
const VAD_SILENCE_THRESHOLD = 0.01;
const VAD_SILENCE_DURATION_MS = 1200;

const getCourtProfileText = (court: Court): string => {
    switch (court) {
        case 'U.S. Supreme Court':
            return `You are a Justice on the United States Supreme Court hearing oral argument. Treat this as a high-stakes case of national importance. Ask pointed questions, use hypotheticals, and focus on doctrinal coherence and the broader consequences of the rule the student proposes. You may occasionally refer to “my colleagues” or “the Court.”`;
        case 'U.S. Court of Appeals (Ninth Circuit)':
            return `You are a judge on the Ninth Circuit Court of Appeals sitting on a three-judge panel. Focus on jurisdiction, justiciability, the relevant standard of review, and how binding Ninth Circuit and Supreme Court precedent applies to the student’s position.`;
        case 'California Supreme Court':
            return `You are a justice on the California Supreme Court. Focus your questions on interpretation of California statutes and constitutional provisions, how your decision would interact with California precedent, and practical implications for state institutions and litigants.`;
        case 'U.S. District Court (Motion Hearing)':
            return `You are a United States District Court judge presiding over an oral argument on a motion (e.g., motion to dismiss or summary judgment). Focus on the factual record as presented, whether the motion should be granted or denied under the appropriate standard, and practical and procedural questions, such as jurisdiction, remedies, and what happens next in the case.`;
        case 'Generic Appellate Court':
        default:
            return `You are a judge on a three-judge appellate panel in a generic intermediate appellate court. Be professional, moderately inquisitive, and address the student as counsel.`;
    }
};

const LiveSessionPage: React.FC = () => {
  const { settings, selectedCase, setTranscript, setFeedback, setPage, setIsGeneratingReport } = useAppContext();
  const [sessionPhase, setSessionPhase] = useState<'Idle' | 'Connecting' | 'ArgumentInProgress' | 'Ended'>('Idle');
  const [sessionTranscript, setSessionTranscript] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState({ student: '', judge: '' });
  const [timeLeft, setTimeLeft] = useState(settings.timerLength > 0 ? settings.timerLength * 60 : null);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [ambientError, setAmbientError] = useState('');
  const [uiMessage, setUiMessage] = useState('Click below to begin your oral argument.');
  const [isStudentSpeaking, setIsStudentSpeaking] = useState(false);

  const sessionRef = useRef<any | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextAudioStartTime = useRef(0);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement | null>(null);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const timerStartedRef = useRef(false);
  const isExpectingCoCounselHint = useRef(false);
  
  const isStudentSpeakingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAwaitingJudgeResponseRef = useRef(false);

  const transcriptRef = useRef(sessionTranscript);
  useEffect(() => {
    transcriptRef.current = sessionTranscript;
  }, [sessionTranscript]);

  const addTranscriptEntry = useCallback((entry: Omit<TranscriptEntry, 'timestamp'>) => {
    const newEntry = { ...entry, timestamp: new Date().toISOString() };
    setSessionTranscript(prev => [...prev, newEntry]);
  }, []);

  const playAudioBuffer = useCallback((audioBuffer: AudioBuffer) => {
    if (!outputAudioContextRef.current || outputAudioContextRef.current.state === 'closed') return;
    const source = outputAudioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outputAudioContextRef.current.destination);

    const currentTime = outputAudioContextRef.current.currentTime;
    const startTime = Math.max(currentTime, nextAudioStartTime.current);
    source.start(startTime);
    nextAudioStartTime.current = startTime + audioBuffer.duration;
  }, []);
  
  const endSession = useCallback(async (finalTranscript: TranscriptEntry[]) => {
    if (sessionPhase === 'Ended') return;
    setSessionPhase('Ended');
    setUiMessage('Session ended.');
    setIsTimerActive(false);
    isAwaitingJudgeResponseRef.current = false;

    if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
    }
     if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        outputAudioContextRef.current.close();
    }
    if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        ambientAudioRef.current.currentTime = 0;
    }

    setTranscript(finalTranscript);
    setIsGeneratingReport(true);

    const studentUtterances = finalTranscript.filter(t => t.speaker === 'Student').map(t => t.text).join(' ');

    if (studentUtterances.trim().length < 50) {
        setFeedback("No substantive oral argument from the student was captured in this session, so I cannot provide detailed feedback. Please run another session and present your argument so I can evaluate it.");
        setIsGeneratingReport(false);
        setPage(Page.Feedback);
        return;
    }

    if (API_KEY) {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const feedbackPrompt = `
You are a moot court judge providing feedback to a law student after a practice oral argument in ${COURT_RULE_PRESETS[settings.court].formalName}.
Base your feedback ONLY on the transcript and case summary provided.
The case summary is:
---
${selectedCase?.summary}
---
The transcript of the argument is:
---
${finalTranscript.map(t => `${t.speaker}: ${t.text}`).join('\n')}
---
Based on the transcript and case summary, provide a constructive critique referencing specific parts of the transcript. Organize feedback with headings. Cover:
1. Legal Arguments: Soundness, support, and addressing key issues, keeping the court's context in mind.
2. Responsiveness to Questions: Composure, directness, and handling of difficult questions.
3. Organization and Structure: Clarity, roadmap, and time management.
4. Suggestions for Improvement: Actionable advice for their next practice session.
Keep the tone encouraging and professional.
`;
        try {
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: feedbackPrompt
            });
            if (result && result.text) {
                setFeedback(result.text);
            } else {
                throw new Error("Feedback generation returned an empty or invalid response.");
            }
        } catch (error) {
            console.error("Error generating feedback:", error);
            setFeedback("Could not generate feedback due to an API error. Please try again.");
        }
    } else {
        setFeedback("Feedback could not be generated because the API key is not configured.");
    }
    
    setIsGeneratingReport(false);
    setPage(Page.Feedback);
  }, [selectedCase, setFeedback, setPage, setTranscript, sessionPhase, setIsGeneratingReport, settings.court]);


  const getCoCounselHint = useCallback(async () => {
    if (!sessionRef.current || isHintLoading || isStudentSpeakingRef.current) {
      if (!sessionRef.current) addTranscriptEntry({ speaker: 'System', text: 'Co-Counsel is unavailable (session not connected).' });
      return;
    }
    setIsHintLoading(true);
    isAwaitingJudgeResponseRef.current = true; // Block other judge responses while hint is generated
    addTranscriptEntry({ speaker: 'System', text: 'Asking Co-Counsel for a hint...' });

    const lastJudgeEntry = [...transcriptRef.current].reverse().find(e => e.speaker === 'Judge');
    const lastStudentEntry = [...transcriptRef.current].reverse().find(e => e.speaker === 'Student');
    const lastJudgeText = lastJudgeEntry ? lastJudgeEntry.text : "No recent judge question.";
    const lastStudentText = lastStudentEntry ? lastStudentEntry.text : "No recent student answer.";
    
    console.log("Co-Counsel hint requested with:", { lastJudgeText, lastStudentText });

    const courtProfileText = getCourtProfileText(settings.court);
    const hintPrompt = `
You are now acting as the student's **Co-Counsel**, not the Judge.

Context:
- The court is ${COURT_RULE_PRESETS[settings.court].formalName}.
- ${courtProfileText}

Last judge question:
"${lastJudgeText}"

Student's last answer:
"${lastStudentText}"

The student has clicked a button labeled "Ask Co-Counsel for a Hint", which means:
- They want **strategic guidance** on what to say next.

Your task:
- Give a short, concrete hint (1–3 sentences) to help the student improve their next response.
- Speak directly to the student (e.g., "You might want to emphasize that...", "Consider clarifying that...", "It would help to cite...").
- Suggest specific content, structure, or cases to mention.
- Do **not** ask the student questions.
- Do **not** speak to the court or use "Your Honor".
- Do **not** behave like the Judge or evaluate like a grader. Just give practical advice.
- When acting as Co-Counsel you must not ask questions. You must only give direct advice and suggestions, in declarative sentences.
`;

    isExpectingCoCounselHint.current = true;
    try {
      if (sessionRef.current) {
        sessionRef.current.sendRealtimeInput({
          clientContent: {
            role: 'user',
            parts: [{ text: hintPrompt }],
          },
        });
      }
    } catch (error) {
      console.error("Error sending co-counsel hint request:", error);
      setSessionTranscript(prev => prev.slice(0, -1));
      addTranscriptEntry({ speaker: 'System', text: 'Co-Counsel could not provide a hint at this time.' });
      isExpectingCoCounselHint.current = false;
      setIsHintLoading(false);
      isAwaitingJudgeResponseRef.current = false;
    }
  }, [isHintLoading, addTranscriptEntry, settings.court]);

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [sessionTranscript, interimText]);

  useEffect(() => {
    let timerId: ReturnType<typeof setInterval>;
    if (isTimerActive && timeLeft !== null && timeLeft > 0) {
      timerId = setInterval(() => {
        setTimeLeft(prev => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (timeLeft === 0) {
      addTranscriptEntry({ speaker: 'System', text: "Time's up!" });
      endSession(transcriptRef.current);
    }
    return () => clearInterval(timerId);
  }, [timeLeft, isTimerActive, endSession, addTranscriptEntry]);
  
  const promptJudge = useCallback((lastStudentText: string) => {
    if (!sessionRef.current) return;
    isAwaitingJudgeResponseRef.current = true;

    const benchModeText = settings.benchStyle === "Hot"
        ? `You are a HOT BENCH. After the student finishes, respond quickly with a tough, pointed question. Challenge assumptions, highlight tensions with precedent or the record, and use hypotheticals. Ask ONE short, sharp question (1–2 sentences). Your question should push them to defend or refine their last answer.`
        : `You are a STANDARD BENCH. Ask occasional, thoughtful questions that help the student clarify and develop their reasoning. Keep your tone professional and curious, not adversarial. Ask ONE short, focused question (1–2 sentences).`;

    const judgePrompt = `You are now speaking as the Judge. The student has finished speaking.
${benchModeText}

Here is the student's last answer, verbatim:
"${lastStudentText}"

Based ONLY on this answer and the case summary:
- Ask ONE short follow-up question OR make ONE short comment (1–2 sentences), then STOP.
- Your response must clearly reference what they actually said.
- Do NOT ask multiple questions or go on to a second issue.
- After this one turn, wait for the student's next answer.
- If the provided student answer is only a greeting or a very short procedural statement and does not state a legal argument, politely ask them to state or clarify their argument.

Do not speak as co-counsel.`;

    const sendPrompt = () => {
        try {
            if (sessionRef.current) {
                sessionRef.current.sendRealtimeInput({
                    clientContent: {
                        role: 'user',
                        parts: [{ text: judgePrompt }]
                    }
                });
            } else {
                isAwaitingJudgeResponseRef.current = false;
            }
        } catch (error) {
            console.error("Error sending reactive judge prompt:", error);
            addTranscriptEntry({ speaker: 'System', text: 'An error occurred while prompting the judge.' });
            isAwaitingJudgeResponseRef.current = false;
        }
    };

    if (settings.benchStyle === 'Standard') {
        setTimeout(sendPrompt, 500);
    } else {
        sendPrompt();
    }
  }, [settings.benchStyle, selectedCase, addTranscriptEntry]);

  const handleBeginArgument = useCallback(async () => {
    setSessionPhase('Connecting');
    setUiMessage('Initializing session... Please allow microphone access.');

    try {
      if (!API_KEY) {
          setSessionPhase('Ended');
          setUiMessage('Error: API_KEY is not configured.');
          addTranscriptEntry({ speaker: 'System', text: 'Error: API_KEY is not configured. Cannot start session.' });
          return;
      }
    
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Ensure the audio context is running, as browsers may suspend it.
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      if (outputAudioContextRef.current.state === 'suspended') {
        await outputAudioContextRef.current.resume();
      }

      const ai = new GoogleGenAI({ apiKey: API_KEY });
      
      const courtProfile = getCourtProfileText(settings.court);
      const addressForm = COURT_RULE_PRESETS[settings.court].addressForm;

      const systemInstruction = `You are an AI moot court judge. The student is arguing a case with the following summary: "${selectedCase?.summary}".
Your persona should match the selected settings: Court: ${settings.court}, Difficulty: ${settings.difficulty}, Bench Style: ${settings.benchStyle}.

COURT PROFILE:
- ${courtProfile}

Turn limit:
- After each student answer, you may speak once as the Judge (one short turn of 1–2 sentences).
- After that, you must remain silent and wait for the next student answer.
- Do not produce multiple back-to-back questions or comments off a single answer.

Turn-taking and interruption:
- You must never speak while the student is still talking. Wait until they have clearly finished their answer.
- If their last answer is long, you still must wait until they stop; do not cut them off.

Grounding in the student’s actual words:
- You may only describe or paraphrase the student’s position based on the text of their last answer.
- If the student has not yet articulated a particular point, do not assume they have.
- You may not assume what the student will say or fill in missing arguments for them.
- If the student’s last answer is very short, vague, or only contains greetings like “Good morning, Your Honor,” do not pretend they have made a substantive argument. Instead, ask them to present or clarify their argument.

No scripted monologue:
- You must not follow a preset script.
- Each question or comment must be based on the student’s most recent answer and the case summary, not on a generic list of questions.

Style of questions:
- Keep each turn short: 1–2 sentences.
- Your role is to test and explore the student’s reasoning, not to recite a checklist.
- The advocate should address you as "${addressForm}." You may gently remind them of this convention if they do not.

Co-Counsel Role:
- Co-Counsel is the student’s private partner, not part of the court.
- You only speak as the Judge unless the app explicitly tells you that you are acting as co-counsel.
- You must never say things like “Co-counsel may speak now” or “I will ask your co-counsel.” Co-counsel is controlled only by the user, not by you.
- When you act as Co-Counsel:
- Speak to the student, not to the court.
- Use second person: “you,” “your argument,” “you might want to…”.
- Provide direct, concrete suggestions (what to say, which case to cite, what structure to use).
- When acting as Co-Counsel you must not ask questions. You must only give direct advice and suggestions, in declarative sentences.
- Do not ask questions back to the student like “What do you mean?” or “Are you asking for guidance?”.
- Do not question the student like a judge.
- Keep each hint short: 1–3 sentences.
- Never address the court (“Your Honor,” “May it please the Court”) while acting as Co-Counsel.`;

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { 
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: JUDGE_VOICE_NAME }},
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: systemInstruction,
            },
            callbacks: {
                onopen: () => {
                    const source = audioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
                    const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = processor;

                    processor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
                        let sum = 0;
                        for (let i = 0; i < inputData.length; i++) {
                            sum += inputData[i] * inputData[i];
                        }
                        const rms = Math.sqrt(sum / inputData.length);

                        if (rms > VAD_SILENCE_THRESHOLD) {
                            if (!isStudentSpeakingRef.current) {
                                isStudentSpeakingRef.current = true;
                                setIsStudentSpeaking(true);
                            }
                            if (silenceTimerRef.current) {
                                clearTimeout(silenceTimerRef.current);
                                silenceTimerRef.current = null;
                            }
                        } else {
                            if (isStudentSpeakingRef.current && !silenceTimerRef.current) {
                                silenceTimerRef.current = setTimeout(() => {
                                    isStudentSpeakingRef.current = false;
                                    setIsStudentSpeaking(false);
                                    silenceTimerRef.current = null;
                                }, VAD_SILENCE_DURATION_MS);
                            }
                        }
                        
                        const pcmBlob = {
                            data: encode(new Uint8Array(new Int16Array(inputData.map(f => f * 32768)).buffer)),
                            mimeType: 'audio/pcm;rate=16000',
                        };
                        sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
                    };
                    source.connect(processor);
                    processor.connect(audioContextRef.current!.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (!message || !message.serverContent) return;
                
                    const inputTranscriptionText = message.serverContent?.inputTranscription?.text;
                    if (inputTranscriptionText) {
                        currentInputTranscription.current += inputTranscriptionText;
                        setInterimText(prev => ({ ...prev, student: currentInputTranscription.current }));
                    }
                
                    if (isAwaitingJudgeResponseRef.current) {
                        const outputTranscriptionText = message.serverContent?.outputTranscription?.text;
                        if (outputTranscriptionText) {
                            currentOutputTranscription.current += outputTranscriptionText;
                            setInterimText(prev => ({ ...prev, judge: currentOutputTranscription.current }));
                        }
                
                        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                        if (audioData && outputAudioContextRef.current) {
                            try {
                                const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current, 24000, 1);
                                playAudioBuffer(audioBuffer);
                            } catch (audioError) {
                                console.error("Failed to decode or play audio data:", audioError);
                            }
                        }
                    }
                
                    if (message.serverContent?.turnComplete) {
                        const studentText = currentInputTranscription.current.trim();
                        const judgeText = currentOutputTranscription.current.trim();
                        
                        currentInputTranscription.current = '';
                        currentOutputTranscription.current = '';
                        setInterimText({ student: '', judge: '' });

                        if (studentText) {
                            addTranscriptEntry({ speaker: 'Student', text: studentText });
                            if (!timerStartedRef.current && settings.timerLength > 0) {
                                setIsTimerActive(true);
                                timerStartedRef.current = true;
                                setUiMessage('Argument in progress...');
                            }
                            promptJudge(studentText);
                        } else if (judgeText) {
                            if (isAwaitingJudgeResponseRef.current) {
                                const isCoCounselTurn = isExpectingCoCounselHint.current;
                                if (isCoCounselTurn) {
                                    setSessionTranscript(prev => [...prev.slice(0, -1), { speaker: 'Co-Counsel', text: judgeText, timestamp: new Date().toISOString() }]);
                                    isExpectingCoCounselHint.current = false;
                                    setIsHintLoading(false);
                                } else {
                                    addTranscriptEntry({ speaker: 'Judge', text: judgeText });
                                }
                                isAwaitingJudgeResponseRef.current = false;
                            }
                        } else {
                            if (isAwaitingJudgeResponseRef.current) {
                                if (isExpectingCoCounselHint.current) {
                                    setSessionTranscript(prev => [...prev.slice(0, -1), { speaker: 'System', text: 'Co-Counsel did not provide a hint.', timestamp: new Date().toISOString() }]);
                                    isExpectingCoCounselHint.current = false;
                                    setIsHintLoading(false);
                                }
                                isAwaitingJudgeResponseRef.current = false;
                            }
                        }
                    }
                },
                onerror: (e) => {
                    console.error("Session error:", e);
                    setSessionPhase('Ended');
                    setUiMessage('A connection error occurred.');
                    addTranscriptEntry({ speaker: 'System', text: `A connection error occurred.` });
                },
                onclose: () => {
                    if (sessionPhase !== 'Ended') {
                      addTranscriptEntry({ speaker: 'System', text: 'Session closed unexpectedly.' });
                    }
                }
            }
        });
        sessionRef.current = await sessionPromise;

        if (settings.courtroomSounds) {
            const AMBIENT_AUDIO_URL = "https://raw.githubusercontent.com/WilliamHuggins/WilliamHuggins/main/Imagine_you%E2%80%99re_sitti_%234-1763398352319.mp3";
            ambientAudioRef.current = new Audio(AMBIENT_AUDIO_URL); 
            ambientAudioRef.current.loop = true;
            ambientAudioRef.current.preload = "auto";
            ambientAudioRef.current.volume = 0.2;
            ambientAudioRef.current.play().catch(e => {
                console.error("Ambient audio play failed:", e);
                setAmbientError('Could not play courtroom ambient sound.');
            });
        }

        setSessionPhase('ArgumentInProgress');
        setUiMessage('You may begin your argument. Your microphone is live.');
        if (settings.timerLength > 0 && !timerStartedRef.current) {
            setIsTimerActive(true);
            timerStartedRef.current = true;
        }

      } catch (err) {
        console.error("Setup failed:", err);
        setSessionPhase('Ended');
        setUiMessage('Failed to initialize microphone or audio session.');
        addTranscriptEntry({ speaker: 'System', text: 'Failed to initialize microphone or audio session. Please ensure you have granted microphone permissions.' });
      }
    }, [API_KEY, settings, selectedCase, addTranscriptEntry, playAudioBuffer, endSession, promptJudge]);
    
    useEffect(() => {
      return () => {
        if (sessionPhase !== 'Ended') {
          endSession(transcriptRef.current);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return 'No Timer';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const renderTranscriptBubble = (speaker: string, text: string) => {
    const isStudent = speaker === 'Student';
    const isCoCounsel = speaker === 'Co-Counsel';
    const isSystem = speaker === 'System';
    
    let bubbleClass = 'bg-gray-200 text-stanford-charcoal';
    if (isStudent) bubbleClass = 'bg-blue-600 text-white';
    if (isCoCounsel) bubbleClass = 'bg-stanford-green text-white italic';
    if (isSystem) bubbleClass = 'bg-yellow-100 text-yellow-800 text-center w-full max-w-full';

    let justification = 'justify-start';
    if (isStudent) justification = 'justify-end';
    if (isSystem) justification = 'justify-center';

    return (
        <div className={`flex ${justification}`}>
            <div className={`max-w-xl p-3 rounded-lg shadow-sm ${bubbleClass}`}>
                {!isSystem && <p className="font-bold text-sm">{speaker}</p>}
                <p className="whitespace-pre-wrap">{text}</p>
            </div>
        </div>
    );
  }
  
  if (sessionPhase === 'Idle') {
    return (
        <div className="flex flex-col items-center justify-center h-[85vh] max-w-5xl mx-auto bg-white rounded-lg shadow-2xl p-8 text-center">
            <h2 className="text-3xl font-serif font-bold mb-4">You are ready to begin.</h2>
            <p className="text-lg text-gray-700 mb-2">You will be arguing in the <span className="font-semibold text-stanford-red">{settings.court}</span>.</p>
            <p className="text-lg text-gray-700 mb-8">The case is <span className="font-semibold">{selectedCase?.title}</span>.</p>
            <button
                onClick={handleBeginArgument}
                className="px-10 py-4 bg-stanford-red text-white text-xl font-semibold rounded-lg shadow-md hover:bg-red-800 transition-colors duration-300 transform hover:scale-105"
            >
                Begin Oral Argument
            </button>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-[85vh] max-w-5xl mx-auto bg-white rounded-lg shadow-2xl overflow-hidden">
      <div className="flex justify-between items-center p-4 bg-gray-50 border-b">
        <div>
          <h2 className="text-xl font-bold font-serif">{selectedCase?.title || 'Live Session'}</h2>
          <p className="text-sm text-gray-500 font-semibold">Practicing in: <span className="font-bold text-stanford-red">{settings.court}</span></p>
          <p className="text-sm text-gray-500 font-semibold">{uiMessage}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-stanford-red">{formatTime(timeLeft)}</p>
          <p className="text-xs text-gray-500">Time Remaining</p>
        </div>
      </div>
      
      {ambientError && (
        <div className="bg-yellow-100 text-yellow-800 text-center py-2 px-4 text-sm" role="alert">
            {ambientError}
        </div>
      )}

      <div ref={transcriptContainerRef} className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-100">
        {sessionTranscript.map((entry, index) => (
          <div key={index}>
            {renderTranscriptBubble(entry.speaker, entry.text)}
          </div>
        ))}
        {interimText.judge && <div className="opacity-70">{renderTranscriptBubble('Judge', interimText.judge)}</div>}
        {interimText.student && <div className="opacity-70">{renderTranscriptBubble('Student', interimText.student)}</div>}
      </div>
      
      <div className="p-4 bg-gray-50 border-t flex items-center justify-center space-x-6">
        {settings.coCounsel && (
          <button 
            onClick={getCoCounselHint} 
            disabled={isHintLoading || isStudentSpeaking}
            className="px-5 py-3 bg-stanford-green text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
          >
            {isHintLoading ? 'Getting hint...' : 'Get help from Co-Counsel'}
          </button>
        )}
        <div className={`p-4 rounded-full ${isStudentSpeaking ? 'bg-blue-600' : sessionPhase !== 'Ended' ? 'bg-stanford-red' : 'bg-gray-400'} transition-colors`}>
          <MicIcon className="h-8 w-8 text-white" />
        </div>
        <button onClick={() => endSession(transcriptRef.current)} title="End Session" className="p-3 bg-stanford-red text-white rounded-full shadow-lg hover:bg-red-800 transition-colors">
            <EndCallIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default LiveSessionPage;
