
export interface TutorialTip {
  id: string;
  title: string;
  content: string;
  targetSelector?: string;
}

export enum ElementType {
  IMAGE = 'IMAGE',
  TEXT = 'TEXT',
  SHAPE = 'SHAPE',
  ART_GEN = 'ART_GEN',
  GROUP = 'GROUP',
  EMPTY = 'EMPTY'
}

export enum LayerType {
  BACKGROUND = 'BACKGROUND',
  SUBJECT = 'SUBJECT',
  EDIT = 'EDIT'
}

export enum ModelType {
  IMAGEN = 'imagen-4.0-generate-001',
  FLUX = 'flux-pro', // Placeholder for routing
  DALLE3 = 'dalle-3', // Placeholder for routing
  GEMINI_IMAGE = 'gemini-2.5-flash-image',
  GEMINI_PRO_IMAGE = 'gemini-3-pro-image-preview',
  SDXL_TURBO = 'stabilityai/sdxl-turbo',
  AURAFLOW = 'AuraFlow/AuraFlow-v0.1',
  KANDINSKY = 'kandinsky-community/kandinsky-2-2-decoder',
  HUNYUAN = 'tencent/HunyuanImage-3.0',
  REALISTIC_VISION = 'SG161222/Realistic_Vision_V5.1',
  GLM_IMAGE = 'ZhipuAI/GLM-Image',
  SDXL_BASE = 'stabilityai/stable-diffusion-xl-base-1.0',
  Z_IMAGE_TURBO = 'Tongyi-MAI/Z-Image-Turbo',
  SD_3_5_LARGE = 'stabilityai/stable-diffusion-3.5-large',
  FLUX_DEV = 'black-forest-labs/FLUX.2-dev'
}

export type Theme = 'dark' | 'light';

export const CANVAS_SIZE = { width: 800, height: 800 };

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  content: string; // URL for image, text content for text, color/shape type for shape
  
  // New Properties
  visible: boolean;
  locked: boolean;
  parentId: string | null; // For grouping
  expanded?: boolean; // For group UI state

  modelId?: string; // Specific AI model assigned to this layer
  layerType?: LayerType;
  shapeType?: 'rectangle' | 'circle'; // Specific for SHAPE layers
  genConfig?: { // Specific for ART_GEN layers
    prompt?: string;
    negativePrompt?: string;
    guidanceScale?: number;
    seed?: number;
  };
  style?: {
    backgroundColor?: string;
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string; // 'normal' | 'bold'
    fontStyle?: string; // 'normal' | 'italic'
    borderRadius?: number;
    borderColor?: string;
    borderWidth?: number;
    borderStyle?: string;
    mixBlendMode?: string; // Blend mode
  };
}

export interface CanvasState {
  elements: CanvasElement[];
  selectedIds: string[]; // Changed from single ID to array for multi-select
  zoom: number;
  pan: { x: number; y: number };
  history: CanvasElement[][]; 
  historyIndex: number;
  aspectRatio: string;
  canvasSize: { width: number; height: number };
  snapshots: { id: string; name: string; elements: CanvasElement[]; timestamp: number }[];
}

export enum ToolType {
  SELECT = 'SELECT',
  HAND = 'HAND',
  TEXT = 'TEXT',
  RECTANGLE = 'RECTANGLE',
  IMAGE = 'IMAGE',
  ART_GEN = 'ART_GEN'
}

// AI Action Types returned by Gemini
export interface AIAction {
  action: 'ADD_ELEMENT' | 'UPDATE_ELEMENT' | 'DELETE_ELEMENT' | 'GENERATE_IMAGE' | 'UNKNOWN';
  reasoning: string;
  parameters: any;
}

export interface GenerateImageParams {
  prompt: string;
  style?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
}

export interface AppSettings {
  imageModel: string;
  llmModel: string;
  liveModel: string;
  llmConfig: {
    temperature: number;
    topK: number;
    topP: number;
    maxOutputTokens: number;
    systemInstruction: string;
  };
  llmEndpoints: {
    llama: string;
    rasa: string;
    pipecat: string;
  };
  imageConfig: {
    aspectRatio: string;
    numberOfImages: number;
    outputMimeType: string;
    guidanceScale?: number;
    numInferenceSteps?: number;
    negativePrompt?: string;
  };
  promptTemplates: PromptTemplate[];
  apiKeys: Record<string, string>;
  manualOverride: boolean;
  
  // Advanced Settings
  theme: 'light' | 'dark' | 'windows98' | 'windowsxp' | 'material';
  layout: 'floating' | 'stack';
  panelsTransparency: number;
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    reduceMotion: boolean;
    screenReaderOptimized: boolean;
  };
  performance: {
    hardwareAcceleration: boolean;
    lowQualityPreview: boolean;
    maxHistoryStates: number;
    autoSaveInterval: number;
  };
  integrations: {
    huggingFace: boolean;
    googleDrive: boolean;
    slack: boolean;
    unsplash: boolean;
    instagram: boolean;
    figma: boolean;
    adobeCreativeCloud: boolean;
    notion: boolean;
    pinterest: boolean;
    dropbox: boolean;
  };
}

export const AVAILABLE_IMAGE_MODELS = [
  { id: ModelType.GEMINI_PRO_IMAGE, name: 'Nano Banana Pro (Default)' }, 
  { id: ModelType.GEMINI_IMAGE, name: 'Nano Banana' }, 
  { id: ModelType.IMAGEN, name: 'Imagen 4' },
  { id: ModelType.FLUX, name: 'Flux Pro' },
  { id: ModelType.DALLE3, name: 'DALL-E 3' },
  { id: ModelType.SDXL_TURBO, name: 'SDXL Turbo' },
  { id: ModelType.AURAFLOW, name: 'AuraFlow v0.1' },
  { id: ModelType.KANDINSKY, name: 'Kandinsky 2.2' },
  { id: ModelType.HUNYUAN, name: 'Hunyuan Image 3.0' },
  { id: ModelType.REALISTIC_VISION, name: 'Realistic Vision V5.1' },
  { id: ModelType.GLM_IMAGE, name: 'GLM Image' },
  { id: ModelType.SDXL_BASE, name: 'SDXL Base 1.0' },
  { id: ModelType.Z_IMAGE_TURBO, name: 'Z-Image Turbo' },
  { id: ModelType.SD_3_5_LARGE, name: 'SD 3.5 Large' },
  { id: ModelType.FLUX_DEV, name: 'Flux.2 Dev' },
];

export const AVAILABLE_LLM_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Default)' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B (via API)' },
  { id: 'pipecat', name: 'Pipecat Agent' },
  { id: 'rasa', name: 'Rasa NLP' },
];

export const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 
  'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'
];
