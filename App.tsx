import React, { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CanvasElement, CanvasState, ToolType, ElementType, AIAction, AppSettings, Theme, CANVAS_SIZE, LayerType, ModelType } from './types';
import { HelpCircle, GripVertical, X, Palette, Layers, Mic } from 'lucide-react';
import { useDraggable } from './hooks/useDraggable';
import Toolbar from './components/Toolbar';
import LayerPanel from './components/LayerPanel';
import AISuitePanel from './components/AISuitePanel';
import { AssetManager } from './components/AssetManager';
import Artboard from './components/Canvas/Artboard';
import PromptBar from './components/PromptBar';
import SettingsModal from './components/SettingsModal';
import ExportModal from './components/ExportModal';
import FloatingOperationsPanel from './components/FloatingOperationsPanel';
import { HeaderMenu } from './components/HeaderMenu';
import { Collaborators } from './components/Collaborators';
import { SplashScreen } from './components/SplashScreen';
import TutorialOverlay from './components/TutorialOverlay';
import { Messenger } from './components/Messenger';
import { interpretVoiceCommand, interpretTextCommand, generateImageAsset, LiveBrain, editImageAsset, enhancePrompt, generateTtsResponse, getGreeting, getSuggestions } from './services/geminiService';
import { TutorialTip } from './types';
import toast, { Toaster } from 'react-hot-toast';
import { Key, Sparkles } from 'lucide-react';
import { seedDatabase, fetchDynamicModels, AIModel } from './services/firebaseService';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const TUTORIAL_TIPS: TutorialTip[] = [
  {
    id: 'welcome',
    title: 'Welcome to Genesis One',
    content: 'Genesis One is a voice-first AI design studio. You can build complex designs simply by speaking your ideas into existence.',
  },
  {
    id: 'active-listener',
    title: 'Active Listener (Always-On AI)',
    content: 'The CPU icon in the prompt bar indicates the Active Listener. When green, the AI is always listening for your commands. No wake-words needed!',
  },
  {
    id: 'manual-override',
    title: 'Manual Override',
    content: 'Need precise control? Click the Shield icon to enter Manual Override. This disables voice commands and reveals traditional design tools.',
  },
  {
    id: 'layer-panel',
    title: 'Layer Stack & Snapshots',
    content: 'Manage your design structure in the Layer Panel. You can also take Snapshots to save different versions of your work and restore them later.',
  },
  {
    id: 'prompt-bar',
    title: 'Prompt Bar',
    content: 'Use the prompt bar to type commands or hold the Mic icon for a quick voice request. The shortcuts menu (long press) gives you fast access to generators.',
  },
  {
    id: 'refinement',
    title: 'AI Refinement',
    content: 'Select an image to reveal the Refinement Panel. Here you can upscale, relight, or isolate subjects using specialized AI models.',
  },
];

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
};

const INITIAL_ELEMENTS: CanvasElement[] = [
    {
      id: '2',
      type: ElementType.TEXT,
      x: CANVAS_SIZE.width / 2 - 150, // Centered default text
      y: CANVAS_SIZE.height / 2 - 30,
      width: 300,
      height: 60,
      rotation: 0,
      opacity: 1,
      zIndex: 1,
      content: 'Hello Genesis',
      visible: true,
      locked: false,
      parentId: null,
      style: { color: '#f8fafc', fontSize: 32 }
    }
];

const INITIAL_STATE: CanvasState = {
  elements: INITIAL_ELEMENTS,
  selectedIds: [],
  zoom: 1,
  pan: { x: 0, y: 0 },
  history: [INITIAL_ELEMENTS], 
  historyIndex: 0,
  aspectRatio: '1:1',
  canvasSize: { width: 800, height: 800 },
  snapshots: [],
};

const INITIAL_SETTINGS: AppSettings = {
  imageModel: 'gemini-3-pro-image-preview',
  llmModel: 'gemini-3-flash-preview',
  liveModel: 'gemini-2.5-flash-native-audio-preview-09-2025',
  llmConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 2048,
    systemInstruction: "You are a precise design assistant. Output only valid JSON."
  },
  llmEndpoints: {
    llama: 'https://api.groq.com/openai/v1/chat/completions',
    rasa: 'http://localhost:5005/webhooks/rest/webhook',
    pipecat: 'http://localhost:8000/api/command'
  },
  imageConfig: {
    aspectRatio: '1:1',
    numberOfImages: 1,
    outputMimeType: 'image/jpeg'
  },
  promptTemplates: [
    { 
        id: 'default', 
        name: 'Standard Assistant', 
        content: "You are a precise design assistant. Output only valid JSON. Do not hallucinate properties." 
    }
  ],
  apiKeys: {},
  manualOverride: false,
  theme: 'dark',
  layout: 'floating',
  panelsTransparency: 90,
  accessibility: {
    highContrast: false,
    largeText: false,
    reduceMotion: false,
    screenReaderOptimized: false,
  },
  performance: {
    hardwareAcceleration: true,
    lowQualityPreview: false,
    maxHistoryStates: 50,
    autoSaveInterval: 5,
  },
  integrations: {
    huggingFace: false,
    googleDrive: false,
    slack: false,
    unsplash: false,
    instagram: false,
    figma: false,
    adobeCreativeCloud: false,
    notion: false,
    pinterest: false,
    dropbox: false,
  }
};

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const isMobile = useIsMobile();
  const [state, setState] = useState<CanvasState>(INITIAL_STATE);
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.SELECT);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  
  const effectiveLayout = isMobile ? 'floating' : settings.layout;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('dark');
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [isTtsActive, setIsTtsActive] = useState(false);
  const [isApiKeySelected, setIsApiKeySelected] = useState(true); // Default to true, check on mount
  const [showTutorialBtn, setShowTutorialBtn] = useState(true);
  const { pos: tutorialBtnPos, onMouseDown: onTutorialBtnMouseDown, isDragging: isTutorialBtnDragging } = useDraggable({ x: window.innerWidth - 120, y: 100 });
  const [isLayerPanelMinimized, setIsLayerPanelMinimized] = useState(true);
  const [isAISuiteMinimized, setIsAISuiteMinimized] = useState(false);
  const [isMessengerOpen, setIsMessengerOpen] = useState(false);
  const [isToolbarMinimized, setIsToolbarMinimized] = useState(false);
  const [isPromptBarMinimized, setIsPromptBarMinimized] = useState(false);
  const [isAssetManagerOpen, setIsAssetManagerOpen] = useState(true);
  const [isToolbarVisible, setIsToolbarVisible] = useState(true);
  const [isPromptBarVisible, setIsPromptBarVisible] = useState(true);
  const [isLayerPanelVisible, setIsLayerPanelVisible] = useState(true);
  const [isAISuiteVisible, setIsAISuiteVisible] = useState(true);
  const [layoutResetTrigger, setLayoutResetTrigger] = useState(0);
  const [hiddenTools, setHiddenTools] = useState<{ id: string; label: string; icon: React.ReactNode; onRestore: () => void }[]>([]);
  const [liveTranscription, setLiveTranscription] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [dynamicModels, setDynamicModels] = useState<AIModel[]>([]);
  const liveBrainRef = useRef<LiveBrain | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null);
  
  const quickImageRef = useRef<HTMLInputElement>(null);

  // Check API Key on Mount
  useEffect(() => {
    const initApp = async () => {
      // Seed database if needed
      try {
        await seedDatabase();
        const models = await fetchDynamicModels();
        setDynamicModels(models);
      } catch (e) {
        console.error("Firebase init error:", e);
      }

      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsApiKeySelected(hasKey);
      }
    };
    initApp();
  }, []);

  const handleOpenSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setIsApiKeySelected(true); // Assume success after opening dialog as per guidelines
    }
  };

  // Apply Theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Center Canvas on Mount and Resize
  useEffect(() => {
    const centerCanvas = () => {
      const centerX = (window.innerWidth - CANVAS_SIZE.width) / 2;
      const centerY = (window.innerHeight - CANVAS_SIZE.height) / 2;
      setState(prev => ({
          ...prev,
          pan: { x: centerX, y: centerY }
      }));
    };
    
    centerCanvas();
    
    window.addEventListener('resize', centerCanvas);
    return () => window.removeEventListener('resize', centerCanvas);
  }, []);

  const handleToggleManualOverride = () => {
    const newOverride = !settings.manualOverride;
    setSettings(prev => ({ ...prev, manualOverride: newOverride }));
    
    if (newOverride && isLiveActive) {
      liveBrainRef.current?.close();
      audioStreamRef.current?.getTracks().forEach(t => t.stop());
      setIsLiveActive(false);
    }
  };

  // --- Live API Handlers ---

  const handleLiveMessage = useCallback(async (message: any) => {
    // Handle User Transcription
    if (message.serverContent?.userTurn?.parts) {
      const parts = message.serverContent.userTurn.parts;
      for (const part of parts) {
        if (part.text) {
          setLiveTranscription(part.text);
        }
      }
    }

    if (message.serverContent?.modelTurn?.parts) {
      const parts = message.serverContent.modelTurn.parts;
      for (const part of parts) {
        if (part.inlineData) {
          // Play audio response
          const base64Audio = part.inlineData.data;
          const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
          if (audioContextRef.current) {
             const buffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
             const source = audioContextRef.current.createBufferSource();
             source.buffer = buffer;
             source.connect(audioContextRef.current.destination);
             source.start();
          }
        }
      }
    }

    if (message.toolCall) {
      const calls = message.toolCall.functionCalls;
      for (const call of calls) {
        const { name, args, id } = call;
        let result: any = { status: 'success' };

        try {
          switch (name) {
            case 'generateBackground':
              await handleGenerateLayer(args.prompt, LayerType.BACKGROUND, ModelType.IMAGEN);
              break;
            case 'generateSubject':
              let model = ModelType.GEMINI_PRO_IMAGE;
              if (args.model === 'FLUX') model = ModelType.FLUX;
              else if (args.model === 'DALLE3') model = ModelType.DALLE3;
              else if (args.model && ModelType[args.model as keyof typeof ModelType]) {
                model = ModelType[args.model as keyof typeof ModelType];
              }
              await handleGenerateLayer(args.prompt, LayerType.SUBJECT, model);
              break;
            case 'manageLayers':
              handleManageLayers(args.action, args.targetId, args.newIndex);
              break;
            case 'setLayerBlending':
              updateElement(args.targetId, { 
                opacity: args.opacity !== undefined ? args.opacity : undefined,
                style: args.blendMode ? { ...state.elements.find(e => e.id === args.targetId)?.style, mixBlendMode: args.blendMode } : undefined
              });
              break;
            case 'toggleLayerVisibility':
              updateElement(args.targetId, { visible: args.visible });
              break;
            case 'resizeCanvas':
              handleResizeCanvas(args.aspectRatio);
              break;
            case 'inpaintImage':
            case 'editLayer':
              await handleEditLayer(args.targetId, args.instruction);
              break;
            case 'outpaintImage':
              await handleOutpaintImage(args.targetId, args.direction, args.prompt);
              break;
            case 'enhanceImage':
              await handleEnhanceImage(args.targetId, args.type, args.instruction);
              break;
            case 'takeSnapshot':
              handleTakeSnapshot(args.name);
              break;
            case 'exportCanvas':
              setIsExportOpen(true);
              break;
            case 'updateCanvas':
              updateElement(args.targetId, { [args.property]: args.value });
              break;
          }
        } catch (err) {
          result = { status: 'error', message: String(err) };
        }

        liveBrainRef.current?.sendToolResponse(id, result);
      }
    }
  }, [settings]);

  const toggleLive = async () => {
    if (isLiveActive) {
      liveBrainRef.current?.close();
      audioStreamRef.current?.getTracks().forEach(t => t.stop());
      setIsLiveActive(false);
    } else {
      if (settings.manualOverride) {
          alert("Manual Override is active. Disable it to use the AI Brain.");
          return;
      }
      setIsProcessingAI(true);
      try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
        liveBrainRef.current = new LiveBrain(apiKey, handleLiveMessage);
        
        // Add canvas context to system instruction
        const canvasContext = `Current Canvas: ${state.elements.length} layers. Snapshots: ${state.snapshots.length}. 
        Layers: ${state.elements.map(el => `[${el.id.slice(0,4)}] ${el.type} at (${Math.round(el.x)},${Math.round(el.y)})`).join(', ')}.
        If a command is ambiguous, ask for clarification.`;
        
        await liveBrainRef.current.connect({
            ...settings,
            llmConfig: {
                ...settings.llmConfig,
                systemInstruction: settings.llmConfig.systemInstruction + "\n\n" + canvasContext
            }
        });

        // Greeting
        const greeting = await getGreeting();
        const ttsAudio = await generateTtsResponse(greeting);
        if (ttsAudio) await playAudioResponse(ttsAudio);
        toast.success(greeting, { icon: '👋' });

        // Setup Audio Capture
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;
        
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          // Convert Float32 to Int16 PCM
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          liveBrainRef.current?.sendAudio(base64);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
        
        setIsLiveActive(true);
      } catch (err) {
        console.error("Failed to start Live API:", err);
        alert("Could not start Live API. Check microphone permissions.");
      } finally {
        setIsProcessingAI(false);
      }
    }
  };

  // Active Listener: Removed auto-start as per user request
  useEffect(() => {
    // Both disengaged until user chooses otherwise
  }, []);

  const handleGenerateLayer = async (prompt: string, layerType: LayerType, model: ModelType) => {
    setIsProcessingAI(true);
    try {
      const refinedPrompt = await enhancePrompt(prompt, settings);
      const imageUrl = await generateImageAsset(refinedPrompt, { ...settings, imageModel: model });
      
      if (imageUrl) {
        const newEl: CanvasElement = {
          id: uuidv4(),
          type: ElementType.IMAGE,
          x: layerType === LayerType.BACKGROUND ? 0 : state.canvasSize.width / 2 - 200,
          y: layerType === LayerType.BACKGROUND ? 0 : state.canvasSize.height / 2 - 200,
          width: layerType === LayerType.BACKGROUND ? state.canvasSize.width : 400,
          height: layerType === LayerType.BACKGROUND ? state.canvasSize.height : 400,
          rotation: 0,
          opacity: 1,
          zIndex: layerType === LayerType.BACKGROUND ? -1 : state.elements.length,
          content: imageUrl,
          visible: true,
          locked: false,
          parentId: null,
          layerType,
          modelId: model
        };
        addElement(newEl);
      }
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleManageLayers = (action: string, targetId?: string, newIndex?: number) => {
    if (action === 'DELETE' && targetId) {
      deleteElements([targetId]);
    } else if (action === 'REORDER' && targetId && newIndex !== undefined) {
      updateElement(targetId, { zIndex: newIndex });
    }
  };

  const handleResizeCanvas = (aspectRatio: string) => {
    let width = 800;
    let height = 800;
    if (aspectRatio === '16:9') {
      width = 1066;
      height = 600;
    } else if (aspectRatio === '9:16') {
      width = 450;
      height = 800;
    } else if (aspectRatio === '4:3') {
      width = 800;
      height = 600;
    }
    setState(prev => ({
      ...prev,
      aspectRatio,
      canvasSize: { width, height }
    }));
  };

  const handleOutpaintImage = async (targetId: string, direction: string, prompt: string) => {
    const instruction = `Expand this image to the ${direction}. New content: ${prompt}`;
    await handleEditLayer(targetId, instruction);
  };

  const handleEnhanceImage = async (targetId: string, type: string, instruction: string) => {
    const fullInstruction = `Apply ${type} enhancement: ${instruction}`;
    await handleEditLayer(targetId, fullInstruction);
  };

  const handleTakeSnapshot = (name?: string) => {
    const snapshot = {
      id: uuidv4(),
      name: name || `Snapshot ${new Date().toLocaleTimeString()}`,
      elements: [...state.elements],
      timestamp: Date.now()
    };
    setState(prev => ({
      ...prev,
      snapshots: [...prev.snapshots, snapshot]
    }));
  };

  const handleApplySnapshot = (id: string) => {
    const snapshot = state.snapshots.find(s => s.id === id);
    if (snapshot) {
      setState(prev => ({
        ...prev,
        elements: snapshot.elements,
        history: [...prev.history, snapshot.elements],
        historyIndex: prev.historyIndex + 1
      }));
    }
  };

  const handleDeleteSnapshot = (id: string) => {
    setState(prev => ({
      ...prev,
      snapshots: prev.snapshots.filter(s => s.id !== id)
    }));
  };

  const handleEditLayer = async (targetId: string, instruction: string) => {
    const element = state.elements.find(el => el.id === targetId || (targetId === 'selection' && state.selectedIds.includes(el.id)));
    if (!element || element.type !== ElementType.IMAGE) return;

    setIsProcessingAI(true);
    try {
      const newUrl = await editImageAsset(element.content, instruction, settings);
      if (newUrl) {
        updateElement(element.id, { content: newUrl });
      }
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleNewSketch = () => {
    if (confirm("Start a new project? All current layers will be deleted and settings reset to default.")) {
      const centerX = (window.innerWidth - CANVAS_SIZE.width) / 2;
      const centerY = (window.innerHeight - CANVAS_SIZE.height) / 2;
      setState({
          elements: [],
          selectedIds: [],
          zoom: 1,
          pan: { x: centerX, y: centerY },
          history: [[]],
          historyIndex: 0
      });
      setSettings(INITIAL_SETTINGS);
    }
  };

  const handleSave = () => {
    try {
        const projectData = {
            state,
            settings,
            savedAt: new Date().toISOString(),
            version: '1.0'
        };
        localStorage.setItem('aether_canvas_save', JSON.stringify(projectData));
        alert("Project saved successfully to local storage!");
    } catch (e) {
        console.error("Save failed", e);
        alert("Failed to save project. Storage might be full.");
    }
  };

  const handleOpenGallery = () => {
    const saved = localStorage.getItem('aether_canvas_save');
    if (saved) {
      if (confirm("Load last saved project? Unsaved changes will be lost.")) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.state) {
              setState(parsed.state);
              if (parsed.settings) {
                  setSettings(parsed.settings);
              }
          } else {
              // Backward compatibility for old saves
              setState(parsed);
          }
        } catch (e) {
          alert("Failed to load project: Corrupt data.");
        }
      }
    } else {
      alert("No saved projects found in Gallery.");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.includes('json')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          // Handle both full project export and simple state export
          if (parsed.state) {
             setState(parsed.state);
             if (parsed.settings) setSettings(parsed.settings);
          } else {
             setState(parsed);
          }
        } catch (err) {
          alert("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    } else if (file.type.includes('image')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
         const imgData = ev.target?.result as string;
         // Place new image in center of canvas
         const newEl: CanvasElement = {
            id: uuidv4(),
            type: ElementType.IMAGE,
            x: CANVAS_SIZE.width / 2 - 200,
            y: CANVAS_SIZE.height / 2 - 150,
            width: 400,
            height: 300,
            rotation: 0,
            opacity: 1,
            zIndex: state.elements.length,
            content: imgData,
            visible: true, locked: false, parentId: null
         };
         addElement(newEl);
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleExport = () => {
    setIsExportOpen(true);
  };

  const handleStartTutorial = () => {
    // Clear canvas as requested
    setState(prev => ({
        ...prev,
        elements: [],
        selectedIds: [],
        history: [[]],
        historyIndex: 0
    }));
    
    // Expand all panels
    setIsLayerPanelMinimized(false);
    setIsToolbarMinimized(false);
    setIsPromptBarMinimized(false);
    
    setIsTutorialActive(true);
    setCurrentTipIndex(0);
  };

  const handleNextTip = () => {
    if (currentTipIndex < TUTORIAL_TIPS.length - 1) {
      setCurrentTipIndex(prev => prev + 1);
    }
  };

  const handlePrevTip = () => {
    if (currentTipIndex > 0) {
      setCurrentTipIndex(prev => prev - 1);
    }
  };

  const handleCloseTutorial = () => {
    setIsTutorialActive(false);
    setIsTtsActive(false);
  };

  useEffect(() => {
    const handleResize = () => {
      setState(prev => {
        const centerX = (window.innerWidth - CANVAS_SIZE.width * prev.zoom) / 2;
        const centerY = (window.innerHeight - CANVAS_SIZE.height * prev.zoom) / 2;
        return { ...prev, pan: { x: centerX, y: centerY } };
      });
    };
    window.addEventListener('resize', handleResize);
    // Initial centering if pan is 0,0 (first load)
    if (state.pan.x === 0 && state.pan.y === 0) {
        handleResize();
    }
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- History Helper ---
  const withHistory = (prevState: CanvasState, newElements: CanvasElement[]): CanvasState => {
    const newHistory = prevState.history.slice(0, prevState.historyIndex + 1);
    newHistory.push(newElements);
    return {
        ...prevState,
        elements: newElements,
        history: newHistory,
        historyIndex: newHistory.length - 1
    };
  };

  const undo = useCallback(() => {
    setState(prev => {
        if (prev.historyIndex > 0) {
            const newIndex = prev.historyIndex - 1;
            return {
                ...prev,
                historyIndex: newIndex,
                elements: prev.history[newIndex],
                selectedIds: [] 
            };
        }
        return prev;
    });
  }, []);

  const redo = useCallback(() => {
    setState(prev => {
        if (prev.historyIndex < prev.history.length - 1) {
            const newIndex = prev.historyIndex + 1;
            return {
                ...prev,
                historyIndex: newIndex,
                elements: prev.history[newIndex],
                selectedIds: []
            };
        }
        return prev;
    });
  }, []);

  // --- State Modifiers ---

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setState(prev => {
        const newElements = prev.elements.map(el => el.id === id ? { ...el, ...updates } : el);
        if (JSON.stringify(prev.elements) !== JSON.stringify(newElements)) {
            return withHistory(prev, newElements);
        }
        return prev;
    });
  }, []);

  const addElement = useCallback((element: CanvasElement) => {
    const elementWithModel = {
        ...element,
        modelId: element.modelId || settings.imageModel
    };

    setState(prev => {
        const newElements = [...prev.elements, elementWithModel];
        return {
            ...withHistory(prev, newElements),
            selectedIds: [elementWithModel.id]
        };
    });
  }, [settings.imageModel]);

  const deleteElements = useCallback((ids: string[]) => {
    setState(prev => {
        // Also delete children if a group is deleted
        const idsToDelete = new Set(ids);
        prev.elements.forEach(el => {
            if (el.parentId && idsToDelete.has(el.parentId)) {
                idsToDelete.add(el.id);
            }
        });

        const newElements = prev.elements.filter(el => !idsToDelete.has(el.id));
        return {
            ...withHistory(prev, newElements),
            selectedIds: []
        };
    });
  }, []);

  const handleSelect = useCallback((id: string | null, multi: boolean = false) => {
      setState(prev => {
          if (id === null) {
              return { ...prev, selectedIds: [] };
          }
          let targetId = id;
          const el = prev.elements.find(e => e.id === id);
          if (el && el.parentId) {
              targetId = el.parentId;
          }

          if (multi) {
              const alreadySelected = prev.selectedIds.includes(targetId);
              return {
                  ...prev,
                  selectedIds: alreadySelected 
                    ? prev.selectedIds.filter(pid => pid !== targetId)
                    : [...prev.selectedIds, targetId]
              };
          } else {
              return { ...prev, selectedIds: [targetId] };
          }
      });
  }, []);

  const handleGroup = useCallback(() => {
    setState(prev => {
        if (prev.selectedIds.length < 2) return prev;
        const groupId = uuidv4();
        const newGroup: CanvasElement = {
            id: groupId,
            type: ElementType.GROUP,
            x: 0, y: 0, width: 0, height: 0, 
            rotation: 0, opacity: 1, zIndex: prev.elements.length,
            content: 'Group',
            visible: true, locked: false, parentId: null, expanded: true
        };
        const newElements = prev.elements.map(el => {
            if (prev.selectedIds.includes(el.id)) {
                return { ...el, parentId: groupId };
            }
            return el;
        });
        return {
            ...withHistory(prev, [...newElements, newGroup]),
            selectedIds: [groupId]
        };
    });
  }, []);

  const handleUngroup = useCallback(() => {
    setState(prev => {
        const groupsToUngroup = prev.selectedIds.filter(id => prev.elements.find(e => e.id === id)?.type === ElementType.GROUP);
        if (groupsToUngroup.length === 0) return prev;
        const newElements = prev.elements.filter(el => !groupsToUngroup.includes(el.id)).map(el => {
            if (el.parentId && groupsToUngroup.includes(el.parentId)) {
                return { ...el, parentId: null };
            }
            return el;
        });
        return {
            ...withHistory(prev, newElements),
            selectedIds: []
        };
    });
  }, []);

  const toggleVisibility = useCallback((id: string) => {
      setState(prev => {
          const newElements = prev.elements.map(el => el.id === id ? { ...el, visible: !el.visible } : el);
          return withHistory(prev, newElements);
      });
  }, []);

  const toggleLock = useCallback((id: string) => {
      setState(prev => {
          const newElements = prev.elements.map(el => el.id === id ? { ...el, locked: !el.locked } : el);
          return withHistory(prev, newElements);
      });
  }, []);

  const handleReorderLayers = useCallback((draggedId: string, targetId: string) => {
    setState(prev => {
      const visualIds = [...prev.elements].sort((a, b) => b.zIndex - a.zIndex).map(el => el.id);
      const fromIndex = visualIds.indexOf(draggedId);
      const toIndex = visualIds.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      visualIds.splice(fromIndex, 1);
      visualIds.splice(toIndex, 0, draggedId);
      const total = visualIds.length;
      const newElements = prev.elements.map(el => {
        const newVisualIndex = visualIds.indexOf(el.id);
        return { ...el, zIndex: total - 1 - newVisualIndex };
      });
      return withHistory(prev, newElements);
    });
  }, []);

  const setPanZoom = useCallback((pan: { x: number; y: number }, zoom: number) => {
    setState(prev => ({ ...prev, pan, zoom }));
  }, []);

  const handleAddLayer = useCallback(() => {
    let type: ElementType = ElementType.EMPTY;
    let content = '';
    let width = 200;
    let height = 200;
    let style: any = {};
    let shapeType: 'rectangle' | 'circle' | undefined = undefined;

    switch (activeTool) {
        case ToolType.RECTANGLE:
            type = ElementType.SHAPE;
            content = 'rect';
            shapeType = 'rectangle';
            style = { backgroundColor: '#64748b' };
            break;
        case ToolType.TEXT:
            type = ElementType.TEXT;
            content = 'New Text';
            width = 300;
            height = 60;
            style = { color: '#f8fafc', fontSize: 32 };
            break;
        case ToolType.IMAGE:
            type = ElementType.IMAGE;
            content = 'https://picsum.photos/300/200';
            width = 300;
            height = 200;
            break;
        case ToolType.ART_GEN:
            type = ElementType.ART_GEN;
            content = ''; 
            width = 300;
            height = 300;
            style = { backgroundColor: '#1e1b4b' };
            break;
        case ToolType.SELECT:
        case ToolType.HAND:
        default:
            type = ElementType.EMPTY;
            content = '';
            style = { borderStyle: 'dashed', borderWidth: 2, borderColor: '#475569' };
            break;
    }

    const newEl: CanvasElement = {
        id: uuidv4(),
        type,
        shapeType,
        x: CANVAS_SIZE.width / 2 - width / 2, // Center new items
        y: CANVAS_SIZE.height / 2 - height / 2,
        width,
        height,
        rotation: 0,
        opacity: 1,
        zIndex: state.elements.length,
        content,
        visible: true,
        locked: false,
        parentId: null,
        modelId: settings.imageModel,
        style
    };
    addElement(newEl);
  }, [addElement, activeTool, settings.imageModel, state.elements.length]);

  const handleQuickAction = useCallback((type: 'ART_GEN' | 'IMAGE' | 'TEXT' | 'SHAPE') => {
      if (type === 'IMAGE') {
          quickImageRef.current?.click();
          return;
      }
      
      let newType = ElementType.EMPTY;
      let content = '';
      let width = 200;
      let height = 200;
      let style: any = {};
      let shapeType: 'rectangle' | 'circle' | undefined = undefined;

      if (type === 'ART_GEN') {
          newType = ElementType.ART_GEN;
          width = 300;
          height = 300;
          style = { backgroundColor: '#1e1b4b' };
      } else if (type === 'TEXT') {
          newType = ElementType.TEXT;
          content = 'Quick Text';
          width = 300;
          height = 60;
          style = { color: '#f8fafc', fontSize: 32 };
      } else if (type === 'SHAPE') {
          newType = ElementType.SHAPE;
          shapeType = 'rectangle';
          content = 'rect';
          style = { backgroundColor: '#64748b' };
      }

      const newEl: CanvasElement = {
        id: uuidv4(),
        type: newType,
        shapeType,
        x: CANVAS_SIZE.width / 2 - width / 2,
        y: CANVAS_SIZE.height / 2 - height / 2,
        width,
        height,
        rotation: 0,
        opacity: 1,
        zIndex: state.elements.length,
        content,
        visible: true,
        locked: false,
        parentId: null,
        modelId: settings.imageModel,
        style
      };
      addElement(newEl);

  }, [addElement, state.elements.length, settings.imageModel]);

  // --- AI Context ---
  
  const getCanvasContext = useCallback(() => {
    return JSON.stringify({
      meta: {
        selectedElementIds: state.selectedIds,
        viewport: {
          zoom: state.zoom.toFixed(2),
          pan: { x: state.pan.x.toFixed(0), y: state.pan.y.toFixed(0) }
        }
      },
      elements: state.elements.map(e => ({
        id: e.id,
        type: e.type,
        visible: e.visible,
        locked: e.locked,
        geometry: { x: Math.round(e.x), y: Math.round(e.y), width: Math.round(e.width), height: Math.round(e.height) },
        appearance: { opacity: e.opacity, zIndex: e.zIndex, ...e.style },
        content: e.type === ElementType.TEXT ? e.content : `[${e.type}]`
      }))
    });
  }, [state.elements, state.selectedIds, state.zoom, state.pan]);

  // --- AI Handlers ---
  const executeAIAction = async (aiResponse: AIAction) => {
    const { action, parameters } = aiResponse;
    toast.success(`AI: ${aiResponse.reasoning || 'Executing command...'}`, {
        icon: '🤖',
        style: {
          borderRadius: '10px',
          background: '#1e293b',
          color: '#fff',
          fontSize: '14px'
        },
    });

    // Update suggestions after action
    setTimeout(async () => {
      const newSuggestions = await getSuggestions(getCanvasContext());
      setSuggestions(newSuggestions);
    }, 1000);

    switch (action) {
      case 'ADD_ELEMENT': {
        const newEl: CanvasElement = {
          id: uuidv4(),
          type: parameters.elementType || ElementType.SHAPE,
          x: 400, y: 300, width: 200, height: 200, rotation: 0, opacity: 1, zIndex: state.elements.length,
          content: parameters.content || '', visible: true, locked: false, parentId: null, modelId: settings.imageModel,
          style: { backgroundColor: parameters.elementType === 'SHAPE' ? '#64748b' : undefined, color: '#fff', fontSize: 24 }
        };
        addElement(newEl);
        break;
      }
      case 'UPDATE_ELEMENT': {
        const targetIds = parameters.targetId === 'selection' ? state.selectedIds : [parameters.targetId];
        targetIds.forEach((targetId: string) => {
            const updates: any = {};
            const p = parameters.property; const v = parameters.value;
            if (['x','y','width','height','opacity','rotation'].includes(p)) updates[p] = parseFloat(v);
            else if (p === 'color') {
                const el = state.elements.find(e => e.id === targetId);
                if (el?.type === ElementType.TEXT) updates.style = { ...el.style, color: v };
                else updates.style = { ...el?.style, backgroundColor: v };
            } else if (p === 'text' || p === 'content') updates.content = v;
            else if (p === 'visible') updates.visible = v === 'true';
            else if (p === 'locked') updates.locked = v === 'true';
            updateElement(targetId, updates);
        });
        break;
      }
      case 'GENERATE_IMAGE': {
        try {
            const base64Image = await generateImageAsset(parameters.imagePrompt, settings);
            if (base64Image) {
                const newEl: CanvasElement = {
                    id: uuidv4(), type: ElementType.IMAGE, x: 200, y: 200, width: 512, height: 512, rotation: 0, opacity: 1, zIndex: state.elements.length,
                    content: base64Image, visible: true, locked: false, parentId: null, modelId: settings.imageModel
                };
                addElement(newEl);
            }
        } catch (e) { console.error("Failed to generate"); }
        break;
      }
      case 'DELETE_ELEMENT': {
        if (parameters.targetId === 'selection') deleteElements(state.selectedIds);
        else deleteElements([parameters.targetId]);
        break;
      }
      case 'GENERATE_FULL_CANVAS': {
        handleQuickAction('ART_GEN'); // Simplified: trigger standard art gen with prompt
        break;
      }
      case 'GENERATE_ELEMENT': {
        const newEl: CanvasElement = {
          id: uuidv4(), type: ElementType.ART_GEN, x: 200, y: 200, width: 400, height: 400, rotation: 0, opacity: 1, zIndex: state.elements.length,
          content: '', visible: true, locked: false, parentId: null, modelId: settings.imageModel,
          genConfig: { prompt: parameters.prompt }
        };
        addElement(newEl);
        break;
      }
      case 'GENERATE_TEXTURE': {
        const newEl: CanvasElement = {
          id: uuidv4(), type: ElementType.ART_GEN, x: 0, y: 0, width: 800, height: 800, rotation: 0, opacity: 0.5, zIndex: 0,
          content: '', visible: true, locked: true, parentId: null, modelId: settings.imageModel,
          genConfig: { prompt: `Seamless texture of ${parameters.style_type}, high detail, high resolution` }
        };
        addElement(newEl);
        break;
      }
      case 'INITIALIZE_CANVAS': {
        const preset = parameters.presets;
        if (preset === 'TikTok') handleResizeCanvas('9:16');
        else if (preset === 'Web') handleResizeCanvas('16:9');
        else if (preset === 'Instagram') handleResizeCanvas('4:5');
        else handleResizeCanvas('1:1');
        break;
      }
      case 'SMART_ERASE': {
        toast.success("Smart Erase initiated on selected area...");
        // Placeholder for real AI erase logic
        break;
      }
      case 'IN_PAINT_REPLACE': {
        toast.success(`In-painting: ${parameters.new_prompt}`);
        // Placeholder for in-painting logic
        break;
      }
      case 'SUBJECT_EXTRACTION': {
        toast.success("Extracting subject to new layer...");
        // Placeholder for extraction logic
        break;
      }
      case 'NEURAL_UPSCALE': {
        toast.success(`Upscaling by factor ${parameters.factor}...`);
        break;
      }
      case 'ADJUST_LIGHTING': {
        toast.success(`Adjusting lighting to ${parameters.mood} from ${parameters.direction}...`);
        break;
      }
      case 'STANDARD_TRANSFORM': {
        const targetId = parameters.layer_id === 'selection' ? state.selectedIds[0] : parameters.layer_id;
        if (targetId) {
          updateElement(targetId, {
            width: parameters.scale ? state.elements.find(e => e.id === targetId)!.width * parameters.scale : undefined,
            height: parameters.scale ? state.elements.find(e => e.id === targetId)!.height * parameters.scale : undefined,
            rotation: parameters.rotation
          });
        }
        break;
      }
      case 'SET_BLEND_MODE': {
        const targetId = parameters.layer_id === 'selection' ? state.selectedIds[0] : parameters.layer_id;
        if (targetId) {
          updateElement(targetId, { style: { ...state.elements.find(e => e.id === targetId)?.style, mixBlendMode: parameters.mode } });
        }
        break;
      }
      case 'AUTO_STACK': {
        // Simple logic: background at bottom, others on top
        state.elements.forEach(el => {
          if (el.layerType === LayerType.BACKGROUND) updateElement(el.id, { zIndex: 0 });
          else updateElement(el.id, { zIndex: state.elements.length });
        });
        break;
      }
      case 'MERGE_VISIBLE': {
        toast.success("Layers merged for export.");
        break;
      }
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(blob);
    });
  };

  const playAudioResponse = async (base64Audio: string) => {
    const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
    if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    try {
        const buffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.start();
    } catch (e) {
        console.error("Audio playback failed", e);
    }
  };

  const handleVoiceCommand = async (audioBlob: Blob) => {
    setIsProcessingAI(true);
    try {
        const base64Audio = await blobToBase64(audioBlob);
        const result = await interpretVoiceCommand(base64Audio, getCanvasContext(), settings);
        await executeAIAction(result);
        
        // Talk back
        const ttsAudio = await generateTtsResponse(result.reasoning);
        if (ttsAudio) await playAudioResponse(ttsAudio);
    } finally { setIsProcessingAI(false); }
  };

  const handleTextCommand = async (text: string) => {
    setIsProcessingAI(true);
    try {
        const result = await interpretTextCommand(text, getCanvasContext(), settings);
        await executeAIAction(result);

        // Talk back
        const ttsAudio = await generateTtsResponse(result.reasoning);
        if (ttsAudio) await playAudioResponse(ttsAudio);
    } finally { setIsProcessingAI(false); }
  };
  
  if (showSplash) {
      return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!isApiKeySelected) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-indigo-600/20">
          <Key size={40} />
        </div>
        <h1 className="text-3xl font-bold mb-4">API Key Required</h1>
        <p className="text-slate-400 max-w-md mb-8">
          Genesis One uses advanced Gemini 3 models which require a paid API key from a Google Cloud project.
        </p>
        <button 
          onClick={handleOpenSelectKey}
          className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
        >
          Select API Key
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-6 text-slate-500 hover:text-indigo-400 text-sm underline underline-offset-4"
        >
          Learn about Gemini API billing
        </a>
      </div>
    );
  }

  return (
    <div className="w-full h-[100dvh] flex flex-col relative overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Toaster position="top-center" />
      <HeaderMenu 
        theme={theme}
        isCollaborating={isCollaborating}
        onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
        onToggleCollaboration={() => setIsCollaborating(!isCollaborating)}
        onNewSketch={handleNewSketch}
        onSave={handleSave}
        onImport={handleImport}
        onExport={handleExport}
        onOpenGallery={handleOpenGallery}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAssets={() => setIsAssetManagerOpen(true)}
        onOpenMessenger={() => setIsMessengerOpen(true)}
        onResetLayout={() => {
            setIsToolbarVisible(true);
            setIsLayerPanelVisible(true);
            setIsAISuiteVisible(true);
            setIsPromptBarVisible(true);
            setIsMessengerOpen(false);
            setIsToolbarMinimized(false);
            setIsLayerPanelMinimized(false);
            setIsAISuiteMinimized(false);
            setIsPromptBarMinimized(false);
            setHiddenTools([]);
            setShowTutorialBtn(true);
            setLayoutResetTrigger(prev => prev + 1);
        }}
      />

      {isAssetManagerOpen && (
          <AssetManager 
              onSelectColor={(color) => {
                  if (state.selectedIds.length > 0) {
                      state.selectedIds.forEach(id => {
                          const el = state.elements.find(e => e.id === id);
                          if (el) {
                              if (el.type === ElementType.TEXT) {
                                  updateElement(id, { style: { ...el.style, color } });
                              } else {
                                  updateElement(id, { style: { ...el.style, backgroundColor: color } });
                              }
                          }
                      });
                  }
                  toast.success(`Color ${color} selected`);
              } }
              onSelectAsset={(asset) => {
                  const newEl: CanvasElement = {
                      id: uuidv4(),
                      type: ElementType.TEXT, // Placeholder for asset type
                      x: CANVAS_SIZE.width / 2 - 50,
                      y: CANVAS_SIZE.height / 2 - 50,
                      width: 100,
                      height: 100,
                      rotation: 0,
                      opacity: 1,
                      zIndex: state.elements.length + 1,
                      content: asset.icon,
                      visible: true,
                      locked: false,
                      parentId: null,
                      style: { fontSize: 64 }
                  };
                  setState(prev => ({
                      ...prev,
                      elements: [...prev.elements, newEl],
                      history: [...prev.history.slice(0, prev.historyIndex + 1), [...prev.elements, newEl]],
                      historyIndex: prev.historyIndex + 1
                  }));
                  toast.success(`Asset ${asset.name} added`);
              } }
              onSelectProject={(project) => toast.success(`Opening project: ${project.name}`)}
              hiddenTools={hiddenTools}
              onClose={() => setIsAssetManagerOpen(false)}
          />
      )}
      <div className="flex-1 relative overflow-hidden">
        {isCollaborating && <Collaborators />}
        {isToolbarVisible && (
            <Toolbar 
                activeTool={activeTool} 
                onSelectTool={setActiveTool} 
                isMinimized={isToolbarMinimized}
                onToggleMinimize={setIsToolbarMinimized}
                onClose={() => {
                    setIsToolbarVisible(false);
                    setHiddenTools(prev => [...prev, { 
                        id: 'toolbar', 
                        label: 'Toolbar', 
                        icon: <Palette size={16} />, 
                        onRestore: () => {
                            setIsToolbarVisible(true);
                            setHiddenTools(current => current.filter(t => t.id !== 'toolbar'));
                        }
                    }]);
                }}
                layout={effectiveLayout}
                resetTrigger={layoutResetTrigger}
            />
        )}
        <div className={`absolute inset-0 ${effectiveLayout === 'stack' ? 'left-16 right-80 top-12 bottom-16' : ''}`}>
            <Artboard 
                elements={state.elements}
                zoom={state.zoom}
                pan={state.pan}
                activeTool={activeTool}
                selectedIds={state.selectedIds}
                canvasSize={state.canvasSize}
                onSelect={handleSelect}
                onUpdateElement={updateElement}
                onPanZoomChange={setPanZoom}
            />
        </div>
        <FloatingOperationsPanel 
            selectedElements={state.elements.filter(el => state.selectedIds.includes(el.id))}
            onDelete={() => deleteElements(state.selectedIds)}
            onUpdate={updateElement}
            onVoiceCommand={handleVoiceCommand}
            isProcessing={isProcessingAI}
            zoom={state.zoom}
            pan={state.pan}
            onEnhance={handleEnhanceImage}
            layout={effectiveLayout}
            resetTrigger={layoutResetTrigger}
        />
        {isLayerPanelVisible && (
            <LayerPanel 
                elements={state.elements}
                selectedIds={state.selectedIds}
                onSelect={handleSelect}
                onDelete={() => deleteElements(state.selectedIds)}
                onReorder={handleReorderLayers}
                onAddLayer={handleAddLayer}
                onUndo={undo}
                onRedo={redo}
                canUndo={state.historyIndex > 0}
                canRedo={state.historyIndex < state.history.length - 1}
                onUpdateLayerModel={(id, modelId) => updateElement(id, { modelId })}
                onUpdateElement={updateElement}
                settings={settings}
                onGroup={handleGroup}
                onUngroup={handleUngroup}
                onToggleVisibility={toggleVisibility}
                onToggleLock={toggleLock}
                snapshots={state.snapshots}
                onApplySnapshot={handleApplySnapshot}
                onDeleteSnapshot={handleDeleteSnapshot}
                canvasSize={state.canvasSize}
                aspectRatio={state.aspectRatio}
                onResizeCanvas={handleResizeCanvas}
                isMinimized={isLayerPanelMinimized}
                onToggleMinimize={setIsLayerPanelMinimized}
                onClose={() => {
                    setIsLayerPanelVisible(false);
                    setHiddenTools(prev => [...prev, { 
                        id: 'layers', 
                        label: 'Layers', 
                        icon: <Layers size={16} />, 
                        onRestore: () => {
                            setIsLayerPanelVisible(true);
                            setHiddenTools(current => current.filter(t => t.id !== 'layers'));
                        }
                    }]);
                }}
                layout={effectiveLayout}
                resetTrigger={layoutResetTrigger}
            />
        )}

        {isAISuiteVisible && (
            <AISuitePanel 
                onAction={executeAIAction}
                isProcessing={isProcessingAI}
                isMinimized={isAISuiteMinimized}
                onToggleMinimize={setIsAISuiteMinimized}
                onClose={() => {
                    setIsAISuiteVisible(false);
                    setHiddenTools(prev => [...prev, { 
                        id: 'ai-suite', 
                        label: 'AI Suite', 
                        icon: <Sparkles size={16} />, 
                        onRestore: () => {
                            setIsAISuiteVisible(true);
                            setHiddenTools(current => current.filter(t => t.id !== 'ai-suite'));
                        }
                    }]);
                }}
                resetTrigger={layoutResetTrigger}
            />
        )}

        {isMessengerOpen && (
            <Messenger 
                onClose={() => setIsMessengerOpen(false)}
                resetTrigger={layoutResetTrigger}
                userEmail="seanlawal@gmail.com"
            />
        )}
        
        {/* Hidden Input for Quick Import */}
        <input 
            type="file" 
            ref={quickImageRef} 
            className="hidden" 
            onChange={handleImport} 
            accept="image/*" 
        />
        
        {isPromptBarVisible && (
            <PromptBar 
                isProcessing={isProcessingAI}
                isLiveActive={isLiveActive}
                manualOverride={settings.manualOverride}
                onVoiceCommand={handleVoiceCommand}
                onTextCommand={handleTextCommand}
                onQuickAction={handleQuickAction}
                onToggleLive={toggleLive}
                onToggleManualOverride={handleToggleManualOverride}
                isMinimized={isPromptBarMinimized}
                onToggleMinimize={setIsPromptBarMinimized}
                onClose={() => {
                    setIsPromptBarVisible(false);
                    setHiddenTools(prev => [...prev, { 
                        id: 'prompt-bar', 
                        label: 'Prompt Bar', 
                        icon: <Mic size={16} />, 
                        onRestore: () => {
                            setIsPromptBarVisible(true);
                            setHiddenTools(current => current.filter(t => t.id !== 'prompt-bar'));
                        }
                    }]);
                }}
                layout={effectiveLayout}
                transcription={liveTranscription}
                suggestions={suggestions}
                resetTrigger={layoutResetTrigger}
            />
        )}
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            onUpdateSettings={setSettings}
            dynamicModels={dynamicModels}
        />
        <ExportModal 
            isOpen={isExportOpen} 
            onClose={() => setIsExportOpen(false)}
        />

        {/* Floating Tutorial Button */}
        {showTutorialBtn && (
            <div 
                className={`fixed z-40 flex items-center gap-2 ${isTutorialBtnDragging ? 'scale-110 opacity-80' : ''}`}
                style={{ left: tutorialBtnPos.x, top: tutorialBtnPos.y }}
            >
                <div 
                    onMouseDown={onTutorialBtnMouseDown}
                    className="p-1 text-slate-400 cursor-grab hover:text-indigo-500 transition-colors"
                >
                    <GripVertical size={16} />
                </div>
                <div className="relative group">
                    <button 
                        onClick={handleStartTutorial}
                        className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-600/30 transition-all hover:scale-110"
                        title="Start Tutorial"
                    >
                        <HelpCircle size={24} className="group-hover:rotate-12 transition-transform" />
                        <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                            SYSTEM TUTORIAL
                        </div>
                    </button>
                    <button 
                        onClick={() => {
                            setShowTutorialBtn(false);
                            setHiddenTools(prev => [
                                ...prev, 
                                { 
                                    id: 'tutorial', 
                                    label: 'Tutorial', 
                                    icon: <HelpCircle size={16} />, 
                                    onRestore: () => {
                                        setShowTutorialBtn(true);
                                        setHiddenTools(current => current.filter(t => t.id !== 'tutorial'));
                                    }
                                }
                            ]);
                        }}
                        className="absolute -top-2 -right-2 p-1 bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-red-500 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm transition-all opacity-0 group-hover:opacity-100"
                    >
                        <X size={10} />
                    </button>
                </div>
            </div>
        )}

        {isTutorialActive && (
            <TutorialOverlay 
                tips={TUTORIAL_TIPS}
                currentIndex={currentTipIndex}
                onNext={handleNextTip}
                onPrev={handlePrevTip}
                onClose={handleCloseTutorial}
                isTtsActive={isTtsActive}
                onToggleTts={() => setIsTtsActive(!isTtsActive)}
            />
        )}
      </div>
    </div>
  );
};