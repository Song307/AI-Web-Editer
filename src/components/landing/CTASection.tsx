import { Download, Apple, Github } from "lucide-react";
import { useNavigate } from 'react-router-dom';

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-32 px-6">
      <div className="container mx-auto max-w-4xl text-center">
        <h2 className="text-5xl font-light text-foreground mb-12">
          Toolix를 원하시나요?
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-8 py-3 bg-foreground text-background rounded-md hover:opacity-90 transition-opacity text-base font-medium flex items-center gap-2"
          >
            시작하기
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          무료로 사용하세요. 개발을 지원하려면 라이선스를 구입하세요.
        </p>
      </div>
    </section>
  );
};

export default CTASection;
