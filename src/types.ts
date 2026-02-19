export interface User {
  id: string;
  email: string;
  favorite_genre: string;
  favorite_voice: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  content: string;
  audio_data: string; // base64
  image_data?: string; // base64
  genre: string;
  created_at: string;
}

export type InputMode = 'text' | 'voice' | 'image';

export interface GenerationState {
  step: 'idle' | 'analyzing' | 'writing' | 'synthesizing' | 'complete' | 'error';
  progress: number;
  message: string;
}
