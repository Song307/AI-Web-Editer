import React, { useState, useEffect } from 'react';
import { saveAISecretary, SecretaryCreationData, VoiceParams } from '../utils/db';
import toast from 'react-hot-toast';

// 컴포넌트 임포트
import BasicInfoStep from './AISecretary/BasicInfoStep';
import ImageStep from './AISecretary/ImageStep';
import VoiceStep from './AISecretary/VoiceStep';

// 유틸리티 임포트
import { recommendVoicesWithAI, getVoiceDisplayName } from './AISecretary/utils/voiceUtils';

// 타입 임포트
import { AISecretaryCreatorProps, CreationStep } from './AISecretary/types';

const AISecretaryCreator: React.FC<AISecretaryCreatorProps> = ({ onClose, editingSecretary }) => {
  const [currentStep, setCurrentStep] = useState<CreationStep>('basic');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [personality, setPersonality] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageMode, setImageMode] = useState<'avatar' | 'upload'>('avatar');
  const [voiceParams, setVoiceParams] = useState<VoiceParams>({ rate: 1, pitch: 1, voiceName: 'ko-KR-SunHiNeural' });
  const [recommendedVoices, setRecommendedVoices] = useState<string[]>([]);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [sampleTexts, setSampleTexts] = useState<string[]>([]);

  // 편집 모드 초기화
  useEffect(() => {
    if (editingSecretary) {
      setName(editingSecretary.name);
      setGender(editingSecretary.gender);
      setPersonality(editingSecretary.personality);
      setImageUrl(editingSecretary.imageUrl || '');
      setVoiceParams(editingSecretary.voiceParams);
    }
  }, [editingSecretary]);

  // 컴포넌트 마운트 시 초기 목소리 설정
  useEffect(() => {
    console.log('AISecretaryCreator 마운트, 초기 성별:', gender);
    if (!editingSecretary) {
      const defaultVoiceName = gender === 'male' ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural';
      console.log('초기 목소리 설정:', defaultVoiceName);
      setVoiceParams(prev => ({
        ...prev,
        voiceName: defaultVoiceName
      }));
    }
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  // 성별 변경 시 기본 목소리 업데이트 (편집 모드가 아닐 때만)
  useEffect(() => {
    if (!editingSecretary) {
      const newVoiceName = gender === 'male' ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural';
      console.log('성별 변경으로 목소리 업데이트:', gender, '->', newVoiceName);
      setVoiceParams(prev => ({
        ...prev,
        voiceName: newVoiceName
      }));
    }
  }, [gender, editingSecretary]);

  // 스텝 네비게이션
  const handleNextStep = () => {
    if (currentStep === 'basic') {
      setCurrentStep('image');
    } else if (currentStep === 'image') {
      setCurrentStep('voice');
    }
  };

  const handlePrevStep = () => {
    if (currentStep === 'voice') {
      setCurrentStep('image');
    } else if (currentStep === 'image') {
      setCurrentStep('basic');
    }
  };

  // 음성 skip 시 기본 음성 설정
  const handleSkipVoice = () => {
    const defaultVoice = gender === 'male' ? 'ko-KR-InJoonNeural' : 'ko-KR-SunHiNeural';
    setVoiceParams(prev => ({ ...prev, voiceName: defaultVoice }));
    handleSave();
  };

  const handleVoiceRecommendation = async () => {
    if (!personality.trim()) {
      toast.error('성격을 먼저 입력해주세요.');
      return;
    }

    setIsRecommending(true);
    try {
      console.log('AI 음성 추천 시작 - 이름:', name, '성별:', gender, '성격:', personality);
      const result = await recommendVoicesWithAI(name, gender, personality);
      console.log('AI 음성 추천 결과:', result);
      console.log('선택된 목소리:', result.voiceParams.voiceName, '성별:', gender);

      setRecommendedVoices(result.recommendedVoices);
      setVoiceParams(result.voiceParams);
      setSampleTexts(result.sampleTexts);
      toast.success('AI가 최적의 음성을 추천했습니다!');
    } catch (error) {
      console.error('AI 음성 추천 중 오류:', error);
      toast.error('AI 음성 추천 중 오류가 발생했습니다.');
    } finally {
      setIsRecommending(false);
    }
  };

  // 추천 목소리 미리듣기
  const previewVoice = async (voiceName: string, index: number) => {
    setIsPlayingVoice(true);
    // AI가 생성한 샘플 텍스트를 우선 사용, 없으면 기본 인사말 사용
    const previewText = sampleTexts[index] || `안녕하세요, 저는 ${name || 'AI 비서'}입니다. ${personality} 성격을 가지고 있어요.`;

    try {
      const response = await fetch('http://localhost:5003/test-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: previewText,
          voice: voiceName,
          rate: voiceParams.rate * 10, // -10% ~ +10% 범위로 변환
          pitch: (voiceParams.pitch - 1) * 50, // -50Hz ~ +50Hz 범위로 변환
        }),
      });

      if (!response.ok) {
        throw new Error('TTS API 호출 실패');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '음성 생성 실패');
      }

      const audioBuffer = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsPlayingVoice(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsPlayingVoice(false);
        toast.error('음성 재생에 실패했습니다.');
      };
      audio.play();

    } catch (error) {
      console.error('TTS 서버 오류, Web Speech API로 폴백:', error);

      // Web Speech API 폴백
      if ('speechSynthesis' in window) {
        try {
          const utterance = new SpeechSynthesisUtterance(previewText);
          utterance.rate = voiceParams.rate; // Web Speech API는 0.1 ~ 10 범위
          utterance.pitch = voiceParams.pitch; // Web Speech API는 0 ~ 2 범위

          utterance.onend = () => setIsPlayingVoice(false);
          utterance.onerror = () => {
            setIsPlayingVoice(false);
            toast.error('음성 재생 실패');
          };

          window.speechSynthesis.speak(utterance);
        } catch (speechError) {
          console.error('Web Speech API도 실패:', speechError);
          setIsPlayingVoice(false);
          toast.error('음성 테스트를 사용할 수 없습니다.');
        }
      } else {
        setIsPlayingVoice(false);
        toast.error('음성 테스트를 사용할 수 없습니다.');
      }
    }
  };

  // 추천 목소리 선택
  const selectRecommendedVoice = (voiceName: string) => {
    setVoiceParams(prev => ({ ...prev, voiceName }));
    toast.success('목소리가 선택되었습니다!');
  };

  const testVoice = async () => {
    if (!personality.trim()) {
      toast.error('먼저 성격을 입력해주세요.');
      return;
    }

    setIsPlayingVoice(true);
    // AI가 생성한 샘플 텍스트를 사용하거나, 기본 텍스트 사용
    const testText = sampleTexts[0] || `안녕하세요, 저는 ${name || 'AI 비서'}입니다. ${personality} 성격을 가지고 있어요.`;

    try {
      // 로컬 테스트용 Flask 서버 API 호출
      const response = await fetch('http://localhost:5003/test-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: testText,
          voice: voiceParams.voiceName || 'ko-KR-SunHiNeural', // 선택된 목소리 사용
          rate: voiceParams.rate * 10, // -10% ~ +10% 범위로 변환
          pitch: (voiceParams.pitch - 1) * 50, // -50Hz ~ +50Hz 범위로 변환
        }),
      });

      if (!response.ok) {
        throw new Error('TTS API 호출 실패');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || '음성 생성 실패');
      }

      const audioBuffer = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      const audio = new Audio(audioUrl);
      audio.onended = () => {
        setIsPlayingVoice(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsPlayingVoice(false);
        URL.revokeObjectURL(audioUrl);
        toast.error('음성 재생에 실패했습니다.');
      };

      await audio.play();

    } catch (error) {
      console.error('TTS 서버 오류, Web Speech API로 폴백:', error);

      // Web Speech API 폴백
      if ('speechSynthesis' in window) {
        try {
          const utterance = new SpeechSynthesisUtterance(testText);
          utterance.rate = voiceParams.rate; // Web Speech API는 0.1 ~ 10 범위
          utterance.pitch = voiceParams.pitch; // Web Speech API는 0 ~ 2 범위

          utterance.onend = () => setIsPlayingVoice(false);
          utterance.onerror = () => {
            setIsPlayingVoice(false);
            toast.error('음성 재생 실패');
          };

          window.speechSynthesis.speak(utterance);
        } catch (speechError) {
          console.error('Web Speech API도 실패:', speechError);
          setIsPlayingVoice(false);
          toast.error('음성 테스트를 사용할 수 없습니다.');
        }
      } else {
        setIsPlayingVoice(false);
        toast.error('음성 테스트를 사용할 수 없습니다.');
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !personality.trim()) {
      toast.error('이름과 성격을 모두 입력해주세요.');
      return;
    }

    const secretaryData: SecretaryCreationData = {
      name: name.trim(),
      gender,
      personality: personality.trim(),
      imageUrl: imageUrl || '/images/Avatar/avatar1.svg', // 기본 아바타 설정
      voiceParams,
    };

    try {
      console.log('AI 비서 저장 시작:', secretaryData);
      console.log('저장할 voiceParams:', voiceParams);
      console.log('선택된 목소리:', voiceParams.voiceName, '성별:', gender);
      const savedSecretary = await saveAISecretary(secretaryData);
      console.log('AI 비서 저장 성공:', savedSecretary);
      console.log('저장된 비서의 voiceParams:', savedSecretary.voiceParams);

      if (editingSecretary) {
        // 편집 모드: 기존 비서 업데이트 (현재는 새로 저장)
        toast.success('AI 비서가 성공적으로 수정되었습니다!');
      } else {
        toast.success('AI 비서가 성공적으로 생성되었습니다!');
      }

      // 초기화
      setName('');
      setGender('female');
      setPersonality('');
      setVoiceParams({ rate: 1, pitch: 1, voiceName: 'ko-KR-SunHiNeural' });
      setRecommendedVoices([]);
      setSampleTexts([]);

      // onClose 콜백 호출
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('AI 비서 저장 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.error(`AI 비서 생성에 실패했습니다: ${errorMessage}`);
    }
  };

  const isValid = !!(name.trim() && personality.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              AI 비서 생성기
            </span>
          </div>

          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            {editingSecretary ? '비서 정보 수정' : '나만의 AI 비서 만들기'}
          </h1>

          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {editingSecretary
              ? 'AI 비서의 정보를 수정하여 더 완벽하게 만들어 보세요'
              : '이름, 성격, 목소리까지 자유롭게 설정하여 나만의 AI 비서를 만들어보세요'
            }
          </p>
        </div>

        {/* Main Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-8">
            {/* Step Indicator */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center space-x-4">
                {[
                  { step: 'basic', label: '기본정보', number: 1 },
                  { step: 'image', label: '이미지', number: 2 },
                  { step: 'voice', label: '목소리', number: 3 }
                ].map(({ step, label, number }) => (
                  <React.Fragment key={step}>
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                      currentStep === step
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : number < (currentStep === 'basic' ? 1 : currentStep === 'image' ? 2 : 3)
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 text-gray-400'
                    }`}>
                      {number < (currentStep === 'basic' ? 1 : currentStep === 'image' ? 2 : 3) ? (
                        <span className="text-sm">✓</span>
                      ) : (
                        <span className="text-sm font-medium">{number}</span>
                      )}
                    </div>
                    {number < 3 && (
                      <div className={`w-12 h-0.5 ${
                        number < (currentStep === 'basic' ? 1 : currentStep === 'image' ? 2 : 3)
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Step Content */}
            <div className="min-h-[400px]">
              {currentStep === 'basic' && (
                <BasicInfoStep
                  name={name}
                  setName={setName}
                  gender={gender}
                  setGender={setGender}
                  personality={personality}
                  setPersonality={setPersonality}
                  onNext={handleNextStep}
                  isValid={isValid}
                />
              )}

              {currentStep === 'image' && (
                <ImageStep
                  imageUrl={imageUrl}
                  setImageUrl={setImageUrl}
                  onNext={handleNextStep}
                  onPrev={handlePrevStep}
                  imageMode={imageMode}
                  setImageMode={setImageMode}
                />
              )}

              {currentStep === 'voice' && (
                <VoiceStep
                  name={name}
                  personality={personality}
                  voiceParams={voiceParams}
                  setVoiceParams={setVoiceParams}
                  recommendedVoices={recommendedVoices}
                  isPlayingVoice={isPlayingVoice}
                  isRecommending={isRecommending}
                  sampleTexts={sampleTexts}
                  onVoiceRecommendation={handleVoiceRecommendation}
                  onSelectRecommendedVoice={selectRecommendedVoice}
                  onTestVoice={testVoice}
                  onPrev={handlePrevStep}
                  onSave={handleSave}
                  onSkip={handleSkipVoice}
                  gender={gender}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISecretaryCreator;