import React, { useState, useCallback, useEffect, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

export const useDraggable = (initialPos: Position, resetTrigger?: number) => {
  const [pos, setPos] = useState<Position>({
    x: Math.max(0, Math.min(window.innerWidth - 60, initialPos.x)),
    y: Math.max(0, Math.min(window.innerHeight - 60, initialPos.y))
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const startPos = useRef<Position>(initialPos);

  useEffect(() => {
    if (resetTrigger !== undefined) {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 60, initialPos.x)),
        y: Math.max(0, Math.min(window.innerHeight - 60, initialPos.y))
      });
    }
  }, [resetTrigger, initialPos.x, initialPos.y]);

  const onMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Only drag if it's the primary mouse button or a touch
    if ('button' in e && e.button !== 0) return;
    
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartPos.current = { x: clientX, y: clientY };
    startPos.current = pos;
    
    e.stopPropagation();
  }, [pos]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const dx = clientX - dragStartPos.current.x;
      const dy = clientY - dragStartPos.current.y;

      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 60, startPos.current.x + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 60, startPos.current.y + dy))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  return { pos, setPos, onMouseDown, isDragging };
};
