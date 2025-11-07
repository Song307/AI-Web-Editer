import React from 'react';
import { AspectRatio } from '../ui/aspect-ratio';

const items = [
  {
    title: '읽기 및 쓰기 가능',
    description:
      'Typoix는 독자와 작성자 모두에게 완벽한 경험을 제공합니다. 마크업 기호, 불필요한 모든 시각적 요소를 제거하여 콘텐츠 자체에 집중할 수 있도록 실시간 미리보기 기능을 제공합니다.'
  },
  {
    title: '완벽한 라이브 미리보기',
    description: '당신이 보는 것이 바로 당신이 의미하는 것입니다. 편집 중 실시간으로 결과를 확인하세요.'
  },
  {
    title: '방해 요소 없음',
    description: '콘텐츠 자체에 집중할 수 있도록 단순하고 깔끔한 UI를 제공합니다.'
  }
];

const FeatureCard: React.FC<{ title: string; description: string }> = ({ title, description }) => {
  return (
    <div className="flex flex-col items-start">
      <AspectRatio ratio={16 / 9} className="w-full rounded-xl overflow-hidden shadow-lg border border-border mb-4">
        <div className="w-full h-full bg-gradient-to-br from-white to-muted/30" />
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {items.map((it, idx) => (
            <FeatureCard key={idx} title={it.title} description={it.description} />
          ))}
        </div>

        {/* Second row: repeat same items to match 3x2 layout in the mock */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {items.map((it, idx) => (
            <FeatureCard key={`r2-${idx}`} title={it.title} description={it.description} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureGridSection;
