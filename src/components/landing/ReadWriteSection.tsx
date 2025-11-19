import React from 'react';
import TypewriterText from './TypewriterText';
import { PencilSquare, Eye, Check2 } from 'react-bootstrap-icons';

const ReadWriteSection = () => {
  return (
    <section id="read-write" className="min-h-screen flex items-center justify-center pt-32 pb-20 bg-white">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row gap-12 items-center">
          <div className="md:w-1/2 space-y-8">
            <h2 className="text-[48px] font-light text-foreground mb-8 leading-tight animate-fade-up" style={{ animationDelay: '100ms' }}>
              AI 마크다운 에디터
            </h2>

            <div className="text-muted-foreground space-y-4 mb-8">
              <p className="text-xl leading-relaxed font-light">
                Toolix는 사용자에게 완벽한 경험을 제공합니다.
                마크업 기호, 클립보드, AI 어시스턴트 기능을 제공하며, 불필요한 모든 시각적 요소를 제거하여
                콘텐츠 자체에 집중할 수 있도록 실시간 미리보기 기능을 제공합니다.
              </p>
            </div>

            <ul className="space-y-4 pt-4">
              <li className="flex items-center text-foreground">
                <PencilSquare className="mr-3 h-5 w-5 text-muted-foreground" />
                Github Flavored Markdown 지원
              </li>
              <li className="flex items-center text-foreground">
                <Eye className="mr-3 h-5 w-5 text-muted-foreground" />
                실시간 라이브 미리보기
              </li>
              <li className="flex items-center text-foreground">
                <Check2 className="mr-3 h-5 w-5 text-muted-foreground" />
                AI 기반 콘텐츠 작성 지원
              </li>
            </ul>
          </div>

          <div className="md:w-1/2 flex justify-center w-full">
            <div className="w-full max-w-lg bg-card shadow-2xl rounded-lg overflow-hidden border border-border">
              <div className="p-3 bg-muted/50 border-b border-border flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="flex-grow text-center text-xs text-muted-foreground font-medium">
                  Untitled • Edited
                </span>
              </div>

              <div className="p-8">
                <h3 className="text-2xl font-bold mb-4 text-foreground">Toolix Editor</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Hello, Welcome to <span className="font-bold text-foreground">Toolix</span>, the new generation workspace with features of:
                </p>
                <div className="min-h-[60px]">
                  <TypewriterText
                    texts={[
                      "Github Flavored Markdown support and extra writing functions.",
                      "Real-time Live Preview without any distractions."
                    ]}
                    className="text-muted-foreground leading-relaxed"
                    typingSpeed={50}
                    deletingSpeed={30}
                    pauseDuration={500}
                    delay={0}
                    loop={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ReadWriteSection;