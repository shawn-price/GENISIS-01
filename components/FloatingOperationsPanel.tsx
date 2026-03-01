import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Scaling, Droplet, AlignCenter, Palette, Mic, Loader2, Sparkles, Image as ImageIcon, Maximize, Sun, Scissors, Wand2, GripHorizontal } from 'lucide-react';
import { CanvasElement, CANVAS_SIZE, ElementType } from '../types';
import { useDraggable } from '../hooks/useDraggable';

interface FloatingOperationsPanelProps {
  selectedElements: CanvasElement[];
  onDelete: () => void;
  onUpdate: (id: string, updates: Partial<CanvasElement>) => void;
  onVoiceCommand: (audioBlob: Blob) => void;
  isProcessing: boolean;
  zoom: number;
  pan: { x: number; y: number };
  onEnhance: (targetId: string, type: string, instruction: string) => void;
  layout?: 'floating' | 'stack';
}

const FloatingOperationsPanel: React.FC<FloatingOperationsPanelProps> = ({
  selectedElements,
  onDelete,
  onUpdate,
  onVoiceCommand,
  isProcessing,
  zoom,
  pan,
  onEnhance,
  layout = 'floating'
}) => {
  const [activeControl, setActiveControl] = useState<'scale' | 'opacity' | 'color' | 'refine' | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  // Calculate initial position
  const getInitialPos = () => {
    if (selectedElements.length === 0) return { x: 0, y: 0 };
    const minX = Math.min(...selectedElements.map(el => el.x));
    const minY = Math.min(...selectedElements.map(el => el.y));
    const maxX = Math.max(...selectedElements.map(el => el.x + el.width));
    const width = maxX - minX;
    const centerX = minX + width / 2;
    const rawScreenX = centerX * zoom + pan.x;
    const rawScreenY = minY * zoom + pan.y;
    const panelWidth = 260;
    const margin = 20;
    const screenX = Math.min(Math.max(rawScreenX, panelWidth / 2 + margin), window.innerWidth - panelWidth / 2 - margin);
    let screenY = rawScreenY - 80;
    if (screenY < margin) {
        const elementBottomScreenY = (minY + Math.max(...selectedElements.map(el => el.height))) * zoom + pan.y;
        screenY = elementBottomScreenY + 20;
    }
    return { x: screenX, y: screenY };
  };

  const { pos, setPos, onMouseDown, isDragging } = useDraggable(getInitialPos());

  // Reset position when selection changes
  useEffect(() => {
    if (selectedElements.length > 0) {
        setPos(getInitialPos());
    }
  }, [selectedElements.map(e => e.id).join(',')]);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Audio recording is not supported in this browser or requires a secure context (HTTPS).");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); 
        onVoiceCommand(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) { 
        console.error("Mic error:", err); 
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('Permission denied')) {
            alert("Microphone permission was denied. Please allow microphone access in your browser address bar.");
        } else {
            alert(`Microphone error: ${err.message || 'Unknown error'}`);
        }
    }
  };

  const stopRecording = () => { 
      if (mediaRecorderRef.current && isRecording) { 
          mediaRecorderRef.current.stop(); 
          setIsRecording(false); 
      } 
  };

  const isStack = layout === 'stack';

  if (selectedElements.length === 0 && !isStack) return null;

  const primaryElement = selectedElements[0];

  // Calculate bounding box of selection ONLY if elements are selected
  let minX = 0, minY = 0, maxX = 0, centerX = 0, rawScreenX = 0, rawScreenY = 0, screenX = 0, screenY = 0;
  
  if (selectedElements.length > 0) {
      minX = Math.min(...selectedElements.map(el => el.x));
      minY = Math.min(...selectedElements.map(el => el.y));
      maxX = Math.max(...selectedElements.map(el => el.x + el.width));
      
      const width = maxX - minX;
      centerX = minX + width / 2;
      
      // Transform to screen space
      rawScreenX = centerX * zoom + pan.x;
      rawScreenY = minY * zoom + pan.y;

      // Clamping Logic
      const panelWidth = 260; // Increased width for mic button
      const margin = 20;

      // Keep X within screen bounds
      screenX = Math.min(Math.max(rawScreenX, panelWidth / 2 + margin), windowSize.width - panelWidth / 2 - margin);
      
      // Keep Y within screen bounds. Prefer top, flip to bottom if too high.
      screenY = rawScreenY - 80;
      if (screenY < margin) {
          // Flip to bottom of selection if top is clipped
          const elementBottomScreenY = (minY + Math.max(...selectedElements.map(el => el.height))) * zoom + pan.y;
          screenY = elementBottomScreenY + 20;
      }
  }

  const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!primaryElement) return;
    const scaleFactor = parseFloat(e.target.value);
    const newWidth = scaleFactor;
    const aspect = primaryElement.height / primaryElement.width;
    
    onUpdate(primaryElement.id, {
        width: newWidth,
        height: newWidth * aspect
    });
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!primaryElement) return;
      onUpdate(primaryElement.id, { opacity: parseFloat(e.target.value) });
  };

  const handleAlignCenter = () => {
    selectedElements.forEach(el => {
        onUpdate(el.id, {
            x: CANVAS_SIZE.width / 2 - el.width / 2,
            y: CANVAS_SIZE.height / 2 - el.height / 2
        });
    });
  };

  const handleColorChange = (color: string) => {
    selectedElements.forEach(el => {
        if (el.type === ElementType.TEXT) {
             onUpdate(el.id, { style: { ...el.style, color: color } });
        } else {
             onUpdate(el.id, { style: { ...el.style, backgroundColor: color } });
        }
    });
  };

  const getCurrentColor = () => {
      if (!primaryElement) return '#cbd5e1';
      if (primaryElement.type === ElementType.TEXT) {
          return primaryElement.style?.color || '#ffffff';
      }
      return primaryElement.style?.backgroundColor || '#cbd5e1';
  }

  const PRESET_COLORS = [
      '#0f172a', '#334155', '#475569', '#94a3b8', '#cbd5e1', '#f8fafc', '#ffffff', 
      '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', 
      '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e' 
  ];

  return (
    <div 
        className={`
            ${isStack 
              ? 'absolute top-0 left-16 right-80 h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center px-4 z-10 transition-all duration-300' 
              : `absolute z-[25] flex flex-col items-center gap-2 transition-all duration-100 ease-out ${isDragging ? 'cursor-grabbing opacity-80 scale-105' : 'cursor-default'}`
            }
        `}
        style={isStack ? {} : {
            left: pos.x,
            top: pos.y,
            transform: 'translateX(-50%)'
        }}
    >
        {/* Drag Handle */}
        {!isStack && (
            <div 
                onMouseDown={onMouseDown}
                className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full cursor-grab hover:bg-slate-400 transition-colors mb-1"
            />
        )}
        
        {/* Main Toolbar */}
        <div className={`flex items-center justify-center flex-wrap gap-1 ${isStack ? '' : 'p-1.5 bg-white dark:bg-slate-800 rounded-2xl md:rounded-full shadow-xl border border-slate-200 dark:border-slate-700 animate-in zoom-in duration-200 max-w-[calc(100vw-32px)]'}`}>
            
            {/* NLP Microphone Button */}
            <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing || !primaryElement}
                className={`
                    p-2 rounded-full transition-colors flex items-center justify-center
                    ${isRecording 
                        ? 'bg-red-500 text-white animate-pulse shadow-red-500/30 shadow-lg' 
                        : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                    }
                    ${isProcessing || !primaryElement ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title="Edit with Voice (AI)"
            >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
            </button>

            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />

            <button 
                onClick={handleAlignCenter}
                disabled={!primaryElement}
                className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Align to Center of Artboard"
            >
                <AlignCenter size={18} />
            </button>

            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />

            <button 
                onClick={() => setActiveControl(activeControl === 'color' ? null : 'color')}
                disabled={!primaryElement}
                className={`p-2 rounded-full transition-colors ${activeControl === 'color' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Color"
            >
                <Palette size={18} />
            </button>

            <button 
                onClick={() => setActiveControl(activeControl === 'scale' ? null : 'scale')}
                disabled={!primaryElement}
                className={`p-2 rounded-full transition-colors ${activeControl === 'scale' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Scale"
            >
                <Scaling size={18} />
            </button>

            <button 
                onClick={() => setActiveControl(activeControl === 'opacity' ? null : 'opacity')}
                disabled={!primaryElement}
                className={`p-2 rounded-full transition-colors ${activeControl === 'opacity' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Opacity"
            >
                <Droplet size={18} />
            </button>

            {primaryElement?.type === ElementType.IMAGE && (
                <>
                    <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />
                    <button 
                        onClick={() => setActiveControl(activeControl === 'refine' ? null : 'refine')}
                        disabled={!primaryElement}
                        className={`p-2 rounded-full transition-colors ${activeControl === 'refine' ? 'bg-indigo-600 text-white' : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        title="AI Refinement"
                    >
                        <Sparkles size={18} />
                    </button>
                </>
            )}

            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1" />

            <button 
                onClick={onDelete}
                disabled={!primaryElement}
                className="p-2 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete"
            >
                <Trash2 size={18} />
            </button>
        </div>

        {/* Pop-out Sliders */}
        {activeControl === 'opacity' && primaryElement && (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 w-48">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Opacity</span>
                    <span>{(primaryElement.opacity * 100).toFixed(0)}%</span>
                </div>
                <div className="relative h-6 flex items-center">
                    {/* Nozzle Visual Metaphor */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${primaryElement.opacity * 100}%` }} />
                    </div>
                    <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.01" 
                        value={primaryElement.opacity} 
                        onChange={handleOpacityChange}
                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                    <div 
                        className="pointer-events-none absolute w-4 h-4 bg-white border-2 border-indigo-500 rounded-full shadow transition-all"
                        style={{ left: `calc(${primaryElement.opacity * 100}% - 8px)` }}
                    />
                </div>
            </div>
        )}

        {activeControl === 'scale' && primaryElement && (
             <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 w-48">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Size</span>
                    <span>{Math.round(primaryElement.width)}px</span>
                </div>
                <input 
                    type="range" 
                    min="10" 
                    max="1000" 
                    value={primaryElement.width} 
                    onChange={handleScaleChange}
                    className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
            </div>
        )}

        {activeControl === 'color' && primaryElement && (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 grid grid-cols-7 gap-2">
                {PRESET_COLORS.map(color => (
                    <button
                        key={color}
                        onClick={() => handleColorChange(color)}
                        className={`w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm transition-transform hover:scale-110 ${getCurrentColor() === color ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-800' : ''}`}
                        style={{ backgroundColor: color }}
                        title={color}
                    />
                ))}
                <label className="w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center cursor-pointer hover:scale-110 relative overflow-hidden bg-gradient-to-br from-red-500 via-green-500 to-blue-500" title="Custom Color">
                    <input 
                        type="color" 
                        value={getCurrentColor()}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                </label>
            </div>
        )}

        {activeControl === 'refine' && (
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-bottom-2 w-48 flex flex-col gap-1">
                <button onClick={() => onEnhance(primaryElement.id, 'RELIGHT', 'Make the lighting more dramatic')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 transition-colors text-left">
                    <Sun size={14} className="text-amber-500" /> AI Relighting
                </button>
                <button onClick={() => onEnhance(primaryElement.id, 'UPSCALER', 'Upscale to 4K')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 transition-colors text-left">
                    <Maximize size={14} className="text-blue-500" /> Neural Upscaler
                </button>
                <button onClick={() => onEnhance(primaryElement.id, 'STYLE_TRANSFER', 'Apply oil painting style')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 transition-colors text-left">
                    <Wand2 size={14} className="text-purple-500" /> Style Transfer
                </button>
                <button onClick={() => onEnhance(primaryElement.id, 'ISOLATION', 'Remove background')} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 transition-colors text-left">
                    <Scissors size={14} className="text-emerald-500" /> Subject Isolation
                </button>
            </div>
        )}
    </div>
  );
};

export default FloatingOperationsPanel;