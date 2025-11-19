import React from 'react';
import { AspectRatio } from '../ui/aspect-ratio';

const items = [
  {
    title: '실시간 렌더링',
    img: '/images/img/실시간렌더링.png',
    description: '편집하는 즉시 결과를 확인하세요. 입력과 출력이 동기화되어 실시간으로 렌더링됩니다.'
  },
  {
    title: '목차 생성',
    img: '/images/img/목차.png',
    description: '문서 구조를 자동으로 분석해 목차를 생성하고 내비게이션을 제공합니다.'
  },
  {
    title: '클립보드 관리',
    img: '/images/img/클립보드.png',
    description: '자주 쓰는 텍스트와 이미지, 파일을 클립보드에 저장해 빠르게 재사용하세요.'
  },
  {
    title: '응답 선택',
    img: '/images/img/응답선택.png',
    description: 'AI가 제시한 여러 응답 중 원하는 결과를 선택해 바로 적용할 수 있습니다.'
  },
  {
    title: '집중 모드',
    img: '/images/img/집중모드.png',
    description: '중복되는 UI를 숨기고 현재 작성 중인 블록에 집중할 수 있게 도와줍니다.'
  },
  {
    title: '추가 기능 예정',
    img: '/images/img/목차.png',
    description: '곧 추가될 기능입니다 — 임시 더미 데이터입니다. 나중에 실제 기능을 연결해주세요.'
  }
];

const FeatureCard: React.FC<{ title: string; description: string; img?: string }> = ({ title, description, img }) => {
  return (
    <div className="flex flex-col items-start">
      <AspectRatio ratio={16 / 9} className="w-full rounded-xl overflow-hidden shadow-lg border border-border mb-4">
        {img ? (
          <img src={img} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-white to-muted/30" />
        )}
      </AspectRatio>
      <h4 className="text-lg font-semibold text-foreground mb-2">{title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
};

const FeatureGridSection: React.FC = () => {
  return (
    <section className="py-16 bg-white">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-medium text-foreground mb-4">필요한 모든 것</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {items.map((it, idx) => (
            <FeatureCard key={idx} title={it.title} description={it.description} img={it.img} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureGridSection;
