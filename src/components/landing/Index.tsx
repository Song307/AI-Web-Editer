import React from 'react';
import { PageHeader } from './PageHeader';
import Hero from './Hero';
import ReadWriteSection from './ReadWriteSection';
import FeatureCarousel from './FeatureCarousel';
import FeatureGridSection from './FeatureGridSection';
import CTASection from './CTASection';
import Footer from './Footer';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader />
      <Hero />
      <ReadWriteSection />
      <FeatureCarousel />
  <FeatureGridSection />
      <CTASection />
      <Footer />
    </div>
  );
};

export default Index;
