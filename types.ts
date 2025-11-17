export enum Page {
  Home = 'Home',
  Settings = 'Settings',
  CaseSelection = 'CaseSelection',
  LiveSession = 'LiveSession',
  Feedback = 'Feedback',
  Privacy = 'Privacy',
}

export type Court =
  | 'Generic Appellate Court'
  | 'U.S. Supreme Court'
  | 'U.S. Court of Appeals (Ninth Circuit)'
  | 'California Supreme Court'
  | 'U.S. District Court (Motion Hearing)';

export interface Settings {
  timerLength: number; // in minutes, 0 for no timer
  difficulty: '1L' | '2L' | '3L/LLM';
  benchStyle: 'Standard' | 'Hot';
  courtroomSounds: boolean;
  coCounsel: boolean;
  court: Court;
}

export interface Case {
  id?: string;
  title: string;
  year?: number | string;
  category: string;
  summary: string;
  tags?: string[];
  status?: string;
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