import { useState, useCallback } from "react";
import { Carousel, CarouselContent, CarouselItem } from "../../components/ui/carousel";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { Image, Type, Table, Code, Calculator, Palette } from "react-bootstrap-icons";

const features = [
  {
    id: "images",
    title: "이미지",
    description: "이미지 삽입 및 관리",
    icon: <Image className="h-12 w-12 text-primary" />
  },
  {
    id: "headers",
    title: "헤더",
    description: "제목 및 부제목 스타일",
    icon: <Type className="h-12 w-12 text-primary" />
  },
  {
    id: "formatting",
    title: "기울기",
    description: "텍스트 서식 지정",
    icon: <Palette className="h-12 w-12 text-primary" />
  },
  {
    id: "tables",
    title: "테이블",
    description: "표 생성 및 편집",
    icon: <Table className="h-12 w-12 text-primary" />
  },
  {
    id: "code",
    title: "코드",
    description: "코드 블록 및 강조",
    icon: <Code className="h-12 w-12 text-primary" />
  },
  {
    id: "math",
    title: "수학",
    description: "수식 편집기",
    icon: <Calculator className="h-12 w-12 text-primary" />
  }
];

const FeatureCarousel = () => {
  const [api, setApi] = useState<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollTo = useCallback((index: number) => {
    if (api) {
      api.scrollTo(index);
    }
  }, [api]);

  const handleSelect = useCallback(() => {
    if (api) {
      setActiveIndex(api.selectedScrollSnap());
    }
  }, [api]);

  // Set up the API and event listener
  const handleApiInit = useCallback((api: any) => {
    setApi(api);
    api.on('select', handleSelect);
    return () => {
      api.off('select', handleSelect);
    };
  }, [handleSelect]);

  return (
    <section className="py-16 overflow-hidden" style={{ backgroundColor: '#FCFCFC' }}>
      <div className="w-full max-w-none px-0">
        
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-light text-foreground mb-4">
            간단하지만 강력함
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            이미지, 헤더, 기울기, 테이블, 코드 펜스, 수학, 다이어그램, 인라인 스타일 등..
          </p>
        </div>
        
        {/* Navigation Buttons */}
        <div className="flex flex-nowrap overflow-x-auto pb-6 mb-8 hide-scrollbar">
          <div className="flex space-x-2 mx-auto px-2">
            {features.map((feature, index) => (
              <Button
                key={feature.id}
                variant="ghost"
                className={cn(
                  "relative px-4 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap",
                  "hover:text-foreground focus:outline-none group",
                  activeIndex === index 
                    ? "text-foreground" 
                    : "text-muted-foreground hover:text-foreground/80"
                )}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                }}
                onClick={() => scrollTo(index)}
              >
                <span className="relative">
                  {feature.title}
                  <span 
                    className={cn(
                      "absolute -bottom-1 left-0 w-full h-0.5 bg-primary transition-all duration-300",
                      activeIndex === index ? "scale-100 opacity-100" : "scale-0 opacity-0"
                    )}
                  />
                </span>
              </Button>
            ))}
          </div>
        </div>
        
        {/* Carousel */}
        <div className="relative w-full py-8 -my-8">
          <Carousel 
            className="w-full touch-pan-x select-none"
            setApi={handleApiInit}
            opts={{
              align: 'center',
              loop: true,
              startIndex: 0,
              slidesToScroll: 1,
              containScroll: 'keepSnaps',
              dragFree: true,
              watchDrag: true,
              skipSnaps: false,
              duration: 30,
              axis: 'x',
              inViewThreshold: 0.5
            }}
          >
            <CarouselContent className="pb-8">
              {features.map((feature, index) => (
                <CarouselItem key={feature.id} className="basis-auto">
                  <div className="flex justify-center px-8 pb-12 select-none">
                    <div className="w-[400px] h-[300px] rounded-xl overflow-hidden shadow-2xl select-none bg-card border border-border" style={{ userSelect: 'none' }}>
                      <div className="w-full h-full flex flex-col items-center justify-center p-8">
                        <div className="mb-6">
                          {feature.icon}
                        </div>
                        <h3 className="text-2xl font-bold text-foreground mb-4 text-center">
                          {feature.title}
                        </h3>
                        <p className="text-muted-foreground text-center leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </div>
    </section>
  );
};

export default FeatureCarousel;
