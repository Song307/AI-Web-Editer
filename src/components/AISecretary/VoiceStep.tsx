import React from 'react';
import { Play, Pause, Stars } from 'react-bootstrap-icons';
import { VoiceStepProps } from './types';
import { VoiceParams } from '../../utils/db';

const getVoiceDisplayName = (voiceName: string): string => {
  const displayNames: { [key: string]: string } = {
    'ko-KR-InJoonNeural': '인준 (남성, 젊고 친근)',
    'ko-KR-BongJinNeural': '봉진 (남성, 중후하고 안정적)',
    'ko-KR-GookMinNeural': '국민 (남성, 명랑하고 활기)',
    'ko-KR-HyunsuNeural': '현수 (남성, 차분하고 전문적)',
    'ko-KR-HyunsuMultilingualNeural': '현수 다국어 (남성)',
    'ko-KR-SunHiNeural': '선희 (여성, 밝고 다정)',
    'ko-KR-YuJinNeural': '유진 (여성, 젊고 명랑)',
    'ko-KR-JiMinNeural': '지민 (여성, 차분하고 우아)',
    'ko-KR-SeoHyeonNeural': '서현 (여성, 전문적이고 자신감)',
    'ko-KR-SoonBokNeural': '순복 (여성, 따뜻하고 성숙)',
  };
  return displayNames[voiceName] || voiceName;
};

const VoiceStep: React.FC<VoiceStepProps> = ({
  name,
  personality,
  voiceParams,
  setVoiceParams,
  recommendedVoices,
  isPlayingVoice,
  isRecommending,
  sampleTexts,
  onVoiceRecommendation,
  onSelectRecommendedVoice,
  onTestVoice,
  onPrev,
  onSave,
  onSkip,
  gender
}) => {
  const [currentPlayingIndex, setCurrentPlayingIndex] = React.useState<number | null>(null);

  const handlePreviewVoice = (voiceName: string, index: number) => {
    setCurrentPlayingIndex(index);
    onSelectRecommendedVoice(voiceName);
    onTestVoice();
    setTimeout(() => setCurrentPlayingIndex(null), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <Stars className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base text-purple-900 dark:text-purple-100 mb-1">
              AI 목소리 추천
            </h3>
            <p className="text-xs text-purple-700 dark:text-purple-300">
              이름, 성별, 성격을 분석하여 3가지 목소리를 추천합니다
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onVoiceRecommendation}
        disabled={isRecommending || !personality.trim()}
        className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-semibold transition-all disabled:cursor-not-allowed text-sm"
      >
        {isRecommending ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>AI 분석 중...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Stars className="w-4 h-4" />
            <span>AI 목소리 추천받기</span>
          </div>
        )}
      </button>

      {recommendedVoices.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            추천 목소리 ({gender === 'male' ? '남성' : '여성'})
          </h3>

          <div className="space-y-2">
            {recommendedVoices.map((voiceName, index) => {
              const isSelected = voiceParams.voiceName === voiceName;
              const isPlaying = isPlayingVoice && currentPlayingIndex === index;
              return (
                <div
                  key={voiceName}
                  className={`rounded-lg border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                  }`}
                  onClick={() => onSelectRecommendedVoice(voiceName)}
                >
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                          isSelected 
                            ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-semibold text-sm mb-0.5 ${
                            isSelected ? 'text-purple-900 dark:text-purple-100' : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {getVoiceDisplayName(voiceName)}
                          </h4>
                          {sampleTexts[index] && (
                            <p className={`text-xs italic line-clamp-1 ${
                              isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              "{sampleTexts[index]}"
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreviewVoice(voiceName, index);
                        }}
                        disabled={isPlaying}
                        className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                          isPlaying
                            ? 'bg-red-500 text-white'
                            : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700'
                        } disabled:opacity-50`}
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
          세부 조정
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">속도</label>
              <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{voiceParams.rate.toFixed(1)}x</span>
            </div>
            <input
              type="range" min="0.5" max="2.0" step="0.1" value={voiceParams.rate}
              onChange={(e) => setVoiceParams((prev: VoiceParams) => ({ ...prev, rate: parseFloat(e.target.value) }))}
              className="w-full h-2 bg-gradient-to-r from-blue-200 to-purple-200 dark:from-blue-800 dark:to-purple-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">톤</label>
              <span className="text-sm font-bold text-pink-600 dark:text-pink-400">{voiceParams.pitch.toFixed(1)}</span>
            </div>
            <input
              type="range" min="0.5" max="2.0" step="0.1" value={voiceParams.pitch}
              onChange={(e) => setVoiceParams((prev: VoiceParams) => ({ ...prev, pitch: parseFloat(e.target.value) }))}
              className="w-full h-2 bg-gradient-to-r from-pink-200 to-red-200 dark:from-pink-800 dark:to-red-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
        <button
          onClick={() => { setCurrentPlayingIndex(null); onTestVoice(); }}
          disabled={isPlayingVoice && currentPlayingIndex === null}
          className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
        >
          {isPlayingVoice && currentPlayingIndex === null ? (
            <><Pause className="w-4 h-4" />재생 중</>
          ) : (
            <><Play className="w-4 h-4" />테스트</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2">
        <button onClick={onPrev} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-all text-sm">
          ← 이전
        </button>
        <button onClick={onSkip} className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-lg font-medium transition-all text-sm">
          건너뛰기
        </button>
        <button onClick={onSave} className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white rounded-lg font-medium transition-all text-sm">
          완료 ✓
        </button>
      </div>
    </div>
  );
};

export default VoiceStep;
