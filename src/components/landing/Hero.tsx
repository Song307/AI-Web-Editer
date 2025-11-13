import { ArrowDown } from "lucide-react";
import TypewriterText from "./TypewriterText";

const Hero = () => {
  return (
    <section id="hero-section" className="px-6 min-h-screen flex flex-col bg-[#FBFBFB] border-b border-[#dddddd] dark:bg-slate-900 dark:border-slate-700">
      <div className="flex-grow flex items-center">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-6xl md:text-7xl font-light text-foreground mb-8 leading-tight animate-fade-up">
            Toolix
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-16 max-w-2xl mx-auto leading-relaxed font-light animate-fade-in min-h-[2.5rem] md:min-h-[3rem] flex items-center justify-center">
            <TypewriterText
              texts={[
                "복잡함은 빼고, 본질만 남겼습니다.",
                "오직 당신의 생각에 집중하세요.",
                "작업의 피로도를 최소화하세요.",
              ]}
            />
          </p>
        </div>
      </div>
      <div className="py-8 animate-fade-in">
        <ArrowDown className="mx-auto text-muted-foreground animate-bounce" size={24} />
      </div>
    </section>
  );
};

export default Hero;
