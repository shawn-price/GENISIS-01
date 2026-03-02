import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Users, Phone, PhoneOff, Send, X, 
  GripVertical, Maximize, Minus, Globe, Wifi, Shield,
  Share2, Twitter, Facebook, Linkedin, Github
} from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';
import toast from 'react-hot-toast';

interface Message {
  from: string;
  fromId: string;
  text: string;
  timestamp: number;
}

interface User {
  id: string;
  name: string;
}

interface MessengerProps {
  onClose: () => void;
  resetTrigger?: number;
  userEmail?: string;
}

export const Messenger: React.FC<MessengerProps> = ({ onClose, resetTrigger, userEmail }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'contacts' | 'network'>('chat');
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isCalling, setIsCalling] = useState(false);
  const [callTarget, setCallTarget] = useState<User | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const { pos, onMouseDown, isDragging } = useDraggable({ x: 100, y: 100 }, resetTrigger);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', name: userEmail?.split('@')[0] || 'Anonymous' }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'chat_message':
          setMessages(prev => [...prev, data]);
          break;
        case 'user_list':
          setUsers(data.users);
          break;
        case 'webrtc_signal':
          handleSignalingData(data);
          break;
      }
    };

    return () => {
      ws.close();
      stopCall();
    };
  }, []);

  const sendMessage = () => {
    if (!inputText.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: 'chat_message', text: inputText }));
    setInputText('');
  };

  // --- WebRTC / VOIP Logic ---
  
  const startCall = async (target: User) => {
    try {
      setIsCalling(true);
      setCallTarget(target);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;
      
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'webrtc_signal',
            targetId: target.id,
            signal: { type: 'candidate', candidate: event.candidate }
          }));
        }
      };
      
      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      wsRef.current?.send(JSON.stringify({
        type: 'webrtc_signal',
        targetId: target.id,
        signal: { type: 'offer', offer }
      }));
      
      toast.success(`Calling ${target.name}...`);
    } catch (err) {
      console.error('Call failed:', err);
      toast.error('Could not access microphone');
      stopCall();
    }
  };

  const handleSignalingData = async (data: any) => {
    const { fromId, signal } = data;
    
    if (signal.type === 'offer') {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;
      
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'webrtc_signal',
            targetId: fromId,
            signal: { type: 'candidate', candidate: event.candidate }
          }));
        }
      };
      
      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };
      
      await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      wsRef.current?.send(JSON.stringify({
        type: 'webrtc_signal',
        targetId: fromId,
        signal: { type: 'answer', answer }
      }));
      
      setIsCalling(true);
      setCallTarget(users.find(u => u.id === fromId) || { id: fromId, name: 'Caller' });
      toast.success('Incoming call connected');
    } else if (signal.type === 'answer') {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(signal.answer));
    } else if (signal.type === 'candidate') {
      await pcRef.current?.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  };

  const stopCall = () => {
    setIsCalling(false);
    setCallTarget(null);
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    pcRef.current?.close();
    pcRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  };

  // --- Social Sharing ---
  const shareToSocial = (platform: string) => {
    const url = window.location.href;
    const text = "Check out my creation on Genesis One!";
    let shareUrl = "";

    switch (platform) {
      case 'twitter': shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`; break;
      case 'facebook': shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`; break;
      case 'linkedin': shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`; break;
      case 'instagram': shareUrl = `https://www.instagram.com/`; break; // Instagram doesn't have a direct share URL for web
      case 'github': shareUrl = `https://github.com/`; break;
    }

    if (shareUrl) window.open(shareUrl, '_blank');
    toast.success(`Shared to ${platform}`);
  };

  if (isMinimized) {
    return (
      <div 
        className="fixed z-50"
        style={{ left: pos.x, top: pos.y }}
      >
        <button 
          onClick={() => setIsMinimized(false)}
          className="p-4 bg-indigo-600 text-white rounded-full shadow-2xl hover:scale-110 transition-all"
        >
          <MessageSquare size={24} />
        </button>
      </div>
    );
  }

  return (
    <div 
      className="fixed z-50 w-80 h-[500px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y }}
    >
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
      
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-2">
          <div onMouseDown={onMouseDown} className="p-1 text-slate-400 cursor-grab hover:text-indigo-500 transition-colors">
            <GripVertical size={16} />
          </div>
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Messenger</h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(true)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><Minus size={16} /></button>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-red-500"><X size={16} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button onClick={() => setActiveTab('chat')} className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'chat' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>CHAT</button>
        <button onClick={() => setActiveTab('contacts')} className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'contacts' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>CONTACTS</button>
        <button onClick={() => setActiveTab('network')} className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === 'network' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500'}`}>NETWORK</button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'chat' && (
          <div className="flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.fromId === 'me' ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-slate-400 mb-1">{msg.from}</span>
                <div className={`px-3 py-2 rounded-2xl text-xs max-w-[80%] ${msg.fromId === 'me' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="flex flex-col gap-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                    {u.name[0]}
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{u.name}</span>
                </div>
                <button 
                  onClick={() => startCall(u)}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                >
                  <Phone size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'network' && (
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <Wifi size={14} className="text-indigo-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Connection Status</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Signal Strength</span>
                <div className="flex gap-0.5">
                  {[1,2,3,4].map(i => <div key={i} className={`w-1 h-3 rounded-full ${i <= 3 ? 'bg-green-500' : 'bg-slate-300'}`} />)}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={14} className="text-indigo-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Network Settings</span>
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[10px] text-slate-500">Full Duplex Audio</span>
                  <input type="checkbox" defaultChecked className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[10px] text-slate-500">P2P Encryption</span>
                  <input type="checkbox" defaultChecked className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </label>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <Share2 size={14} className="text-indigo-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Social Sharing</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                <button onClick={() => shareToSocial('twitter')} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-300 transition-colors"><Twitter size={16} className="mx-auto" /></button>
                <button onClick={() => shareToSocial('facebook')} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-300 transition-colors"><Facebook size={16} className="mx-auto" /></button>
                <button onClick={() => shareToSocial('linkedin')} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-300 transition-colors"><Linkedin size={16} className="mx-auto" /></button>
                <button onClick={() => shareToSocial('instagram')} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-300 transition-colors"><Globe size={16} className="mx-auto" /></button>
                <button onClick={() => shareToSocial('github')} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-300 transition-colors"><Github size={16} className="mx-auto" /></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Call Overlay */}
      <AnimatePresence>
        {isCalling && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 bg-indigo-600/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white z-[60]"
          >
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
              <Phone size={40} />
            </div>
            <h3 className="text-lg font-bold mb-1">{callTarget?.name}</h3>
            <p className="text-indigo-200 text-xs mb-8">VOIP Call in Progress</p>
            <button 
              onClick={stopCall}
              className="w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110"
            >
              <PhoneOff size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      {activeTab === 'chat' && (
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
          <button 
            onClick={sendMessage}
            className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
