import React, { useState } from 'react';
import { X, Download, Share2, Link, Image as ImageIcon, FileJson, Check, Copy, Laptop, Loader2, Twitter, Linkedin, Facebook, Figma, Smartphone } from 'lucide-react';
import { toPng, toJpeg, toSvg } from 'html-to-image';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'download' | 'share' | 'connect'>('download');
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = async (format: 'png' | 'jpeg' | 'svg' | 'json') => {
    setIsExporting(true);
    try {
        const node = document.getElementById('artboard-content');
        if (!node) throw new Error("Canvas not found");

        // Temporary style tweaks for export
        const originalTransition = node.style.transition;
        node.style.transition = 'none'; // Disable transition to avoid capture lag

        let dataUrl = '';
        const filename = `genesis-one-design-${Date.now()}`;

        if (format === 'json') {
            const saved = localStorage.getItem('aether_canvas_save');
            if (!saved) throw new Error("No data to export");
            dataUrl = "data:text/json;charset=utf-8," + encodeURIComponent(saved);
        } else if (format === 'png') {
            dataUrl = await toPng(node, { cacheBust: true, backgroundColor: 'transparent' });
        } else if (format === 'jpeg') {
            dataUrl = await toJpeg(node, { quality: 0.95, backgroundColor: '#ffffff' });
        } else if (format === 'svg') {
            dataUrl = await toSvg(node);
        }

        const link = document.createElement('a');
        link.download = `${filename}.${format}`;
        link.href = dataUrl;
        link.click();
        
        // Restore
        node.style.transition = originalTransition;

    } catch (err) {
        console.error("Export failed", err);
        alert("Export failed. Please try again.");
    } finally {
        setIsExporting(false);
    }
  };

  const handleShare = (platform: 'twitter' | 'linkedin' | 'facebook') => {
      const text = encodeURIComponent("Check out my design created with Genesis One! #AIArt #Design");
      const url = encodeURIComponent(window.location.href);
      let shareUrl = '';

      if (platform === 'twitter') shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
      if (platform === 'linkedin') shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
      if (platform === 'facebook') shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;

      window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Genesis One Project',
                text: 'Check out my design created with AI!',
                url: window.location.href
            });
        } catch (error) {
            console.log('Share canceled or failed', error);
        }
    } else {
        alert("Native sharing is not supported on this device/browser.");
    }
  };

  const handleCopyLink = () => {
      navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const simulateIntegration = (app: string) => {
      setApiSuccess(null);
      setIsExporting(true);
      setTimeout(() => {
          setIsExporting(false);
          setApiSuccess(app);
          setTimeout(() => setApiSuccess(null), 3000);
      }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Share2 size={20} className="text-indigo-400" /> Export & Share
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50">
           {['download', 'share', 'connect'].map((tab) => (
               <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === tab ? 'border-indigo-500 text-indigo-400 bg-slate-900' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
               >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
               </button>
           ))}
        </div>

        {/* Content */}
        <div className="p-6 bg-slate-900/50 min-h-[300px]">
            {activeTab === 'download' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-400 mb-4">Choose a format to download your design.</p>
                    <div className="grid grid-cols-2 gap-3">
                        <button disabled={isExporting} onClick={() => handleDownload('png')} className="flex flex-col items-center justify-center p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all hover:scale-105 disabled:opacity-50">
                            <ImageIcon size={32} className="text-indigo-500 mb-2" />
                            <span className="text-sm font-medium text-white">PNG Image</span>
                            <span className="text-xs text-slate-500">Transparent BG</span>
                        </button>
                        <button disabled={isExporting} onClick={() => handleDownload('jpeg')} className="flex flex-col items-center justify-center p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all hover:scale-105 disabled:opacity-50">
                            <ImageIcon size={32} className="text-emerald-500 mb-2" />
                            <span className="text-sm font-medium text-white">JPEG Image</span>
                            <span className="text-xs text-slate-500">Solid White BG</span>
                        </button>
                        <button disabled={isExporting} onClick={() => handleDownload('svg')} className="flex flex-col items-center justify-center p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all hover:scale-105 disabled:opacity-50">
                            <ImageIcon size={32} className="text-amber-500 mb-2" />
                            <span className="text-sm font-medium text-white">SVG Vector</span>
                            <span className="text-xs text-slate-500">Scalable</span>
                        </button>
                        <button disabled={isExporting} onClick={() => handleDownload('json')} className="flex flex-col items-center justify-center p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all hover:scale-105 disabled:opacity-50">
                            <FileJson size={32} className="text-blue-500 mb-2" />
                            <span className="text-sm font-medium text-white">Project JSON</span>
                            <span className="text-xs text-slate-500">Editable Source</span>
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'share' && (
                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">Quick Share</label>
                        <button onClick={handleNativeShare} className="w-full p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center gap-3 transition-all hover:shadow-lg hover:scale-[1.02]">
                            <Smartphone size={24} />
                            <span className="font-medium">Open Share Menu</span>
                        </button>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">Social Networks</label>
                        <div className="flex gap-3">
                            <button onClick={() => handleShare('twitter')} className="flex-1 p-3 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#1DA1F2]/20">
                                <Twitter size={18} /> Twitter
                            </button>
                            <button onClick={() => handleShare('linkedin')} className="flex-1 p-3 bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 text-[#0A66C2] rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#0A66C2]/20">
                                <Linkedin size={18} /> LinkedIn
                            </button>
                            <button onClick={() => handleShare('facebook')} className="flex-1 p-3 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] rounded-xl flex items-center justify-center gap-2 transition-colors border border-[#1877F2]/20">
                                <Facebook size={18} /> Facebook
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">Project Link</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                readOnly 
                                value={window.location.href} 
                                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none" 
                            />
                            <button onClick={handleCopyLink} className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors">
                                {copySuccess ? <Check size={20} /> : <Copy size={20} />}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'connect' && (
                <div className="space-y-4">
                    <p className="text-sm text-slate-400 mb-4">Send your assets directly to other creative tools.</p>
                    
                    <div className="space-y-3">
                        <button disabled={isExporting} onClick={() => simulateIntegration('Figma')} className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl group transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#F24E1E]/10 rounded-lg flex items-center justify-center text-[#F24E1E]">
                                    <Figma size={24} />
                                </div>
                                <div className="text-left">
                                    <h4 className="font-medium text-white group-hover:text-indigo-300 transition-colors">Figma</h4>
                                    <p className="text-xs text-slate-500">Send as SVG Component</p>
                                </div>
                            </div>
                            {apiSuccess === 'Figma' ? <Check size={20} className="text-green-500" /> : <div className="w-2 h-2 rounded-full bg-slate-600 group-hover:bg-indigo-500 transition-colors" />}
                        </button>

                        <button disabled={isExporting} onClick={() => simulateIntegration('Adobe XD')} className="w-full flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl group transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#470137]/30 rounded-lg flex items-center justify-center text-[#FF61F6]">
                                    <Laptop size={24} />
                                </div>
                                <div className="text-left">
                                    <h4 className="font-medium text-white group-hover:text-indigo-300 transition-colors">Adobe XD</h4>
                                    <p className="text-xs text-slate-500">Sync with Creative Cloud</p>
                                </div>
                            </div>
                            {apiSuccess === 'Adobe XD' ? <Check size={20} className="text-green-500" /> : <div className="w-2 h-2 rounded-full bg-slate-600 group-hover:bg-indigo-500 transition-colors" />}
                        </button>
                    </div>

                    {isExporting && (
                         <div className="flex items-center justify-center gap-2 text-indigo-400 text-sm py-2">
                             <Loader2 size={16} className="animate-spin" /> Processing Integration...
                         </div>
                    )}
                    {apiSuccess && (
                        <div className="text-green-400 text-sm text-center font-medium animate-in fade-in slide-in-from-bottom-2">
                            Successfully sent to {apiSuccess}!
                        </div>
                    )}
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default ExportModal;