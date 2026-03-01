import React, { useState } from 'react';
import { MousePointer2, Hand, Type, Square, Image as ImageIcon, Sparkles, Menu, ChevronLeft, GripVertical } from 'lucide-react';
import { ToolType } from '../types';
import { useDraggable } from '../hooks/useDraggable';

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  isMinimized?: boolean;
  onToggleMinimize?: (minimized: boolean) => void;
  layout?: 'floating' | 'stack';
}

const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onSelectTool, isMinimized: controlledMinimized, onToggleMinimize, layout = 'floating' }) => {
  const [internalMinimized, setInternalMinimized] = useState(false);
  const { pos, onMouseDown, isDragging } = useDraggable({ x: 16, y: window.innerHeight / 2 - 150 });
  
  const isMinimized = controlledMinimized !== undefined ? controlledMinimized : internalMinimized;
  const setIsMinimized = onToggleMinimize || setInternalMinimized;
  
  const tools = [
    { type: ToolType.SELECT, icon: <MousePointer2 size={20} />, label: 'Select (V)' },
    { type: ToolType.HAND, icon: <Hand size={20} />, label: 'Hand (H)' },
    { type: ToolType.TEXT, icon: <Type size={20} />, label: 'Text (T)' },
    { type: ToolType.RECTANGLE, icon: <Square size={20} />, label: 'Shape (R)' },
    { type: ToolType.IMAGE, icon: <ImageIcon size={20} />, label: 'Import Image (I)' },
  ];

  if (isMinimized && layout === 'floating') {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        onMouseDown={onMouseDown}
        className={`
            absolute p-3 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-indigo-600 dark:hover:text-white border border-slate-200 dark:border-slate-700 shadow-2xl backdrop-blur-md z-20 transition-all hover:scale-110
            ${isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab'}
        `}
        style={{ left: pos.x, top: pos.y }}
        title="Show Tools"
      >
        <Menu size={20} />
      </button>
    );
  }

  const isStack = layout === 'stack';

  return (
    <div 
        className={`
            ${isStack 
              ? 'absolute left-0 top-12 bottom-0 w-16 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center py-4 gap-2 z-20' 
              : `absolute flex flex-col gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl z-20 animate-in fade-in slide-in-from-left-4 duration-200 ${isDragging ? 'cursor-grabbing opacity-80 scale-105' : 'cursor-default'}`
            }
        `}
        style={isStack ? {} : { left: pos.x, top: pos.y }}
    >
      {!isStack && (
        <>
          <div 
            onMouseDown={onMouseDown}
            className="flex items-center justify-center p-1 mb-1 text-slate-300 dark:text-slate-600 cursor-grab hover:text-slate-400 dark:hover:text-slate-500 transition-colors"
          >
            <GripVertical size={16} className="rotate-90" />
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            className="self-center p-1 mb-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
            title="Minimize Toolbar"
          >
            <ChevronLeft size={16} />
          </button>
        </>
      )}
      
      {tools.map((tool) => (
        <button
          key={tool.type}
          onClick={() => onSelectTool(tool.type)}
          className={`p-3 rounded-lg transition-all duration-200 group relative flex flex-col items-center justify-center gap-1 ${
            activeTool === tool.type
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
          }`}
          title={tool.label}
        >
          {tool.icon}
          {isStack && <span className="text-[9px] font-medium uppercase tracking-wider opacity-70">{tool.label.split(' ')[0]}</span>}
        </button>
      ))}
      
      <div className="h-px w-full bg-slate-200 dark:bg-slate-700 my-1" />

      {/* Art Generator Tool Button */}
      <button
        onClick={() => onSelectTool(ToolType.ART_GEN)}
        className={`p-3 rounded-lg transition-all duration-200 group relative flex flex-col items-center justify-center gap-1 ${
            activeTool === ToolType.ART_GEN
              ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg ring-1 ring-purple-400'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
          }`}
        title="Art Generator"
      >
        <Sparkles size={20} />
        {isStack && <span className="text-[9px] font-medium uppercase tracking-wider opacity-70">Art</span>}
      </button>

    </div>
  );
};

export default Toolbar;