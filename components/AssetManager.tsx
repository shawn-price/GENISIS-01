import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Palette, 
  Image as ImageIcon, 
  FolderOpen, 
  X, 
  Plus, 
  ChevronDown,
  ChevronUp,
  Search,
  LayoutGrid,
  List,
  Zap
} from 'lucide-react';

interface AssetManagerProps {
  onSelectColor: (color: string) => void;
  onSelectAsset: (asset: any) => void;
  onSelectProject: (project: any) => void;
  hiddenTools: { id: string; label: string; icon: React.ReactNode; onRestore: () => void }[];
  onClose: () => void;
}

const PRESET_COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', 
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#71717a'
];

const SAMPLE_ASSETS = [
  { id: '1', name: 'Cloud', type: 'shape', icon: '☁️' },
  { id: '2', name: 'Star', type: 'shape', icon: '⭐' },
  { id: '3', name: 'Heart', type: 'shape', icon: '❤️' },
  { id: '4', name: 'Sun', type: 'shape', icon: '☀️' },
  { id: '5', name: 'Moon', type: 'shape', icon: '🌙' },
];

const SAMPLE_PROJECTS = [
  { id: 'p1', name: 'Unicorn Dreams', date: '2024-03-01' },
  { id: 'p2', name: 'Space Explorer', date: '2024-02-28' },
];

export const AssetManager: React.FC<AssetManagerProps> = ({
  onSelectColor,
  onSelectAsset,
  onSelectProject,
  hiddenTools,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'colors' | 'assets' | 'projects'>('colors');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsExpanded(false);
      else setIsExpanded(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="relative z-40">
      <motion.div 
        initial={false}
        animate={{ 
          height: isExpanded ? 'auto' : (isMobile ? '0px' : 'auto'),
          opacity: isExpanded ? 1 : (isMobile ? 0 : 1)
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col md:flex-row items-center gap-4">
          
          {/* Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button 
              onClick={() => setActiveTab('colors')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'colors' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Palette size={14} /> Colors
            </button>
            <button 
              onClick={() => setActiveTab('assets')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'assets' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <ImageIcon size={14} /> Assets
            </button>
            <button 
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'projects' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <FolderOpen size={14} /> Projects
            </button>
          </div>

          {/* Separator */}
          <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-700"></div>

          {/* Content Area */}
          <div className="flex-1 flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
            {activeTab === 'colors' && (
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map(color => (
                  <button 
                    key={color}
                    onClick={() => onSelectColor(color)}
                    className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm hover:scale-110 transition-transform shrink-0"
                    style={{ backgroundColor: color }}
                  />
                ))}
                <button className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all shrink-0">
                  <Plus size={16} />
                </button>
              </div>
            )}

            {activeTab === 'assets' && (
              <div className="flex items-center gap-3">
                {SAMPLE_ASSETS.map(asset => (
                  <button 
                    key={asset.id}
                    onClick={() => onSelectAsset(asset)}
                    className="flex flex-col items-center gap-1 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-all shrink-0 min-w-[60px]"
                  >
                    <span className="text-xl">{asset.icon}</span>
                    <span className="text-[10px] font-bold text-slate-500">{asset.name}</span>
                  </button>
                ))}
                <button className="flex flex-col items-center justify-center p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all shrink-0 min-w-[60px] h-full">
                  <Plus size={16} />
                </button>
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="flex items-center gap-3">
                {SAMPLE_PROJECTS.map(project => (
                  <button 
                    key={project.id}
                    onClick={() => onSelectProject(project)}
                    className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-500 transition-all shrink-0"
                  >
                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600">
                      <FolderOpen size={16} />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{project.name}</span>
                      <span className="text-[10px] text-slate-400">{project.date}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hidden Tools / Restore Section */}
          {hiddenTools.length > 0 && (
            <>
              <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/50 shrink-0">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Restore:</span>
                {hiddenTools.map(tool => (
                  <button 
                    key={tool.id}
                    onClick={tool.onRestore}
                    className="p-1.5 bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 rounded-lg shadow-sm hover:scale-110 transition-transform border border-amber-100 dark:border-amber-800"
                    title={`Restore ${tool.label}`}
                  >
                    {tool.icon}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </motion.div>

      {/* Mobile Ledge */}
      {isMobile && (
        <div className="flex justify-center">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-4 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-x border-b border-slate-200 dark:border-slate-800 rounded-b-xl shadow-md flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {activeTab.toUpperCase()}
          </button>
        </div>
      )}
    </div>
  );
};
