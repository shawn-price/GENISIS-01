import React from 'react';
import { Sparkles, Scissors, Filter, Layers, Zap, Maximize, Sun, Move, Palette, Trash2, Wand2, Frame, Grid, GripVertical, X } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';

interface AISuitePanelProps {
  onAction: (action: any, params?: any) => void;
  isProcessing: boolean;
  isMinimized: boolean;
  onToggleMinimize: (minimized: boolean) => void;
  onClose?: () => void;
  resetTrigger?: number;
}

const AISuitePanel: React.FC<AISuitePanelProps> = ({ onAction, isProcessing, isMinimized, onToggleMinimize, onClose, resetTrigger }) => {
  const { pos, onMouseDown, isDragging } = useDraggable({ x: window.innerWidth - 340, y: 80 }, resetTrigger);

  const suites = [
    {
      name: 'Genesis Suite',
      icon: <Sparkles className="text-amber-500" size={18} />,
      actions: [
        { id: 'GENERATE_FULL_CANVAS', label: 'Full Canvas', icon: <Frame size={14} />, description: 'Background + Subject' },
        { id: 'GENERATE_ELEMENT', label: 'New Element', icon: <Zap size={14} />, description: 'Transparent object' },
        { id: 'GENERATE_TEXTURE', label: 'Texture', icon: <Grid size={14} />, description: 'Seamless pattern' },
        { id: 'INITIALIZE_CANVAS', label: 'Init Workspace', icon: <Maximize size={14} />, description: 'Presets' },
      ]
    },
    {
      name: 'Surgery Suite',
      icon: <Scissors className="text-red-500" size={18} />,
      actions: [
        { id: 'SMART_ERASE', label: 'Smart Erase', icon: <Trash2 size={14} />, description: 'Content-aware fill' },
        { id: 'IN_PAINT_REPLACE', label: 'In-Paint', icon: <Wand2 size={14} />, description: 'Replace area' },
        { id: 'OUT_PAINT_EXPAND', label: 'Out-Paint', icon: <Maximize size={14} />, description: 'Expand frame' },
        { id: 'SUBJECT_EXTRACTION', label: 'Extract Subject', icon: <Scissors size={14} />, description: 'Isolate main object' },
      ]
    },
    {
      name: 'Refinement Suite',
      icon: <Filter className="text-indigo-500" size={18} />,
      actions: [
        { id: 'NEURAL_UPSCALE', label: 'Neural Upscale', icon: <Maximize size={14} />, description: '4K Enhancement' },
        { id: 'ADJUST_LIGHTING', label: 'Relight', icon: <Sun size={14} />, description: 'Change mood' },
        { id: 'STANDARD_TRANSFORM', label: 'Transform', icon: <Move size={14} />, description: 'Move/Resize' },
        { id: 'COLOR_GRADE', label: 'Color Grade', icon: <Palette size={14} />, description: 'Match styles' },
      ]
    },
    {
      name: 'Composition Suite',
      icon: <Layers className="text-emerald-500" size={18} />,
      actions: [
        { id: 'MERGE_VISIBLE', label: 'Merge Visible', icon: <Layers size={14} />, description: 'Flatten image' },
        { id: 'SET_BLEND_MODE', label: 'Blend Mode', icon: <Filter size={14} />, description: 'Multiply/Overlay' },
        { id: 'AUTO_STACK', label: 'Auto Stack', icon: <Layers size={14} />, description: 'Smart ordering' },
        { id: 'MASK_LAYER', label: 'AI Mask', icon: <Filter size={14} />, description: 'Depth masking' },
      ]
    }
  ];

  const isMobile = window.innerWidth < 768;

  if (isMinimized) {
    return (
      <div 
        className="fixed z-40"
        style={{ left: isMobile ? 'auto' : pos.x, right: isMobile ? 16 : 'auto', top: isMobile ? 16 : pos.y }}
      >
        <button 
          onClick={() => onToggleMinimize(false)}
          className="p-4 bg-indigo-600/80 text-white rounded-full shadow-2xl hover:scale-110 transition-all backdrop-blur-md"
        >
          <Zap size={24} />
        </button>
      </div>
    );
  }

  return (
    <div 
      className={`fixed z-40 flex flex-col gap-6 p-4 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl w-80 transition-all ${isDragging ? 'opacity-80 scale-95 cursor-grabbing' : 'opacity-100 cursor-default'} ${isMobile ? 'max-h-[80vh] w-[calc(100vw-32px)]' : ''}`}
      style={{ left: isMobile ? 16 : pos.x, top: isMobile ? 16 : pos.y }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div onMouseDown={onMouseDown} className="p-1 text-slate-400 cursor-grab hover:text-indigo-500 transition-colors">
            <GripVertical size={16} />
          </div>
          <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">Creative Engine</h2>
        </div>
        <div className="flex items-center gap-2">
          {isProcessing && <Zap className="animate-pulse text-indigo-500" size={18} />}
          <button 
            onClick={() => onToggleMinimize(true)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            title="Minimize"
          >
            <Maximize size={16} className="rotate-45" />
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
              title="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
        {suites.map((suite) => (
          <div key={suite.name} className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              {suite.icon}
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{suite.name}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {suite.actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onAction({ action: action.id, reasoning: `User triggered ${action.label}`, parameters: {} })}
                  disabled={isProcessing}
                  className="flex flex-col items-start gap-1 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800 transition-all group text-left"
                >
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 group-hover:text-indigo-500 transition-colors">
                    {action.icon}
                  </div>
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">{action.label}</span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight">{action.description}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AISuitePanel;
