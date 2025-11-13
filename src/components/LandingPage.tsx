import { Toaster } from 'sonner';
import { TooltipProvider } from './ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from './landing/Index';

const queryClient = new QueryClient();

const LandingPage = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster position="top-center" />
      <Index />
    </TooltipProvider>
  </QueryClientProvider>
);

export default LandingPage;
