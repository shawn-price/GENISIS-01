import React from 'react';
import { Sparkles, Image as ImageIcon, Lock } from 'lucide-react';
import { CanvasElement as ICanvasElement, ElementType } from '../../types';

interface CanvasElementProps {
  element: ICanvasElement;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent, id: string, type: 'move' | 'resize') => void;
}

const CanvasElement: React.FC<CanvasElementProps> = ({ element, isSelected, onPointerDown }) => {
  const { x, y, width, height, rotation, style, content, type, visible, locked } = element;

  if (!visible) return null;

  const isGroup = type === ElementType.GROUP;

  return (
    <div
      className={`absolute select-none group ${locked ? 'pointer-events-none' : ''}`}
      style={{
        transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: element.zIndex,
        mixBlendMode: (style?.mixBlendMode as any) || 'normal',
      }}
      onPointerDown={(e) => {
        if (locked) return;
        e.stopPropagation();
        onPointerDown(e, element.id, 'move');
      }}
    >
      {/* Visual Content */}
      <div 
        className={`w-full h-full overflow-hidden relative transition-all duration-200
            ${isSelected ? 'ring-2 ring-indigo-500 shadow-xl' : isGroup ? '' : 'hover:ring-1 hover:ring-indigo-400/50'}
            ${isGroup ? 'border border-indigo-500/30 border-dashed pointer-events-none' : ''}
        `}
        style={{
            ...style, // Applies backgroundColor, etc.
            opacity: element.opacity,
            // Explicitly map shape styles if type is SHAPE, allowing override via style prop
            borderRadius: type === ElementType.SHAPE ? (style?.borderRadius || 0) : undefined,
            borderWidth: type === ElementType.SHAPE ? (style?.borderWidth || 0) : undefined,
            borderColor: type === ElementType.SHAPE ? (style?.borderColor || 'transparent') : undefined,
            borderStyle: type === ElementType.SHAPE ? (style?.borderStyle || 'solid') : undefined,
        }}
      >
        {type === ElementType.IMAGE && (
            <img 
                src={content} 
                alt="Element" 
                className="w-full h-full object-cover pointer-events-none" 
                draggable={false}
            />
        )}
        {type === ElementType.TEXT && (
            <div className="w-full h-full flex items-center justify-center text-center p-2 leading-tight">
                {content}
            </div>
        )}
        {type === ElementType.SHAPE && (
            // The container div handles the background and border for shapes now
            <div className="w-full h-full" />
        )}
        
        {type === ElementType.ART_GEN && (
             <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-950/50 border border-indigo-500/30 text-indigo-300">
                <Sparkles size={24} className="mb-2 opacity-50" />
                <span className="text-[10px] uppercase tracking-wider font-semibold opacity-70">Art Generator</span>
             </div>
        )}

        {type === ElementType.EMPTY && (
            <div className="w-full h-full border-2 border-dashed border-slate-600 bg-transparent flex items-center justify-center">
                 {isSelected && <span className="text-[10px] text-slate-500">Empty Layer</span>}
            </div>
        )}
      </div>

      {/* Locked Indicator */}
      {locked && (
          <div className="absolute top-1 right-1 text-slate-400 z-50">
              <Lock size={12} />
          </div>
      )}

      {/* Resize Handles (Only visible when selected and not locked) */}
      {isSelected && !locked && !isGroup && (
        <>
            {/* Corners */}
            <div 
                className="absolute -top-1 -left-1 w-3 h-3 bg-white border border-indigo-500 rounded-full cursor-nwse-resize z-50"
                onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, element.id, 'resize'); }}
            />
            <div 
                className="absolute -top-1 -right-1 w-3 h-3 bg-white border border-indigo-500 rounded-full cursor-nesw-resize z-50"
                onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, element.id, 'resize'); }}
            />
            <div 
                className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border border-indigo-500 rounded-full cursor-nesw-resize z-50"
                onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, element.id, 'resize'); }}
            />
            <div 
                className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-indigo-500 rounded-full cursor-nwse-resize z-50"
                onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, element.id, 'resize'); }}
            />
            
            {/* Selection Label */}
            <div className="absolute -top-6 left-0 bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {type}
            </div>
        </>
      )}
    </div>
  );
};

export default CanvasElement;