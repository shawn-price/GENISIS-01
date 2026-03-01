import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // 0s: Mount
    // 3s: Start exit
    // 4s: Unmount
    const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onComplete, 1000);
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 transition-opacity duration-1000 ${isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
             <div 
                className="w-full h-full bg-cover bg-center animate-ken-burns opacity-50"
                style={{ 
                    // Using a placeholder that resembles the colorful eye art style
                    backgroundImage: 'url("https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=2400&auto=format&fit=crop")',
                }}
             />
             <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
             <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 to-transparent" />
        </div>

        {/* Branding Content */}
        <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-8">
                 <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-30 animate-pulse rounded-full" />
                 <div className="relative bg-gradient-to-br from-indigo-600 to-violet-700 w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl animate-bounce-slow border border-white/10">
                    <Sparkles className="text-white w-10 h-10" />
                 </div>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400 tracking-tight mb-4 animate-slide-up drop-shadow-sm">
                Genesis One
            </h1>
            
            <div className="flex items-center gap-3 animate-fade-in-delayed opacity-0" style={{ animationFillMode: 'forwards' }}>
                <div className="h-px w-8 bg-indigo-500/50" />
                <p className="text-indigo-200/80 text-sm tracking-[0.2em] uppercase font-medium">
                    Voice-Driven Design
                </p>
                <div className="h-px w-8 bg-indigo-500/50" />
            </div>
        </div>
        
        {/* Loading Indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
    </div>
  );
};