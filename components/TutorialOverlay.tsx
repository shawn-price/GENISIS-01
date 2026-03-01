import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Volume2, VolumeX, HelpCircle, Sparkles } from 'lucide-react';
import { TutorialTip } from '../types';
import { GoogleGenAI, Modality } from "@google/genai";

interface TutorialOverlayProps {
  tips: TutorialTip[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  isTtsActive: boolean;
  onToggleTts: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ 
  tips, currentIndex, onNext, onPrev, onClose, isTtsActive, onToggleTts 
}) => {
  const currentTip = tips[currentIndex];
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const speakTip = async () => {
    if (!isTtsActive || !currentTip) return;
    
    setIsSpeaking(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say clearly and helpfully: ${currentTip.title}. ${currentTip.content}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        }
        
        const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
        const buffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
        
        if (audioSourceRef.current) {
          audioSourceRef.current.stop();
        }
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
        audioSourceRef.current = source;
      }
    } catch (err) {
      console.error("TTS Error:", err);
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    if (isTtsActive) {
      speakTip();
    } else {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            setIsSpeaking(false);
        }
    }
  }, [currentIndex, isTtsActive]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={onClose} />
      
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 md:p-8 pointer-events-auto animate-in zoom-in-95 duration-300">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-2xl">
            <HelpCircle size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">System Tutorial</h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest">Step {currentIndex + 1} of {tips.length}</p>
          </div>
        </div>

        <div className="min-h-[120px] mb-8">
          <h3 className="text-lg font-semibold text-indigo-300 mb-2">{currentTip.title}</h3>
          <p className="text-slate-300 leading-relaxed">{currentTip.content}</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={onToggleTts}
              className={`p-3 rounded-2xl transition-all ${isTtsActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              title={isTtsActive ? "Mute Tutorial" : "Read Tutorial Aloud"}
            >
              {isTtsActive ? <Volume2 size={20} className={isSpeaking ? 'animate-pulse' : ''} /> : <VolumeX size={20} />}
            </button>
            {isTtsActive && isSpeaking && (
                <div className="flex gap-1">
                    <div className="w-1 h-3 bg-indigo-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-4 bg-indigo-500 animate-bounce" style={{ animationDelay: '100ms' }} />
                    <div className="w-1 h-2 bg-indigo-500 animate-bounce" style={{ animationDelay: '200ms' }} />
                </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={onPrev}
              disabled={currentIndex === 0}
              className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={onNext}
              disabled={currentIndex === tips.length - 1}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20 transition-all"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800 rounded-b-3xl overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / tips.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
