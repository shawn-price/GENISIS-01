import React, { useEffect, useState } from 'react';
import { MousePointer2 } from 'lucide-react';

interface Cursor {
  id: number;
  x: number;
  y: number;
  color: string;
  name: string;
}

const NAMES = ['Alice', 'Bob', 'Charlie', 'Dave'];
const COLORS = ['#ef4444', '#22c55e', '#eab308', '#ec4899'];

export const Collaborators: React.FC = () => {
  const [cursors, setCursors] = useState<Cursor[]>([]);

  useEffect(() => {
    // Initialize mock users
    const initialCursors = Array.from({ length: 3 }).map((_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      color: COLORS[i % COLORS.length],
      name: NAMES[i % NAMES.length]
    }));
    setCursors(initialCursors);

    // Animate them randomly
    const interval = setInterval(() => {
      setCursors(prev => prev.map(c => ({
        ...c,
        x: Math.max(0, Math.min(window.innerWidth, c.x + (Math.random() - 0.5) * 200)),
        y: Math.max(0, Math.min(window.innerHeight, c.y + (Math.random() - 0.5) * 200)),
      })));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {cursors.map(cursor => (
        <div 
          key={cursor.id}
          className="absolute transition-all duration-[2000ms] ease-in-out flex flex-col items-start"
          style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
        >
          <MousePointer2 
            size={16} 
            fill={cursor.color} 
            color="white" 
            className="drop-shadow-md"
          />
          <span 
            className="ml-4 -mt-2 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm whitespace-nowrap"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.name}
          </span>
        </div>
      ))}
    </div>
  );
};