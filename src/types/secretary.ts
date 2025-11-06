export interface AISecretary {
  id: string;
  name: string;
  gender: 'male' | 'female';
  personality: string;
  personalityPrompt: string;
  imageUrl?: string;
  voiceParams: {
    rate: number;
    pitch: number;
    voiceName?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface VoiceParams {
  rate: number;
  pitch: number;
  voiceName?: string;
}

export interface SecretaryCreationData {
  name: string;
  gender: 'male' | 'female';
  personality: string;
  imageUrl?: string;
  voiceParams: VoiceParams;
}