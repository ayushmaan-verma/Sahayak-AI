
export type Language = 'en' | 'hi' | 'bn' | 'mr' | 'ta' | 'te' | 'pa';

export interface UserProfile {
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other' | '';
  income: number;
  category: 'General' | 'OBC' | 'SC' | 'ST' | '';
  education: 'None' | 'Primary' | 'Secondary' | 'Graduate' | 'Post-Graduate' | '';
  state: string;
}

export interface Scheme {
  id: string;
  name: string;
  description: string;
  benefits: string[];
  whyItFits: string;
  link?: string;
  category?: string;
}

export interface LockerDocument {
  id: string;
  type: string;
  name: string;
  data?: string; // base64
  mimeType?: string;
  lastUpdated?: Date;
  isCustom?: boolean;
}

export interface Application {
  id: string;
  schemeName: string;
  status: 'Submitted' | 'Pending' | 'Approved' | 'Rejected';
  progress: number;
  lastUpdated: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  transcription?: string;
  docMetadata?: {
    requiredDocuments?: string[];
    contactInfo?: string;
    importantDates?: string[];
    importantLinks?: string[];
    eligibilityCriteria?: string[];
    howToApply?: string[];
    isValidScheme?: boolean;
  };
  schemes?: Scheme[];
  quickReplies?: string[];
  type?: 'text' | 'image' | 'eligibility' | 'suggestions';
  timestamp: Date;
  attachments?: string[];
  audioUrl?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  lastModified: Date;
  messages: Message[];
}
