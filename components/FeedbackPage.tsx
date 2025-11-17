
import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../App';
import { Page } from '../types';

declare const jspdf: any;

const FeedbackPage: React.FC = () => {
  const { settings, selectedCase, transcript, feedback, resetApp, setPage } = useAppContext();
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("Report page received transcript:", transcript);
  }, [transcript]);

  const downloadPdf = () => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4'
    });
    
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    const addTitle = (title: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text(title, pageWidth / 2, y, { align: 'center' });
        y += 30;
    };
    
    const addSectionHeader = (header: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(header, margin, y);
        y += 20;
        doc.setDrawColor(200);
        doc.line(margin, y - 15, pageWidth - margin, y - 15);
    };

    const addBodyText = (text: string) => {
        doc.setFont('times', 'normal');
        doc.setFontSize(11);
        const splitText = doc.splitTextToSize(text, contentWidth);
        for(let i = 0; i < splitText.length; i++) {
            if (y > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
            doc.text(splitText[i], margin, y);
            y += 15;
        }
        y += 15; // Extra space after section
    };

    // --- Build PDF ---
    addTitle("Stanford Law School Oral Argument Coach");
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Session Report: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: 'center' });
    y += 40;
    
    // Session Settings
    addSectionHeader('Session Settings');
    addBodyText(
      `Court: ${settings.court}\n` +
      `Time Limit: ${settings.timerLength > 0 ? `${settings.timerLength} minutes` : 'No Timer'}\n` +
      `Bench Style: ${settings.benchStyle}\n` +
      `Difficulty: ${settings.difficulty}`
    );

    // Case Summary
    addSectionHeader(`Case Summary: ${selectedCase?.title}`);
    addBodyText(selectedCase?.summary || 'No case summary available.');
    
    // Feedback
    addSectionHeader('Feedback & Suggestions');
    addBodyText(feedback || 'No feedback available.');
    
    // Transcript
    addSectionHeader('Full Transcript');
    transcript.forEach(entry => {
        const text = `${entry.speaker}: ${entry.text}`;
        doc.setFont('courier', entry.speaker === 'Student' ? 'bold' : 'normal');
        const splitText = doc.splitTextToSize(text, contentWidth);
        for(let i = 0; i < splitText.length; i++) {
            if (y > pageHeight - margin) {
                doc.addPage();
                y = margin;
                addSectionHeader('Full Transcript (Continued)');
            }
            doc.text(splitText[i], margin, y);
            y += 15;
        }
    });

    const now = new Date();
    const formattedDate = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    const formattedTime = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
    const filename = `Stanford_Oral_Argument_Report_${formattedDate}_${formattedTime}.pdf`;
    doc.save(filename);
  };

  const startNewSession = () => {
    setPage(Page.CaseSelection);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif font-bold">Session Completed!</h2>
        <p className="text-lg text-gray-600">Great job! Here’s your practice report.</p>
      </div>

      <div ref={reportRef} className="bg-white p-8 rounded-lg shadow-lg">
        <h3 className="text-2xl font-serif font-bold border-b pb-2 mb-4 text-stanford-red">Practice Report</h3>
        <p className="text-sm text-gray-500 mb-6">Session Date: {new Date().toLocaleString()}</p>
        
         <div className="mb-8">
            <h4 className="text-xl font-serif font-semibold mb-2">Session Settings</h4>
            <div className="p-4 bg-gray-50 rounded-md text-sm text-gray-700 grid grid-cols-2 gap-4">
                <p><strong>Court:</strong> {settings.court}</p>
                <p><strong>Time Limit:</strong> {settings.timerLength > 0 ? `${settings.timerLength} minutes` : 'No Timer'}</p>
                <p><strong>Bench Style:</strong> {settings.benchStyle}</p>
                <p><strong>Difficulty:</strong> {settings.difficulty}</p>
            </div>
        </div>

        <div className="mb-8">
            <h4 className="text-xl font-serif font-semibold mb-2">Case Summary: {selectedCase?.title}</h4>
            <div className="p-4 bg-gray-50 rounded-md text-sm text-gray-700 whitespace-pre-wrap">
                {selectedCase?.summary}
            </div>
        </div>

        <div className="mb-8">
            <h4 className="text-xl font-serif font-semibold mb-2">Feedback & Suggestions</h4>
            <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-md text-sm text-gray-800 whitespace-pre-wrap">
                {feedback || "Generating feedback..."}
            </div>
        </div>

        <div>
            <h4 className="text-xl font-serif font-semibold mb-2">Full Transcript</h4>
            <div className="p-4 bg-gray-50 rounded-md max-h-96 overflow-y-auto text-sm space-y-3">
                {transcript.length > 0 ? transcript.map((entry, index) => (
                    <div key={index} className="flex items-start">
                        <span className="font-bold w-24 flex-shrink-0">{entry.speaker}: </span>
                        <span className="flex-grow">{entry.text}</span>
                        <span className="text-xs text-gray-400 ml-4 flex-shrink-0">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                    </div>
                )) : <p className="text-gray-500">No transcript was recorded for this session.</p>}
            </div>
        </div>
      </div>

      <div className="mt-10 flex flex-col md:flex-row items-center justify-center gap-4">
        <button onClick={downloadPdf} className="px-8 py-3 bg-stanford-green text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors">
            Download Full Report (PDF)
        </button>
        <button onClick={startNewSession} className="px-8 py-3 bg-stanford-red text-white font-semibold rounded-lg shadow-md hover:bg-red-800 transition-colors">
            Start New Session
        </button>
         <button onClick={resetApp} className="px-8 py-3 bg-gray-600 text-white font-semibold rounded-lg shadow-md hover:bg-gray-700 transition-colors">
            Return to Home
        </button>
      </div>
    </div>
  );
};

export default FeedbackPage;