import React, { useState, useRef } from 'react';
import { 
  Layers, Trash2, MoveVertical, ChevronRight, Plus, RotateCcw, RotateCw, 
  Square, Circle, PaintBucket, PenTool, Type, Bold, Italic, 
  FolderOpen, Cpu, Settings2, X, Mic, Loader2, Eye, EyeOff, Lock, Unlock, 
  Group, Ungroup, ChevronDown, Sparkles, Sliders, GripHorizontal
} from 'lucide-react';
import { CanvasElement, ElementType, AVAILABLE_IMAGE_MODELS, AppSettings, BLEND_MODES } from '../types';
import { transcribeAudio, enhancePrompt } from '../services/geminiService';
import { useDraggable } from '../hooks/useDraggable';

interface LayerPanelProps {
  elements: CanvasElement[];
  selectedIds: string[];
  onSelect: (id: string, multi?: boolean) => void;
  onDelete: () => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onAddLayer: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUpdateLayerModel: (id: string, modelId: string) => void;
  onUpdateElement: (id: string, updates: Partial<CanvasElement>) => void;
  settings: AppSettings;
  onGroup: () => void;
  onUngroup: () => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  snapshots: { id: string; name: string; timestamp: number }[];
  onApplySnapshot: (id: string) => void;
  onDeleteSnapshot: (id: string) => void;
  canvasSize: { width: number; height: number };
  aspectRatio: string;
  onResizeCanvas: (ratio: string) => void;
  isMinimized?: boolean;
  onToggleMinimize?: (minimized: boolean) => void;
  layout?: 'floating' | 'stack';
}

const LayerPanel: React.FC<LayerPanelProps> = ({ 
    elements, selectedIds, onSelect, onDelete, onReorder, onAddLayer, onUndo, onRedo,
    canUndo, canRedo, onUpdateElement, settings, onGroup, onUngroup, onToggleVisibility, onToggleLock,
    snapshots, onApplySnapshot, onDeleteSnapshot, canvasSize, aspectRatio, onResizeCanvas,
    isMinimized: controlledMinimized, onToggleMinimize, layout = 'floating'
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'snapshots' | 'canvas'>('layers');
  const [internalMinimized, setInternalMinimized] = useState(true);
  const { pos, onMouseDown, isDragging } = useDraggable({ x: Math.max(16, window.innerWidth - 340), y: 100 });
  
  const isMinimized = controlledMinimized !== undefined ? controlledMinimized : internalMinimized;
  const setIsMinimized = onToggleMinimize || setInternalMinimized;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [activePopover, setActivePopover] = useState<{ id: string, type: 'font' | 'gen_settings' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Recording & Enhancing
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const rootElements = elements.filter(el => !el.parentId).sort((a, b) => b.zIndex - a.zIndex);
  const getChildren = (parentId: string) => elements.filter(el => el.parentId === parentId).sort((a, b) => b.zIndex - a.zIndex);

  const handleDragStart = (e: React.DragEvent, id: string) => { setDraggingId(id); e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e: React.DragEvent, targetId: string) => { e.preventDefault(); if (draggingId !== targetId) setDropTargetId(targetId); };
  const handleDragLeave = () => { setDropTargetId(null); };
  const handleDrop = (e: React.DragEvent, targetId: string) => { e.preventDefault(); setDropTargetId(null); const draggedId = e.dataTransfer.getData('text/plain'); if (draggedId && draggedId !== targetId) onReorder(draggedId, targetId); setDraggingId(null); };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, elementId: string) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => { if (ev.target?.result) onUpdateElement(elementId, { content: ev.target.result as string }); };
        reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

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
        mediaRecorder.onstop = async () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            setIsTranscribing(true);
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const text = await transcribeAudio(base64, settings);
                
                const targetId = activePopover?.id || (selectedIds.length > 0 ? selectedIds[0] : null);
                if (targetId) {
                    const el = elements.find(e => e.id === targetId);
                    if (el) {
                        const newText = (el.genConfig?.prompt ? el.genConfig.prompt + ' ' : '') + text;
                        onUpdateElement(targetId, { genConfig: { ...el.genConfig, prompt: newText } });
                    }
                }
                
                setIsTranscribing(false);
                stream.getTracks().forEach(track => track.stop());
            };
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
  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); setIsRecording(false); } };

  const handleEnhancePrompt = async (id: string) => {
    const el = elements.find(e => e.id === id);
    if (!el || !el.genConfig?.prompt) return;

    setIsEnhancing(true);
    try {
        const enhanced = await enhancePrompt(el.genConfig.prompt, settings);
        onUpdateElement(id, { genConfig: { ...el.genConfig, prompt: enhanced } });
    } finally {
        setIsEnhancing(false);
    }
  };

  const renderLayerItem = (el: CanvasElement, depth: number = 0) => {
      const children = getChildren(el.id);
      const isSelected = selectedIds.includes(el.id);
      const isGroup = el.type === ElementType.GROUP;

      return (
          <React.Fragment key={el.id}>
             <div
                draggable
                onDragStart={(e) => handleDragStart(e, el.id)}
                onDragOver={(e) => handleDragOver(e, el.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, el.id)}
                onClick={(e) => onSelect(el.id, e.shiftKey)}
                className={`
                    group relative flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border
                    ${isSelected 
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-500/50' 
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/30 border-transparent dark:border-slate-800'
                    } 
                    ${draggingId === el.id ? 'opacity-40 dashed border-slate-500' : ''}
                    ${dropTargetId === el.id ? 'border-t-2 border-t-indigo-500 bg-slate-100 dark:bg-slate-800' : ''}
                `}
                style={{ marginLeft: `${depth * 16}px` }}
             >
                {isGroup && (
                    <button onClick={(e) => { e.stopPropagation(); onUpdateElement(el.id, { expanded: !el.expanded }); }} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400">
                        {el.expanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                    </button>
                )}
                <div className="w-8 h-8 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {el.type === ElementType.IMAGE && <img src={el.content} className="w-full h-full object-cover" />}
                    {el.type === ElementType.TEXT && <span className="text-xs font-bold text-slate-500 dark:text-slate-300">T</span>}
                    {el.type === ElementType.SHAPE && <div className={`w-4 h-4 bg-current ${el.shapeType === 'circle' ? 'rounded-full' : 'rounded-sm'}`} style={{ color: el.style?.backgroundColor }} />}
                    {el.type === ElementType.ART_GEN && <Cpu size={14} className="text-indigo-400" />}
                    {el.type === ElementType.GROUP && <FolderOpen size={14} className="text-indigo-400" />}
                    {el.type === ElementType.EMPTY && <div className="w-4 h-4 border border-dashed border-slate-500" />}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <p className={`text-sm truncate font-medium ${isSelected ? 'text-indigo-600 dark:text-indigo-200' : 'text-slate-600 dark:text-slate-300'}`}>
                      {el.type === ElementType.TEXT ? (el.content || 'Text Layer') : el.type === ElementType.GROUP ? 'Group' : `${el.type} Layer`}
                    </p>
                    <span className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[9px] font-mono text-slate-500 dark:text-slate-400 select-none opacity-70">
                        #{el.id.slice(0, 4)}
                    </span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onToggleLock(el.id); }} className={`p-1 rounded ${el.locked ? 'text-indigo-500' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                        {el.locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onToggleVisibility(el.id); }} className={`p-1 rounded ${!el.visible ? 'text-slate-400' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>
                        {el.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                </div>
             </div>
             {isGroup && el.expanded && children.map(child => renderLayerItem(child, depth + 1))}
          </React.Fragment>
      );
  };

  const isStack = layout === 'stack';

  if (isMinimized && !isStack) {
    return (
      <button 
        onClick={() => setIsMinimized(false)} 
        onMouseDown={onMouseDown}
        className={`
            absolute p-3 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white border border-slate-200 dark:border-slate-700 shadow-xl backdrop-blur-md z-20 transition-all hover:scale-110 group
            ${isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab'}
        `}
        style={{ left: pos.x, top: pos.y }}
      >
         <Layers size={20} />
      </button>
    );
  }

  const primarySelected = selectedIds.length > 0 ? elements.find(el => el.id === selectedIds[0]) : null;

  return (
    <div 
        className={`
            ${isStack 
              ? 'absolute right-0 top-12 bottom-0 w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-20 transition-all duration-300' 
              : `absolute w-80 max-w-[calc(100vw-32px)] bg-white/95 dark:bg-slate-800/90 backdrop-blur-md rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 ${isDragging ? 'cursor-grabbing opacity-80 scale-105' : 'cursor-default'}`
            }
        `}
        style={isStack ? {} : { left: pos.x, top: pos.y, height: window.innerWidth < 768 ? '60vh' : 'calc(100vh - 200px)' }}
    >
      {/* Drag Handle */}
      {!isStack && (
        <div 
          onMouseDown={onMouseDown}
          className="h-6 flex items-center justify-center bg-slate-100/50 dark:bg-slate-900/50 cursor-grab hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-200 dark:border-slate-700"
        >
          <GripHorizontal size={16} className="text-slate-400" />
        </div>
      )}

      <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 mt-safe md:mt-0">
        <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
                <button onClick={() => setActiveTab('layers')} className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${activeTab === 'layers' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Layers</button>
                <button onClick={() => setActiveTab('snapshots')} className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${activeTab === 'snapshots' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Snapshots</button>
                <button onClick={() => setActiveTab('canvas')} className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${activeTab === 'canvas' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Canvas</button>
            </div>
            {!isStack && (
                <button onClick={() => setIsMinimized(true)} className="text-slate-500 hover:text-slate-900 dark:hover:text-white p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><ChevronRight size={16} /></button>
            )}
        </div>
        <div className="flex items-center justify-between gap-1">
             <div className="flex gap-1">
                <button onClick={onAddLayer} className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow-sm"><Plus size={16} /></button>
                <button onClick={onDelete} disabled={selectedIds.length === 0} className="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-red-500 text-slate-500 dark:text-slate-300 hover:text-white rounded shadow-sm disabled:opacity-50"><Trash2 size={16} /></button>
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1 self-center" />
                <button onClick={onGroup} disabled={selectedIds.length < 2} className="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 rounded shadow-sm disabled:opacity-50"><Group size={16} /></button>
                <button onClick={onUngroup} disabled={selectedIds.length === 0} className="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 rounded shadow-sm disabled:opacity-50"><Ungroup size={16} /></button>
             </div>
             <div className="flex gap-1">
                <button onClick={onUndo} disabled={!canUndo} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded disabled:opacity-50"><RotateCcw size={16} /></button>
                <button onClick={onRedo} disabled={!canRedo} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded disabled:opacity-50"><RotateCw size={16} /></button>
             </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {activeTab === 'layers' && (
            elements.length === 0 ? (
                <div className="text-center text-slate-500 py-8 text-xs italic">No layers.<br/>Speak, draw, or click '+'</div>
            ) : (
                rootElements.map(el => renderLayerItem(el))
            )
        )}

        {activeTab === 'snapshots' && (
            <div className="space-y-2 p-2">
                {snapshots.length === 0 ? (
                    <div className="text-center text-slate-500 py-8 text-xs italic">No snapshots saved.</div>
                ) : (
                    snapshots.map(s => (
                        <div key={s.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700 group">
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{s.name}</span>
                                <span className="text-[9px] text-slate-500">{new Date(s.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onApplySnapshot(s.id)} className="p-1 hover:bg-indigo-600 rounded text-slate-400 hover:text-white" title="Restore"><RotateCcw size={12} /></button>
                                <button onClick={() => onDeleteSnapshot(s.id)} className="p-1 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400" title="Delete"><Trash2 size={12} /></button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}

        {activeTab === 'canvas' && (
            <div className="space-y-4 p-2">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-2">Aspect Ratio</label>
                    <div className="grid grid-cols-2 gap-2">
                        {['1:1', '16:9', '9:16', '4:3'].map(ratio => (
                            <button 
                                key={ratio} 
                                onClick={() => onResizeCanvas(ratio)}
                                className={`py-2 text-xs rounded border transition-all ${aspectRatio === ratio ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-500'}`}
                            >
                                {ratio}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-2">Current Size</label>
                    <div className="flex gap-2">
                        <div className="flex-1 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 text-center">
                            <div className="text-[10px] text-slate-500 uppercase">Width</div>
                            <div className="text-sm font-mono text-slate-900 dark:text-white">{canvasSize.width}px</div>
                        </div>
                        <div className="flex-1 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 text-center">
                            <div className="text-[10px] text-slate-500 uppercase">Height</div>
                            <div className="text-sm font-mono text-slate-900 dark:text-white">{canvasSize.height}px</div>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {primarySelected && (
        <div className="relative bg-slate-100/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-3 pb-safe md:pb-3">
           
           {/* Geometry - Always Visible */}
           <div className="grid grid-cols-4 gap-2">
               {['x', 'y', 'width', 'height'].map(prop => (
                   <div key={prop} className="bg-white dark:bg-slate-800 p-1 rounded flex flex-col items-center border border-slate-200 dark:border-slate-700">
                       <label className="text-[9px] text-slate-500 uppercase">{prop.charAt(0)}</label>
                       <input 
                            type="number"
                            className="w-full bg-transparent text-center text-[10px] text-slate-900 dark:text-slate-200 outline-none"
                            value={Math.round((primarySelected as any)[prop] || 0)}
                            onChange={(e) => onUpdateElement(primarySelected.id, { [prop]: parseFloat(e.target.value) })}
                       />
                   </div>
               ))}
           </div>

           {/* Appearance - Always Visible */}
           <div className="grid grid-cols-2 gap-2">
               <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                   <div className="flex justify-between text-[10px] mb-1">
                       <span className="text-slate-500 dark:text-slate-400">Opacity</span>
                       <span className="text-slate-900 dark:text-slate-200">{Math.round(primarySelected.opacity * 100)}%</span>
                   </div>
                   <input type="range" min="0" max="1" step="0.01" value={primarySelected.opacity} onChange={(e) => onUpdateElement(primarySelected.id, { opacity: parseFloat(e.target.value) })} className="w-full h-1 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
               </div>
               <div className="bg-white dark:bg-slate-800 p-2 rounded flex flex-col justify-center border border-slate-200 dark:border-slate-700">
                   <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">Blend Mode</label>
                   <select value={primarySelected.style?.mixBlendMode || 'normal'} onChange={(e) => onUpdateElement(primarySelected.id, { style: { ...primarySelected.style, mixBlendMode: e.target.value } })} className="w-full bg-slate-50 dark:bg-slate-900 text-[10px] text-slate-900 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-700 outline-none p-1">
                       {BLEND_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>)}
                   </select>
               </div>
           </div>
           
           {/* Popovers Content (Conditional Render) */}
           {activePopover && activePopover.id === primarySelected.id && (
                <div className="absolute bottom-full left-0 mb-2 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl shadow-2xl z-50 p-3 animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white">
                            {activePopover.type === 'font' && 'Typography'}
                            {activePopover.type === 'gen_settings' && 'Advanced Settings'}
                        </h4>
                        <button onClick={() => setActivePopover(null)}><X size={14} className="text-slate-500" /></button>
                    </div>
                    
                    {activePopover.type === 'gen_settings' && (
                         <div className="space-y-3">
                             {/* Model Select */}
                             <div>
                                 <label className="text-[10px] text-slate-500 block mb-1">AI Model</label>
                                 <select 
                                    value={primarySelected.modelId || settings.imageModel} 
                                    onChange={(e) => onUpdateElement(primarySelected.id, { modelId: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded p-1.5 text-[10px] text-slate-900 dark:text-slate-200 outline-none"
                                 >
                                    {AVAILABLE_IMAGE_MODELS.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                 </select>
                             </div>

                             {/* Negative Prompt */}
                             <div>
                                 <label className="text-[10px] text-slate-500 block mb-1">Negative Prompt</label>
                                 <textarea 
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded p-1 text-[10px] text-slate-900 dark:text-slate-200 resize-none focus:border-indigo-500 outline-none" 
                                    rows={2} 
                                    value={primarySelected.genConfig?.negativePrompt || ''} 
                                    onChange={(e) => onUpdateElement(primarySelected.id, { genConfig: { ...primarySelected.genConfig, negativePrompt: e.target.value } })} 
                                    placeholder="Things to exclude..." 
                                 />
                             </div>

                             {/* Seed */}
                             <div>
                                 <label className="text-[10px] text-slate-500 block mb-1">Seed</label>
                                 <input 
                                    type="number" 
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded p-1 text-[10px] text-slate-900 dark:text-slate-200 focus:border-indigo-500 outline-none" 
                                    value={primarySelected.genConfig?.seed || ''} 
                                    onChange={(e) => onUpdateElement(primarySelected.id, { genConfig: { ...primarySelected.genConfig, seed: parseInt(e.target.value) } })} 
                                    placeholder="Random (-1)" 
                                 />
                             </div>
                         </div>
                    )}
                    
                    {activePopover.type === 'font' && (
                        <div className="space-y-2">
                             <div className="flex justify-between text-[10px]"><span className="text-slate-500">Size</span> <span className="text-slate-900 dark:text-white">{primarySelected.style?.fontSize}px</span></div>
                             <input type="range" min="12" max="120" value={primarySelected.style?.fontSize || 16} onChange={(e) => onUpdateElement(primarySelected.id, { style: { ...primarySelected.style, fontSize: parseInt(e.target.value) } })} className="w-full h-1 bg-slate-300 dark:bg-slate-700 rounded-lg accent-indigo-600" />
                             
                             <label className="text-[10px] text-slate-500 block mt-2">Family</label>
                             <div className="flex gap-1">
                                 {['Inter', 'Serif', 'Mono'].map(font => (
                                     <button key={font} onClick={() => onUpdateElement(primarySelected.id, { style: { ...primarySelected.style, fontFamily: font === 'Inter' ? 'Inter, sans-serif' : font.toLowerCase() } })} className={`flex-1 py-1 text-[9px] border rounded ${primarySelected.style?.fontFamily?.includes(font.toLowerCase()) ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'}`}>{font}</button>
                                 ))}
                             </div>
                        </div>
                    )}
                </div>
           )}

           {/* --- Quick Actions based on type --- */}
           
           {/* SHAPE CONTROLS */}
           {primarySelected.type === ElementType.SHAPE && (
               <div className="grid grid-cols-2 gap-2">
                   <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                       <button onClick={() => onUpdateElement(primarySelected.id, { shapeType: 'rectangle', style: { ...primarySelected.style, borderRadius: 0 } })} className={`flex-1 p-1.5 rounded flex justify-center transition-colors ${primarySelected.shapeType !== 'circle' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-600 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`} title="Square"><Square size={14} /></button>
                       <button onClick={() => onUpdateElement(primarySelected.id, { shapeType: 'circle', style: { ...primarySelected.style, borderRadius: 9999 } })} className={`flex-1 p-1.5 rounded flex justify-center transition-colors ${primarySelected.shapeType === 'circle' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-600 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`} title="Circle"><Circle size={14} /></button>
                   </div>
                   <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1.5 rounded border border-slate-200 dark:border-slate-700">
                       <div className="relative flex-1 group/color cursor-pointer">
                           <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-500 group-hover/color:text-indigo-500"><PaintBucket size={14} /></div>
                           <input type="color" value={primarySelected.style?.backgroundColor || '#cbd5e1'} onChange={(e) => onUpdateElement(primarySelected.id, { style: { ...primarySelected.style, backgroundColor: e.target.value } })} className="w-full h-8 opacity-0 cursor-pointer" title="Fill Color" />
                           <div className="absolute bottom-0 left-0 right-0 h-1 rounded-full mx-1" style={{ backgroundColor: primarySelected.style?.backgroundColor || '#cbd5e1' }}></div>
                       </div>
                       <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                       <div className="relative flex-1 group/color cursor-pointer">
                           <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-500 group-hover/color:text-indigo-500"><PenTool size={14} /></div>
                           <input type="color" value={primarySelected.style?.borderColor || '#000000'} onChange={(e) => onUpdateElement(primarySelected.id, { style: { ...primarySelected.style, borderColor: e.target.value, borderWidth: (primarySelected.style?.borderWidth || 0) > 0 ? primarySelected.style?.borderWidth : 2, borderStyle: 'solid' } })} className="w-full h-8 opacity-0 cursor-pointer" title="Stroke Color" />
                           <div className="absolute bottom-0 left-0 right-0 h-1 rounded-full mx-1" style={{ backgroundColor: primarySelected.style?.borderWidth ? primarySelected.style?.borderColor : 'transparent' }}></div>
                       </div>
                   </div>
               </div>
           )}

           {/* TEXT CONTROLS */}
           {primarySelected.type === ElementType.TEXT && (
                <div className="flex gap-2 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <button onClick={(e) => { e.stopPropagation(); setActivePopover(prev => (prev?.id === primarySelected.id && prev?.type === 'font') ? null : { id: primarySelected.id, type: 'font' }); }} className="flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-3 py-1 rounded transition-colors font-medium"><Type size={12}/> Typography</button>
                    <div className="flex gap-1 ml-auto">
                        <button onClick={() => onUpdateElement(primarySelected.id, { style: { ...primarySelected.style, fontWeight: primarySelected.style?.fontWeight === 'bold' ? 'normal' : 'bold' } })} className={`p-1.5 rounded transition-colors ${primarySelected.style?.fontWeight === 'bold' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-600 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`} title="Bold"><Bold size={14}/></button>
                        <button onClick={() => onUpdateElement(primarySelected.id, { style: { ...primarySelected.style, fontStyle: primarySelected.style?.fontStyle === 'italic' ? 'normal' : 'italic' } })} className={`p-1.5 rounded transition-colors ${primarySelected.style?.fontStyle === 'italic' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-600 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`} title="Italic"><Italic size={14}/></button>
                    </div>
                </div>
           )}

           {/* ART GEN CONTROLS */}
           {primarySelected.type === ElementType.ART_GEN && (
               <div className="space-y-2">
                   {/* Prompt Input in Panel */}
                   <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 space-y-2">
                       <label className="text-[10px] text-slate-500 font-medium block">Prompt</label>
                       
                       <div className="relative">
                           <textarea 
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 text-[11px] text-slate-900 dark:text-slate-200 resize-none focus:border-indigo-500 outline-none pr-16"
                                rows={4} 
                                value={primarySelected.genConfig?.prompt || ''} 
                                onChange={(e) => onUpdateElement(primarySelected.id, { genConfig: { ...primarySelected.genConfig, prompt: e.target.value } })} 
                                placeholder="Describe the image..." 
                           />
                           
                           {/* Floating Actions inside Textarea */}
                           <div className="absolute bottom-2 right-2 flex gap-1">
                                <button 
                                    onClick={() => handleEnhancePrompt(primarySelected.id)}
                                    disabled={isEnhancing || !primarySelected.genConfig?.prompt}
                                    className={`p-1.5 rounded-md bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 ${isEnhancing ? 'animate-pulse' : ''} disabled:opacity-50`}
                                    title="Enhance with AI"
                                >
                                    <Sparkles size={12} />
                                </button>
                                <button 
                                    onClick={isRecording ? stopRecording : startRecording} 
                                    disabled={isTranscribing} 
                                    className={`p-1.5 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 ${isRecording ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-indigo-600'}`}
                                    title="Record Prompt"
                                >
                                    {isTranscribing ? <Loader2 size={12} className="animate-spin"/> : <Mic size={12}/>}
                                </button>
                           </div>
                       </div>
                   </div>

                   <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setActivePopover(prev => (prev?.id === primarySelected.id && prev?.type === 'gen_settings') ? null : { id: primarySelected.id, type: 'gen_settings' }); 
                        }} 
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors text-xs font-medium border
                            ${(activePopover?.id === primarySelected.id && activePopover?.type === 'gen_settings') 
                                ? 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-500/50 text-indigo-600 dark:text-indigo-300' 
                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}
                        `}
                    >
                        <Settings2 size={14} /> Advanced Settings
                    </button>
               </div>
           )}

           {/* IMAGE CONTROLS */}
           {primarySelected.type === ElementType.IMAGE && (
               <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded transition-colors text-xs font-medium"
                    >
                        <FolderOpen size={14} /> Import / Replace Image
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, primarySelected.id)} 
                    />
               </div>
           )}

        </div>
      )}
    </div>
  );
};

export default LayerPanel;