export enum Page {
  Home = 'Home',
  Settings = 'Settings',
  CaseSelection = 'CaseSelection',
  LiveSession = 'LiveSession',
  Feedback = 'Feedback',
  Privacy = 'Privacy',
}

export interface Settings {
  timerLength: number; // in minutes, 0 for no timer
  difficulty: '1L' | '2L' | '3L/LLM';
  benchStyle: 'Standard' | 'Hot';
  voiceType: 'Male' | 'Female';
  courtroomSounds: boolean;
  coCounsel: boolean;
}

export interface Case {
  title: string;
  summary: string;
  category: string;
}

export interface CaseCategory {
  name: string;
  cases: Case[];
}

export interface TranscriptEntry {
  speaker: 'Student' | 'Judge' | 'Co-Counsel' | 'System';
  text: string;
  timestamp: string; // Changed from Date to string
}