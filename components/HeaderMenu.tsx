import React, { useRef, useState } from 'react';
import { 
  FilePlus, Download, Upload, Share2, Moon, Sun, Users, Grid,
  Save, Menu, Settings, ChevronDown, FolderOpen
} from 'lucide-react';
import { Theme } from '../types';

interface HeaderMenuProps {
  theme: Theme;
  isCollaborating: boolean;
  onToggleTheme: () => void;
  onToggleCollaboration: () => void;
  onNewSketch: () => void;
  onSave: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onOpenGallery: () => void;
  onOpenSettings: () => void;
}

export const HeaderMenu: React.FC<HeaderMenuProps> = ({
  theme,
  isCollaborating,
  onToggleTheme,
  onToggleCollaboration,
  onNewSketch,
  onSave,
  onImport,
  onExport,
  onOpenGallery,
  onOpenSettings
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="h-14 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 backdrop-blur-md flex items-center justify-between px-4 z-50 transition-colors duration-200 shrink-0 relative">
      
      {/* Left: Branding & File Menu */}
      <div className="flex items-center gap-6">
        {/* Branding */}
        <div className="flex items-center gap-2 select-none">
             <div className="bg-indigo-600 w-1.5 md:w-2 h-6 md:h-7 rounded-full"></div>
             <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Genesis <span className="text-slate-500 font-normal">One</span>
             </h1>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

        {/* Desktop Menu Actions */}
        <div className="hidden md:flex items-center gap-1">
          <button 
            onClick={onNewSketch}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <FilePlus size={16} /> New
          </button>
          
          <button 
            onClick={onOpenGallery}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Grid size={16} /> Gallery
          </button>

          <button 
            onClick={onSave}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Save size={16} /> Save
          </button>

           <div className="relative group">
              <button 
                onClick={handleImportClick}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <FolderOpen size={16} /> Import
              </button>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={onImport}
                className="hidden" 
                accept=".json,image/*"
              />
           </div>
        </div>
      </div>

      {/* Right: Actions & Preferences */}
      <div className="flex items-center gap-2 md:gap-3">
        
        {/* Mobile Menu Toggle */}
        <div className="md:hidden relative">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Menu size={18} />
          </button>
          
          {isMobileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50 flex flex-col">
              <button onClick={() => { onNewSketch(); setIsMobileMenuOpen(false); }} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                <FilePlus size={16} /> New
              </button>
              <button onClick={() => { onOpenGallery(); setIsMobileMenuOpen(false); }} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                <Grid size={16} /> Gallery
              </button>
              <button onClick={() => { onSave(); setIsMobileMenuOpen(false); }} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                <Save size={16} /> Save
              </button>
              <button onClick={() => { handleImportClick(); setIsMobileMenuOpen(false); }} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700">
                <FolderOpen size={16} /> Import
              </button>
            </div>
          )}
        </div>

        {/* Collaboration Toggle */}
        <button 
            onClick={onToggleCollaboration}
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs md:text-sm font-medium border transition-all
                ${isCollaborating 
                    ? 'bg-green-500/10 text-green-600 border-green-500/50 dark:text-green-400' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                }
            `}
            title={isCollaborating ? "Connected (Simulated)" : "Work together"}
        >
            <Users size={16} />
            <span className="hidden sm:inline">{isCollaborating ? 'Live' : 'Collaborate'}</span>
        </button>

        {/* Share/Export */}
        <button 
            onClick={onExport}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Export"
        >
            <Share2 size={18} />
        </button>

        {/* Theme Toggle */}
        <button 
            onClick={onToggleTheme}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Toggle Theme"
        >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Settings */}
        <button 
            onClick={onOpenSettings}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Settings"
        >
            <Settings size={18} />
        </button>
      </div>
    </div>
  );
};