
import React, { useState, useCallback, createContext, useContext } from 'react';
import { Page, Settings, Case, TranscriptEntry } from './types';
import HomePage from './components/HomePage';
import SettingsPage from './components/SettingsPage';
import CaseSelectionPage from './components/CaseSelectionPage';
import LiveSessionPage from './components/LiveSessionPage';
import FeedbackPage from './components/FeedbackPage';
import PrivacyPage from './components/PrivacyPage';
import Header from './components/Header';
import { SpinnerIcon } from './components/icons';

interface AppContextType {
  currentPage: Page;
  settings: Settings;
  selectedCase: Case | null;
  transcript: TranscriptEntry[];
  feedback: string;
  isGeneratingReport: boolean;
  setPage: (page: Page) => void;
  setSettings: (settings: Settings) => void;
  setSelectedCase: (caseDetail: Case | null) => void;
  setTranscript: (transcript: TranscriptEntry[]) => void;
  setFeedback: (feedback: string) => void;
  setIsGeneratingReport: (isGenerating: boolean) => void;
  resetApp: () => void;
}

const defaultSettings: Settings = {
  timerLength: 10,
  difficulty: '1L',
  benchStyle: 'Standard',
  voiceType: 'Female', // Default to Female
  courtroomSounds: false,
  coCounsel: false,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

const GeneratingReportModal: React.FC = () => (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity duration-300">
    <div className="bg-white p-8 rounded-lg shadow-xl flex flex-col items-center text-center">
      <SpinnerIcon className="h-12 w-12 animate-spin text-stanford-red" />
      <p className="mt-4 text-lg font-semibold text-stanford-charcoal">Generating your practice report...</p>
      <p className="text-gray-600">This may take a few moments.</p>
    </div>
  </div>
);


const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [feedback, setFeedback] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);

  const setPage = useCallback((page: Page) => {
    setCurrentPage(page);
  }, []);

  const resetApp = useCallback(() => {
    setCurrentPage(Page.Home);
    setSettings(defaultSettings);
    setSelectedCase(null);
    setTranscript([]);
    setFeedback('');
    setIsGeneratingReport(false);
  }, []);

  const value = {
    currentPage,
    settings,
    selectedCase,
    transcript,
    feedback,
    isGeneratingReport,
    setPage,
    setSettings,
    setSelectedCase,
    setTranscript,
    setFeedback,
    setIsGeneratingReport,
    resetApp,
  };

  const renderPage = () => {
    switch (currentPage) {
      case Page.Home:
        return <HomePage />;
      case Page.Settings:
        return <SettingsPage />;
      case Page.CaseSelection:
        return <CaseSelectionPage />;
      case Page.LiveSession:
        return <LiveSessionPage />;
      case Page.Feedback:
        return <FeedbackPage />;
      case Page.Privacy:
        return <PrivacyPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <AppContext.Provider value={value}>
      <div className="min-h-screen bg-gray-50 font-sans">
        {currentPage !== Page.Home && <Header />}
        <main className="container mx-auto p-4 md:p-8">{renderPage()}</main>
        {isGeneratingReport && <GeneratingReportModal />}
      </div>
    </AppContext.Provider>
  );
};

export default App;