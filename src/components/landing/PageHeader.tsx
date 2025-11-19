import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

// Animation hook
const useSlideAnimation = (isVisible: boolean) => {
  const [shouldRender, setRender] = useState(isVisible);
  const [animationClass, setAnimationClass] = useState('');
  const prevIsVisible = useRef<boolean>(isVisible);

  useEffect(() => {
    // Update the previous value
    prevIsVisible.current = isVisible;
    
    if (isVisible) {
      setRender(true);
      // Force reflow to ensure the element is rendered before applying the animation
      requestAnimationFrame(() => {
        setAnimationClass('animate-slide-down');
      });
    } else {
      setAnimationClass('animate-slide-up');
      const timer = setTimeout(() => {
        if (!prevIsVisible.current) {
          setRender(false);
        }
      }, 300); // Match this with the CSS animation duration
      
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  return { shouldRender, animationClass };
};

export const PageHeader = () => {
  const [scrolled, setScrolled] = useState(false);
  const [shouldShowHeader, setShouldShowHeader] = useState(false);
  const { shouldRender, animationClass } = useSlideAnimation(shouldShowHeader);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      // Check if scrolled past the ReadWriteSection
      const readWriteSection = document.getElementById('read-write');
      if (readWriteSection) {
        const readWriteRect = readWriteSection.getBoundingClientRect();
        // Show header when ReadWriteSection starts entering the viewport
        setShouldShowHeader(readWriteRect.top <= 0);
      }
      setScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      navigate('/landing');
    } catch (err) {
      console.error('로그아웃 실패', err);
    }
  };

  // Add animation styles to the document head
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideDown {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
      @keyframes slideUp {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(-100%);
          opacity: 0;
        }
      }
      .animate-slide-down {
        animation: slideDown 0.3s ease-out forwards;
      }
      .animate-slide-up {
        animation: slideUp 0.3s ease-out forwards;
      }
    `;
    document.head.appendChild(style);
    
    // Return cleanup function
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 transform transition-transform duration-300 ${
        scrolled 
          ? 'bg-background/95 backdrop-blur-sm border-b border-border/40 shadow-sm py-2' 
          : 'bg-background/80 py-4'
      } ${animationClass}`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-xl font-light text-foreground">Toolix</span>
          </Link>
          
          <nav className="hidden md:flex items-center space-x-8">
            <a 
              href="#features" 
              className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              기능 소개
            </a>
            <a 
              href="#read-write" 
              className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              읽기/쓰기
            </a>
            <a 
              href="#contact" 
              className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              문의하기
            </a>
          </nav>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
              >
                로그아웃
              </button>
            ) : (
              <Link to="/login" className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors">
                로그인
              </Link>
            )}
            <button className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
              시작하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
