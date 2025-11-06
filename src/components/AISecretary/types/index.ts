// AISecretary 컴포넌트 관련 타입 정의들
export interface AISecretaryCreatorProps {
  onClose?: () => void;
  editingSecretary?: AISecretary | null;
}

export type CreationStep = 'basic' | 'image' | 'voice';

export interface BasicInfoStepProps {
  name: string;
  setName: (name: string) => void;
  gender: 'male' | 'female';
  setGender: (gender: 'male' | 'female') => void;
  personality: string;
  setPersonality: (personality: string) => void;
  onNext: () => void;
  isValid: boolean;
}

export interface ImageStepProps {
  imageUrl: string;
  setImageUrl: (url: string) => void;
  onNext: () => void;
  onPrev: () => void;
  imageMode: 'avatar' | 'upload';
  setImageMode: (mode: 'avatar' | 'upload') => void;
}

export interface VoiceStepProps {
  name: string;
  personality: string;
  voiceParams: VoiceParams;
  setVoiceParams: React.Dispatch<React.SetStateAction<VoiceParams>>;
  recommendedVoices: string[];
  isPlayingVoice: boolean;
  isRecommending: boolean;
  sampleTexts: string[];
  onVoiceRecommendation: () => void;
  onSelectRecommendedVoice: (voiceName: string) => void;
  onTestVoice: () => void;
  onPrev: () => void;
  onSave: () => void;
  onSkip: () => void;
  gender: 'male' | 'female';
}

export interface ActionButtonsProps {
  onClose?: () => void;
  onSave: () => void;
  isValid: boolean;
  isEditing?: boolean;
}

// 필요한 타입들을 임포트
import { AISecretary, VoiceParams } from '../../../utils/db';

// VoiceParams를 재export
export type { VoiceParams };