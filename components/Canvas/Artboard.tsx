import React, { useRef, useState, useEffect } from 'react';
import { CanvasElement as ICanvasElement, ToolType, ElementType, CANVAS_SIZE } from '../../types';
import CanvasElement from './CanvasElement';

interface ArtboardProps {
  elements: ICanvasElement[];
  zoom: number;
  pan: { x: number; y: number };
  activeTool: ToolType;
  selectedIds: string[];
  canvasSize: { width: number; height: number };
  onSelect: (id: string | null, multi?: boolean) => void;
  onUpdateElement: (id: string, updates: Partial<ICanvasElement>) => void;
  onPanZoomChange: (pan: { x: number; y: number }, zoom: number) => void;
}

const Artboard: React.FC<ArtboardProps> = ({
  elements,
  zoom,
  pan,
  activeTool,
  selectedIds,
  canvasSize,
  onSelect,
  onUpdateElement,
  onPanZoomChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    type: 'pan' | 'move' | 'resize' | 'pinch' | null;
    startX: number;
    startY: number;
    initialPan: { x: number; y: number };
    initialZoom: number;
    initialDistance: number;
    initialElements: { [id: string]: { x: number; y: number; w: number; h: number } } | null;
  }>({
    isDragging: false,
    type: null,
    startX: 0,
    startY: 0,
    initialPan: { x: 0, y: 0 },
    initialZoom: 1,
    initialDistance: 0,
    initialElements: null,
  });

  // Handle Wheel Zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
          const delta = -e.deltaY;
          const factor = Math.pow(1.1, delta / 100);
          const newZoom = Math.min(Math.max(zoom * factor, 0.1), 10);
          
          // Zoom towards cursor
          const rect = container.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          
          const newPan = {
              x: mouseX - (mouseX - pan.x) * (newZoom / zoom),
              y: mouseY - (mouseY - pan.y) * (newZoom / zoom),
          };
          onPanZoomChange(newPan, newZoom);
      } else {
          // Pan with wheel
          onPanZoomChange({ x: pan.x - e.deltaX, y: pan.y - e.deltaY }, zoom);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoom, pan, onPanZoomChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    
    if (pointersRef.current.size === 2) {
        // Start pinch
        const pts = Array.from(pointersRef.current.values()) as { x: number; y: number }[];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const centerX = (pts[0].x + pts[1].x) / 2;
        const centerY = (pts[0].y + pts[1].y) / 2;
        
        setDragState({
            isDragging: true,
            type: 'pinch',
            startX: centerX,
            startY: centerY,
            initialPan: { ...pan },
            initialZoom: zoom,
            initialDistance: dist,
            initialElements: null,
        });
        return;
    }

    if (pointersRef.current.size === 1) {
        // Middle click or Spacebar (simulated via tool) for panning
        // OR clicking the background (since elements stop propagation)
        if (e.button === 0 || e.button === 1 || activeTool === ToolType.HAND) {
          setDragState({
            isDragging: true,
            type: 'pan',
            startX: e.clientX,
            startY: e.clientY,
            initialPan: { ...pan },
            initialZoom: zoom,
            initialDistance: 0,
            initialElements: null,
          });
          
          // Deselect if clicking background
          onSelect(null);
          return;
        }
    }
  };

  const handleElementPointerDown = (e: React.PointerEvent, id: string, type: 'move' | 'resize') => {
    e.stopPropagation();
    if (activeTool === ToolType.HAND) return; 

    // Determine selection logic (Grouping check)
    // If element belongs to a group, we should select the group instead
    let targetId = id;
    const clickedEl = elements.find(el => el.id === id);
    if (clickedEl && clickedEl.parentId) {
        targetId = clickedEl.parentId;
    }

    const multi = e.shiftKey;
    const isAlreadySelected = selectedIds.includes(targetId);
    
    if (multi) {
        onSelect(targetId, true);
    } else if (!isAlreadySelected) {
        onSelect(targetId, false);
    }
    // If already selected and no shift, keep selection (to allow drag)
    
    // Prepare for drag
    // Store initial states for ALL selected items (and their children if groups)
    const movingIds = new Set<string>();
    const currentSelected = multi 
        ? (isAlreadySelected ? selectedIds.filter(sid => sid !== targetId) : [...selectedIds, targetId]) 
        : (isAlreadySelected ? selectedIds : [targetId]);

    // Populate movingIds including children of groups
    currentSelected.forEach(sid => {
        movingIds.add(sid);
        elements.filter(el => el.parentId === sid).forEach(child => movingIds.add(child.id));
    });

    const initialElState: any = {};
    movingIds.forEach(mid => {
        const el = elements.find(e => e.id === mid);
        if (el) initialElState[mid] = { x: el.x, y: el.y, w: el.width, h: el.height };
    });

    setDragState({
      isDragging: true,
      type: type,
      startX: e.clientX,
      startY: e.clientY,
      initialPan: { ...pan },
      initialZoom: zoom,
      initialDistance: 0,
      initialElements: initialElState,
    });
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (!dragState.isDragging) return;

      if (dragState.type === 'pinch' && pointersRef.current.size === 2) {
        const pts = Array.from(pointersRef.current.values()) as { x: number; y: number }[];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const centerX = (pts[0].x + pts[1].x) / 2;
        const centerY = (pts[0].y + pts[1].y) / 2;

        const factor = dist / dragState.initialDistance;
        const newZoom = Math.min(Math.max(dragState.initialZoom * factor, 0.1), 10);

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = centerX - rect.left;
            const mouseY = centerY - rect.top;
            
            const newPan = {
                x: mouseX - (mouseX - dragState.initialPan.x) * (newZoom / dragState.initialZoom),
                y: mouseY - (mouseY - dragState.initialPan.y) * (newZoom / dragState.initialZoom),
            };
            onPanZoomChange(newPan, newZoom);
        }
      } else if (dragState.type === 'pan') {
        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;
        onPanZoomChange({
          x: dragState.initialPan.x + dx,
          y: dragState.initialPan.y + dy,
        }, zoom);
      } else if (dragState.initialElements) {
         const dx = (e.clientX - dragState.startX) / zoom;
         const dy = (e.clientY - dragState.startY) / zoom;
         
         Object.keys(dragState.initialElements).forEach(id => {
             const init = dragState.initialElements![id];
             if (dragState.type === 'move') {
                 onUpdateElement(id, {
                     x: init.x + dx,
                     y: init.y + dy
                 });
             } else if (dragState.type === 'resize' && selectedIds.includes(id)) {
                 // Only resize the explicitly selected item (simpler for now)
                 // Or resize all? Let's just resize the primary target if simple
                 onUpdateElement(id, {
                    width: Math.max(10, init.w + dx),
                    height: Math.max(10, init.h + dy),
                 });
             }
         });
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2 && dragState.type === 'pinch') {
          setDragState(prev => ({ ...prev, isDragging: false, type: null }));
      } else if (pointersRef.current.size === 0) {
          setDragState(prev => ({ ...prev, isDragging: false, type: null, initialElements: null }));
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragState, zoom, pan, onPanZoomChange, onUpdateElement, selectedIds]);

  return (
    <div 
        ref={containerRef}
        className={`w-full h-full overflow-hidden bg-slate-200 dark:bg-slate-900 relative cursor-${activeTool === ToolType.HAND ? 'grab' : 'default'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
    >
        {/* Grid Background */}
        <div 
            className="absolute inset-0 canvas-pattern opacity-10 pointer-events-none"
            style={{
                backgroundPosition: `${pan.x}px ${pan.y}px`,
                backgroundSize: `${20 * zoom}px ${20 * zoom}px`
            }}
        />

        {/* Elements Container */}
        <div
            id="artboard-content"
            className="absolute top-0 left-0 transform-gpu"
            style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
            }}
        >
            {/* The Visual Artboard Boundary */}
            <div 
                className="absolute top-0 left-0 bg-white shadow-2xl transition-shadow pointer-events-none"
                style={{ width: canvasSize.width, height: canvasSize.height }}
            />

            {elements.map(el => (
                <CanvasElement 
                    key={el.id}
                    element={el}
                    isSelected={selectedIds.includes(el.id)}
                    onPointerDown={handleElementPointerDown}
                />
            ))}
        </div>
        
    </div>
  );
};

export default Artboard;