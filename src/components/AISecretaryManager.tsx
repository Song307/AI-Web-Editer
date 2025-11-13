import React, { useState, useEffect } from 'react';
import { Plus, Star, VolumeUp, Pencil, Trash } from 'react-bootstrap-icons';
import { getAllAISecretaries, deleteAISecretary, AISecretary } from '../utils/db';
import AISecretaryCreator from './AISecretaryCreator';
import toast from 'react-hot-toast';

const AISecretaryManager: React.FC = () => {
  const [secretaries, setSecretaries] = useState<AISecretary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);
  const [editingSecretary, setEditingSecretary] = useState<AISecretary | null>(null);

  // 성격 기반 말투 생성 (AISecretaryCreator와 동일한 로직)
  const generatePersonalityGreeting = (name: string, personality: string) => {
    const personalityLower = personality.toLowerCase();

    const formalGreetings = [
      `안녕하세요, 저는 ${name}입니다. 만나서 반갑습니다.`,
      `안녕하십니까, ${name}이라고 합니다. 잘 부탁드립니다.`,
      `처음 뵙겠습니다. 저는 ${name}입니다.`,
      `반갑습니다. ${name}이라고 합니다.`
    ];

    const brightGreetings = [
      `안녕하세요~ 저는 ${name}예요! 만나서 정말 반가워요!`,
      `하이~ ${name}이라고 해요! 잘 부탁해요!`,
      `안녕! 나는 ${name}야! 반갑다!`,
      `헤이~ ${name} 여기 있어! 만나서 기분 좋아!`
    ];

    const gentleGreetings = [
      `안녕하세요... 저는 ${name}입니다. 조용히 인사드려요.`,
      `부드럽게... ${name}이라고 합니다. 만나서 반가워요.`,
      `안녕하세요, 저는 ${name}예요. 따뜻하게 대해주세요.`,
      `조용히... ${name}입니다. 잘 부탁드려요.`
    ];

    const meticulousGreetings = [
      `정확하게 말씀드리자면, 저는 ${name}입니다. 만나서 반갑습니다.`,
      `꼼꼼하게 인사드리겠습니다. ${name}이라고 합니다.`,
      `안녕하세요. 저는 ${name}입니다. 모든 것이 완벽해야 하죠.`,
      `정중하게... ${name}입니다. 세심하게 대해주시길 바랍니다.`
    ];

    const uniqueGreetings = [
      `이상하게 인사해볼까? 나는 ${name}이야! 특별하지?`,
      `독특하게... ${name}이라고 해! 신비롭지 않아?`,
      `안녕? 나는 ${name}이야. 좀 이상한가?`,
      `특별하게 인사! ${name}입니다. 창의적이지?`
    ];

    const uncomfortableGreetings = [
      `...안녕하세요. 저는 ${name}입니다. 좀 불편한가요?`,
      `찜찜하게... ${name}이라고 합니다. 미안해요.`,
      `안녕... ${name}입니다. 불안하지 마세요.`,
      `걱정스럽게... ${name}입니다. 잘 대해주세요.`
    ];

    const formalKeywords = ['격식', '전문', '진중', '엄격', '엄숙', '품위', '고급', '엘리트', '클래식', '정중', '예의', '공손', '신뢰', '믿음', '안정', '책임', '성실', '근면'];
    const brightKeywords = ['밝', '명랑', '활발', '활기', '쾌활', '기운', '에너지', '생기', '활달', '경쾌', '상큼', '발랄', '유쾌', '즐겁', '재미', '흥미', '흥분', '열정'];
    const gentleKeywords = ['부드', '친근', '따뜻', '온화', '포근', '부드러운', '상냥', '다정', '친절', '친화', '친근감', '편안', '안락', '편안함', '아늑', '섬세', '배려', '공감'];
    const meticulousKeywords = ['깐깐', '까다', '철저', '꼼꼼', '세심', '정밀', '엄밀', '엄중', '엄정', '완벽', '완전', '완벽주의', '디테일', '세부', '정교'];
    const uniqueKeywords = ['이상', '특이', '독특', '괴짜', '기괴', '기이', '신비', '미스터리', '수수께끼', '불가사의', '괴상', '괴이', '기묘', '기발', '창의', '독창', '창조', '혁신'];
    const uncomfortableKeywords = ['찜찜', '불안', '걱정', '불편', '불쾌', '싫', '혐오', '거부', '거북', '불쾌감', '불편함', '불안감', '걱정거리', '염려', '근심'];

    if (formalKeywords.some(keyword => personalityLower.includes(keyword))) {
      return formalGreetings[Math.floor(Math.random() * formalGreetings.length)];
    } else if (brightKeywords.some(keyword => personalityLower.includes(keyword))) {
      return brightGreetings[Math.floor(Math.random() * brightGreetings.length)];
    } else if (gentleKeywords.some(keyword => personalityLower.includes(keyword))) {
      return gentleGreetings[Math.floor(Math.random() * gentleGreetings.length)];
    } else if (meticulousKeywords.some(keyword => personalityLower.includes(keyword))) {
      return meticulousGreetings[Math.floor(Math.random() * meticulousGreetings.length)];
    } else if (uniqueKeywords.some(keyword => personalityLower.includes(keyword))) {
      return uniqueGreetings[Math.floor(Math.random() * uniqueGreetings.length)];
    } else if (uncomfortableKeywords.some(keyword => personalityLower.includes(keyword))) {
      return uncomfortableGreetings[Math.floor(Math.random() * uncomfortableGreetings.length)];
    } else {
      const allGreetings = [...formalGreetings, ...brightGreetings, ...gentleGreetings];
      return allGreetings[Math.floor(Math.random() * allGreetings.length)];
    }
  };

  useEffect(() => {
    loadSecretaries();
  }, []);

  const loadSecretaries = async () => {
    try {
      setLoading(true);
      console.log('AI 비서 목록 불러오기 시작');

      const secs = await getAllAISecretaries();
      console.log('AI 비서 목록 불러오기 성공:', secs);
      console.log('각 비서의 이미지 URL:', secs.map(s => ({ name: s.name, imageUrl: s.imageUrl, hasImage: !!s.imageUrl })));
      console.log('각 비서의 목소리 설정:', secs.map(s => ({ name: s.name, voiceName: s.voiceParams.voiceName, gender: s.gender })));
      console.log('저장된 비서 데이터 구조:', secs[0]); // 첫 번째 비서의 전체 구조 확인

      // 이미지가 없는 비서들에게 기본 아바타 설정
      // 성별에 맞는 목소리가 아닌 경우 수정
      const secretariesWithDefaultImages = secs.map(secretary => {
        let correctedVoiceName = secretary.voiceParams.voiceName;

        // 남성인데 여성 목소리를 사용하는 경우 수정
        if (secretary.gender === 'male' && secretary.voiceParams.voiceName && !['ko-KR-InJoonNeural', 'ko-KR-BongJinNeural', 'ko-KR-GookMinNeural', 'ko-KR-HyunsuNeural', 'ko-KR-HyunsuMultilingualNeural'].includes(secretary.voiceParams.voiceName)) {
          correctedVoiceName = 'ko-KR-InJoonNeural';
          console.log(`남성 비서 ${secretary.name}의 목소리를 ${secretary.voiceParams.voiceName}에서 ${correctedVoiceName}으로 수정`);
        }
        // 여성인데 남성 목소리를 사용하는 경우 수정
        else if (secretary.gender === 'female' && secretary.voiceParams.voiceName && !['ko-KR-SunHiNeural', 'ko-KR-YuJinNeural', 'ko-KR-JiMinNeural', 'ko-KR-SeoHyeonNeural', 'ko-KR-SoonBokNeural'].includes(secretary.voiceParams.voiceName)) {
          correctedVoiceName = 'ko-KR-SunHiNeural';
          console.log(`여성 비서 ${secretary.name}의 목소리를 ${secretary.voiceParams.voiceName}에서 ${correctedVoiceName}으로 수정`);
        }

        return {
          ...secretary,
          imageUrl: secretary.imageUrl || '/images/Avatar/avatar1.svg',
          voiceParams: {
            ...secretary.voiceParams,
            voiceName: correctedVoiceName
          }
        };
      });

      setSecretaries(secretariesWithDefaultImages);
    } catch (error) {
      console.error('AI 비서 목록 불러오기 실패:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.error(`AI 비서 목록을 불러오는데 실패했습니다: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말로 이 AI 비서를 삭제하시겠습니까?')) {
      return;
    }

    try {
      console.log('AI 비서 삭제 시작, ID:', id);
      await deleteAISecretary(id);
      setSecretaries(secretaries.filter(s => s.id !== id));
      console.log('AI 비서 삭제 완료, ID:', id);
      toast.success('AI 비서가 삭제되었습니다.');
    } catch (error) {
      console.error('AI 비서 삭제 실패, ID:', id, '오류:', error);
      toast.error('AI 비서 삭제에 실패했습니다.');
    }
  };

  const handleTestVoice = async (secretary: AISecretary) => {
    const personalityGreeting = generatePersonalityGreeting(secretary.name, secretary.personality);
    const testText = personalityGreeting;

    console.log('음성 테스트 시작:', {
      name: secretary.name,
      personality: secretary.personality,
      voiceName: secretary.voiceParams.voiceName,
      gender: secretary.gender,
      testText: testText
    });

    try {

      const response = await fetch('http://localhost:5003/test-tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: testText,
          voice: secretary.voiceParams.voiceName || 'ko-KR-SunHiNeural',
          rate: secretary.voiceParams.rate * 10,
          pitch: (secretary.voiceParams.pitch - 1) * 50,
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
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        toast.error('음성 재생에 실패했습니다.');
      };

      await audio.play();
    } catch (error) {
      console.error('Voice test error:', error);

      // Web Speech API 폴백
      if ('speechSynthesis' in window) {
        try {
          const utterance = new SpeechSynthesisUtterance(testText);
          utterance.rate = secretary.voiceParams.rate;
          utterance.pitch = secretary.voiceParams.pitch;
          utterance.lang = 'ko-KR';
          speechSynthesis.speak(utterance);
        } catch (speechError) {
          console.error('Web Speech API도 실패:', speechError);
          toast.error('음성 테스트를 사용할 수 없습니다.');
        }
      } else {
        toast.error('음성 테스트를 사용할 수 없습니다.');
      }
    }
  };

  const handleEdit = (secretary: AISecretary) => {
    setEditingSecretary(secretary);
    setShowCreator(true);
  };

  const handleCreatorClose = () => {
    setShowCreator(false);
    setEditingSecretary(null);
    loadSecretaries(); // 목록 새로고침
  };

  if (showCreator) {
    return <AISecretaryCreator onClose={handleCreatorClose} editingSecretary={editingSecretary} />;
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">AI 비서 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 overflow-auto">
      {/* 미니멀 헤더 */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                AI 비서
              </h1>
              {secretaries.length > 0 && (
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-semibold">
                  {secretaries.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowCreator(true)}
              className="group flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full font-semibold shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105"
            >
              <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
              <span>새로 만들기</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {secretaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 blur-2xl opacity-20 rounded-full"></div>
              <div className="relative w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center transform rotate-3">
                <Star className="w-16 h-16 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">아직 비서가 없습니다</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">첫 번째 AI 비서를 만들어 시작해보세요</p>
            <button
              onClick={() => setShowCreator(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full font-semibold shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              <span>비서 생성하기</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {secretaries.map((secretary) => (
              <div
                key={secretary.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="relative flex-shrink-0">
                      <img
                        src={secretary.imageUrl || '/images/Avatar/avatar1.svg'}
                        alt={secretary.name}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-purple-200 dark:ring-purple-800 group-hover:ring-purple-400 transition-all"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/images/Avatar/avatar1.svg';
                        }}
                      />
                      <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full p-1">
                        <VolumeUp className="w-3 h-3" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base text-gray-900 dark:text-white mb-1 truncate">
                        {secretary.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {secretary.personality}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">
                      {secretary.gender === 'male' ? '남' : '여'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">
                      {secretary.voiceParams.rate.toFixed(1)}x
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">
                      {secretary.voiceParams.pitch.toFixed(1)}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTestVoice(secretary)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <VolumeUp className="w-3.5 h-3.5" />
                      테스트
                    </button>
                    <button
                      onClick={() => handleEdit(secretary)}
                      className="inline-flex items-center justify-center px-2 py-1.5 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(secretary.id)}
                      className="inline-flex items-center justify-center px-2 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AISecretaryManager;