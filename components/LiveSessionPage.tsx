import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { useAppContext } from '../App';
import { Page, TranscriptEntry } from '../types';
import { MicIcon, EndCallIcon } from './icons';
import { encode, decode, decodeAudioData } from '../utils/audioUtils';

const API_KEY = process.env.API_KEY;

const LiveSessionPage: React.FC = () => {
  const { settings, selectedCase, setTranscript, setFeedback, setPage, setIsGeneratingReport } = useAppContext();
  const [status, setStatus] = useState<'Connecting' | 'Connected' | 'Error' | 'Ended'>('Connecting');
  const [sessionTranscript, setSessionTranscript] = useState<TranscriptEntry[]>([]);
  const [interimText, setInterimText] = useState({ student: '', judge: '' });
  const [timeLeft, setTimeLeft] = useState(settings.timerLength > 0 ? settings.timerLength * 60 : null);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [ambientError, setAmbientError] = useState('');

  const sessionRef = useRef<any | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextAudioStartTime = useRef(0);
  const ambientAudioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');
  const timerStartedRef = useRef(false);
  const isExpectingCoCounselHint = useRef(false);

  // FIX: Use a ref to hold the latest transcript to avoid stale closures in cleanup effects.
  const transcriptRef = useRef(sessionTranscript);
  useEffect(() => {
    transcriptRef.current = sessionTranscript;
  }, [sessionTranscript]);

  const addTranscriptEntry = useCallback((entry: Omit<TranscriptEntry, 'timestamp'>) => {
    const newEntry = { ...entry, timestamp: new Date().toISOString() };
    console.log("Adding transcript entry:", newEntry);
    setSessionTranscript(prev => [...prev, newEntry]);
  }, []);

  const endSession = useCallback(async (finalTranscript: TranscriptEntry[]) => {
    if (status === 'Ended') return;
    setStatus('Ended');
    setIsTimerActive(false);

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

    // FIX: Set the final transcript in the global state before navigating.
    setTranscript(finalTranscript);
    setIsGeneratingReport(true);

    const studentUtterances = finalTranscript.filter(t => t.speaker === 'Student').map(t => t.text).join(' ');

    if (studentUtterances.trim().length < 50) { // If student said very little
        setFeedback("No substantive oral argument from the student was captured in this session, so I cannot provide detailed feedback. Please run another session and present your argument so I can evaluate it.");
        setIsGeneratingReport(false);
        setPage(Page.Feedback);
        return;
    }

    if (API_KEY) {
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const feedbackPrompt = `
You are a moot court judge providing feedback to a law student after a practice oral argument.
Base your feedback ONLY on the transcript and case summary provided. If the transcript contains no student argument, say that you cannot evaluate, and do not invent content.
The case summary is:
---
${selectedCase?.summary}
---
The transcript of the argument is:
---
${finalTranscript.map(t => `${t.speaker}: ${t.text}`).join('\n')}
---
Based on the transcript and case summary, provide a constructive critique referencing specific parts of the transcript. Organize feedback with headings. Cover:
1. Legal Arguments: Soundness, support, and addressing key issues.
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
  }, [selectedCase, setFeedback, setPage, setTranscript, status, setIsGeneratingReport]);


  const getCoCounselHint = useCallback(async () => {
    if (!sessionRef.current || isHintLoading) {
      if (!sessionRef.current) addTranscriptEntry({ speaker: 'System', text: 'Co-Counsel is unavailable (session not connected).' });
      return;
    }
    setIsHintLoading(true);
    addTranscriptEntry({ speaker: 'System', text: 'Asking Co-Counsel for a hint...' });

    const lastJudgeEntry = [...sessionTranscript].reverse().find(e => e.speaker === 'Judge');
    const lastStudentEntry = [...sessionTranscript].reverse().find(e => e.speaker === 'Student');
    const lastJudgeText = lastJudgeEntry ? lastJudgeEntry.text : "No judge question yet.";
    const lastStudentText = lastStudentEntry ? lastStudentEntry.text : "No student response yet.";

    const hintPrompt = `
You are now acting as the student's co-counsel, not the judge.

Given the last judge question:
"${lastJudgeText}"

and the student's last answer:
"${lastStudentText}"

Speak a short 1–2 sentence hint addressed to YOUR COLLEAGUE (the student), not to the court. 
Do not answer the judge yourself. 
Instead, tell the student what key point to emphasize, concede, or reframe in their next answer.
Use language like: "You might want to emphasize that...", "Consider pointing out that...".
`;

    isExpectingCoCounselHint.current = true;
    try {
      sessionRef.current.sendRealtimeInput({
        clientContent: {
          role: 'user',
          parts: [{ text: hintPrompt }],
        },
      });
    } catch (error) {
      console.error("Error sending co-counsel hint request:", error);
      setSessionTranscript(prev => prev.slice(0, -1)); // Remove "Asking..." message
      addTranscriptEntry({ speaker: 'System', text: 'Co-Counsel could not provide a hint at this time.' });
      isExpectingCoCounselHint.current = false;
      setIsHintLoading(false);
    }
  }, [isHintLoading, addTranscriptEntry, sessionTranscript]);

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [sessionTranscript, interimText]);

  useEffect(() => {
    // FIX: Use ReturnType<typeof setInterval> for browser compatibility instead of NodeJS.Timeout.
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


  useEffect(() => {
    async function setupSession() {
      if (!API_KEY) {
        setStatus('Error');
        addTranscriptEntry({ speaker: 'System', text: 'Error: API_KEY is not configured. Cannot start session.' });
        return;
      }
      
      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const selectedVoice = settings.voiceType === 'Male' ? 'Kore' : 'Puck';

        const systemInstruction = `You are an AI moot court judge, the presiding appellate judge in a moot court practice. The student is arguing a case with the following summary: "${selectedCase?.summary}".
Your persona should match the selected settings: Difficulty: ${settings.difficulty}, Bench Style: ${settings.benchStyle}.
Your job is to engage with the student’s reasoning, not just recite canned questions.

JUDGE BEHAVIOR:
- When prompted to act as the judge, you will be given the student's last answer. Your response must be a direct reaction to that answer.
- Your questions must clearly reference what the student actually said. Use phrases like: “You just argued that…”, “Earlier, you said…”, “If we accept your point that X, how do you address Y?”
- For each question, show a small amount of judicial reasoning in your phrasing. Your task is to test the coherence and consequences of the student’s argument.
- Do not introduce a new topic that is unrelated to the student’s last answer.
- Do not interrupt. Wait for the student to finish speaking.

CO-COUNSEL ROLE:
- You must never speak as co-counsel or invite co-counsel on your own. You only speak as the Judge.
- As the Judge, you never invite the co-counsel to speak. Co-counsel is controlled only by the user. You must not say things like “Co-Counsel, you may ask a question” or similar phrases.
- Co-counsel only speaks when explicitly requested by the student (when the app sends you a message that says you are acting as co-counsel). At all other times, you are only the Judge.

SESSION START:
Begin the session with this exact ceremonial opening:
"All rise. The court is now in session. Please be seated. We are here today to hear argument in this matter. Counsel, you may begin when you are ready."
Do not say anything else before this opening. After the opening, wait for the student to speak.`;

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice }}},
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: systemInstruction,
            },
            callbacks: {
                onopen: () => {
                    setStatus('Connected');
                    const source = audioContextRef.current!.createMediaStreamSource(mediaStreamRef.current!);
                    const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
                    scriptProcessorRef.current = processor;

                    processor.onaudioprocess = (e) => {
                        const inputData = e.inputBuffer.getChannelData(0);
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
                    
                    const outputTranscriptionText = message.serverContent?.outputTranscription?.text;
                    if (outputTranscriptionText) {
                        currentOutputTranscription.current += outputTranscriptionText;
                        setInterimText(prev => ({...prev, judge: currentOutputTranscription.current }));
                    }

                    if (message.serverContent?.turnComplete) {
                        const isCoCounselTurn = isExpectingCoCounselHint.current;
                        if (isCoCounselTurn) {
                            isExpectingCoCounselHint.current = false;
                            setIsHintLoading(false);
                        }
                        
                        const lastStudentText = currentInputTranscription.current.trim();
                        const lastJudgeText = currentOutputTranscription.current.trim();

                        const newEntries: TranscriptEntry[] = [];
                        if (lastStudentText) {
                            newEntries.push({ speaker: 'Student', text: lastStudentText, timestamp: new Date().toISOString() });
                            if (!timerStartedRef.current && settings.timerLength > 0) {
                                setIsTimerActive(true);
                                timerStartedRef.current = true;
                            }
                        }
                        if (lastJudgeText) {
                           newEntries.push({ speaker: isCoCounselTurn ? 'Co-Counsel' : 'Judge', text: lastJudgeText, timestamp: new Date().toISOString() });
                        }
                    
                        if (newEntries.length > 0) {
                            setSessionTranscript(prev => {
                                let updatedTranscript = prev;
                                if (isCoCounselTurn) {
                                    // Remove the "Asking..." system message
                                    updatedTranscript = updatedTranscript.slice(0, -1);
                                }
                                return [...updatedTranscript, ...newEntries];
                            });
                        }

                        currentInputTranscription.current = '';
                        currentOutputTranscription.current = '';
                        setInterimText({ student: '', judge: '' });

                        // NEW LOGIC: If the student just spoke, prompt the judge to respond.
                        if (lastStudentText && !isCoCounselTurn && sessionRef.current) {
                            const judgePrompt = `You are the Judge. Here is what the student just said in their last answer:

"${lastStudentText}"

Based on THIS answer alone and the case summary context, respond as the Judge in 1–2 sentences. 
Your response must clearly reference what the student just said. 
Ask one follow-up question or make one short comment that challenges or tests their reasoning. 
Do not speak as co-counsel and do not change topics.`;
                    
                            try {
                                sessionRef.current.sendRealtimeInput({
                                    clientContent: {
                                        role: 'user',
                                        parts: [{ text: judgePrompt }]
                                    }
                                });
                            } catch (error) {
                                console.error("Error sending reactive judge prompt:", error);
                                addTranscriptEntry({ speaker: 'System', text: 'An error occurred while prompting the judge.' });
                            }
                        }
                    }

                    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                    if (audioData && outputAudioContextRef.current) {
                        try {
                            const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current, 24000, 1);
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            
                            const currentTime = outputAudioContextRef.current.currentTime;
                            const startTime = Math.max(currentTime, nextAudioStartTime.current);
                            source.start(startTime);
                            nextAudioStartTime.current = startTime + audioBuffer.duration;
                        } catch (audioError) {
                            console.error("Failed to decode or play audio data:", audioError);
                        }
                    }
                },
                onerror: (e) => {
                    console.error("Session error:", e);
                    setStatus('Error');
                    addTranscriptEntry({ speaker: 'System', text: `A connection error occurred.` });
                },
                onclose: () => {
                    if (status !== 'Ended') {
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

      } catch (err) {
        console.error("Setup failed:", err);
        setStatus('Error');
        addTranscriptEntry({ speaker: 'System', text: 'Failed to initialize microphone or audio session.' });
      }
    }
    
    setupSession();
    
    return () => {
      // FIX: On cleanup, end the session with the *latest* transcript from the ref.
      endSession(transcriptRef.current);
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

  return (
    <div className="flex flex-col h-[85vh] max-w-5xl mx-auto bg-white rounded-lg shadow-2xl overflow-hidden">
      <div className="flex justify-between items-center p-4 bg-gray-50 border-b">
        <div>
          <h2 className="text-xl font-bold font-serif">{selectedCase?.title || 'Live Session'}</h2>
          <p className="text-sm text-gray-500">{status}...</p>
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
            disabled={isHintLoading}
            className="px-5 py-3 bg-stanford-green text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
          >
            {isHintLoading ? 'Getting hint...' : 'Get help from Co-Counsel'}
          </button>
        )}
        <div className={`p-4 rounded-full ${status === 'Connected' ? 'bg-stanford-red animate-pulse' : 'bg-gray-400'}`}>
          <MicIcon className="h-8 w-8 text-white" />
        </div>
        <button onClick={() => endSession(sessionTranscript)} title="End Session" className="p-3 bg-stanford-red text-white rounded-full shadow-lg hover:bg-red-800 transition-colors">
            <EndCallIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default LiveSessionPage;