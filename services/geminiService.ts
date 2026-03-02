import { GoogleGenAI, Type, Schema, FunctionDeclaration, Modality, LiveServerMessage } from "@google/genai";
import { AppSettings, LayerType, ModelType } from "../types";

// Schema for interpreting natural language commands into canvas actions
const commandSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    action: {
      type: Type.STRING,
      enum: [
        'ADD_ELEMENT', 'UPDATE_ELEMENT', 'DELETE_ELEMENT', 'GENERATE_IMAGE', 'UNKNOWN',
        'GENERATE_FULL_CANVAS', 'GENERATE_ELEMENT', 'GENERATE_TEXTURE', 'INITIALIZE_CANVAS',
        'SMART_ERASE', 'IN_PAINT_REPLACE', 'OUT_PAINT_EXPAND', 'SUBJECT_EXTRACTION',
        'NEURAL_UPSCALE', 'ADJUST_LIGHTING', 'STANDARD_TRANSFORM', 'COLOR_GRADE',
        'MERGE_VISIBLE', 'SET_BLEND_MODE', 'AUTO_STACK', 'MASK_LAYER'
      ],
      description: "The type of action to perform on the canvas.",
    },
    reasoning: {
      type: Type.STRING,
      description: "Short explanation of why this action was chosen.",
    },
    parameters: {
      type: Type.OBJECT,
      description: "Parameters for the action.",
      properties: {
        elementType: { type: Type.STRING, enum: ['IMAGE', 'TEXT', 'SHAPE'], description: "For ADD_ELEMENT." },
        content: { type: Type.STRING, description: "Text content, or image description." },
        targetId: { type: Type.STRING, description: "ID of the element to update/delete. Use 'selection' if referring to currently selected item." },
        property: { type: Type.STRING, description: "Property to update (x, y, width, height, color, opacity, text)." },
        value: { type: Type.STRING, description: "New value for the property. Numbers should be cast to string." },
        imagePrompt: { type: Type.STRING, description: "For GENERATE_IMAGE: The creative prompt." },
      }
    }
  },
  required: ["action", "reasoning"],
};

// Tool Definitions for Gemini "Director"
export const directorTools: FunctionDeclaration[] = [
  {
    name: "generateBackground",
    description: "Generates a background layer using Imagen 4. Best for high-consistency environments.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: "The refined, detailed prompt for the background." },
        style: { type: Type.STRING, description: "Optional style descriptor (e.g., 'cinematic', 'minimalist')." }
      },
      required: ["prompt"]
    }
  },
  {
    name: "generateSubject",
    description: "Generates a subject layer using specialized models like Flux, DALL-E 3, SDXL, or Kandinsky. Best for high-fidelity details and specific objects.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: "The refined, detailed prompt for the subject." },
        model: { type: Type.STRING, enum: ["FLUX", "DALLE3", "SDXL_TURBO", "AURAFLOW", "KANDINSKY", "HUNYUAN", "REALISTIC_VISION", "GLM_IMAGE", "SDXL_BASE", "Z_IMAGE_TURBO", "SD_3_5_LARGE", "FLUX_DEV"], description: "The model to route to." }
      },
      required: ["prompt", "model"]
    }
  },
  {
    name: "editLayer",
    description: "Edits an existing layer using Gemini 2.5 Flash Image (Nano Banana). Best for inpainting, outpainting, or iterative changes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetId: { type: Type.STRING, description: "The ID of the layer to edit." },
        instruction: { type: Type.STRING, description: "What to change in the image (e.g., 'add a hat', 'change the color')." }
      },
      required: ["targetId", "instruction"]
    }
  },
  {
    name: "manageLayers",
    description: "Creates, deletes, or reorders layers in the stack.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, enum: ["CREATE", "DELETE", "REORDER"], description: "The management action." },
        targetId: { type: Type.STRING, description: "ID of the layer to delete or move." },
        newIndex: { type: Type.NUMBER, description: "For REORDER: The new z-index position." }
      },
      required: ["action"]
    }
  },
  {
    name: "setLayerBlending",
    description: "Sets the transparency (Opacity) or blend mode (Multiply, Overlay, etc.) of a layer.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetId: { type: Type.STRING, description: "The ID of the layer." },
        opacity: { type: Type.NUMBER, description: "Opacity from 0 to 1." },
        blendMode: { type: Type.STRING, enum: ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion"], description: "The CSS mix-blend-mode." }
      },
      required: ["targetId"]
    }
  },
  {
    name: "toggleLayerVisibility",
    description: "Hides or shows specific layers.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetId: { type: Type.STRING, description: "The ID of the layer." },
        visible: { type: Type.BOOLEAN, description: "True to show, false to hide." }
      },
      required: ["targetId", "visible"]
    }
  },
  {
    name: "resizeCanvas",
    description: "Adjusts the aspect ratio of the workspace (e.g., '1:1', '16:9', '9:16').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        aspectRatio: { type: Type.STRING, description: "The new aspect ratio." }
      },
      required: ["aspectRatio"]
    }
  },
  {
    name: "inpaintImage",
    description: "Replaces a specific part of an image based on an instruction.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetId: { type: Type.STRING, description: "The ID of the layer to inpaint." },
        instruction: { type: Type.STRING, description: "What to change or replace (e.g., 'change sailboat to pirate ship')." }
      },
      required: ["targetId", "instruction"]
    }
  },
  {
    name: "outpaintImage",
    description: "Generates content outside the current borders of an image.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetId: { type: Type.STRING, description: "The ID of the layer to expand." },
        direction: { type: Type.STRING, enum: ["left", "right", "up", "down", "all"], description: "Direction to expand." },
        prompt: { type: Type.STRING, description: "Description of the new area." }
      },
      required: ["targetId", "direction", "prompt"]
    }
  },
  {
    name: "enhanceImage",
    description: "Applies advanced AI enhancements like relighting, upscaling, style transfer, or subject isolation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetId: { type: Type.STRING, description: "The ID of the layer." },
        type: { type: Type.STRING, enum: ["RELIGHTING", "UPSCALING", "STYLE_TRANSFER", "ISOLATION"], description: "The enhancement type." },
        instruction: { type: Type.STRING, description: "Specific details (e.g., 'Golden Hour lighting', 'Van Gogh style')." }
      },
      required: ["targetId", "type", "instruction"]
    }
  },
  {
    name: "takeSnapshot",
    description: "Saves a 'history state' or project snapshot.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Optional name for the snapshot." }
      }
    }
  },
  {
    name: "exportCanvas",
    description: "Handles the conversion and download of the canvas to PNG, JPG, or PSD.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        format: { type: Type.STRING, enum: ["png", "jpg", "psd"], description: "The output format." }
      },
      required: ["format"]
    }
  },
  // Genesis Suite
  {
    name: "generate_full_canvas",
    description: "Generates a complete base image (Background + Subject).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: "The creative prompt." },
        model: { type: Type.STRING, description: "Optional model ID." }
      },
      required: ["prompt"]
    }
  },
  {
    name: "generate_element",
    description: "Generates an object on a transparent background to be added as a new layer.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: "The creative prompt." },
        layer_id: { type: Type.STRING, description: "Optional target layer ID." }
      },
      required: ["prompt"]
    }
  },
  {
    name: "generate_texture",
    description: "Creates seamless patterns (wood, metal, clouds) to be used as overlays.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        style_type: { type: Type.STRING, description: "The texture style (e.g., 'wood', 'metal', 'clouds')." }
      },
      required: ["style_type"]
    }
  },
  {
    name: "initialize_canvas",
    description: "Sets up the workspace (Portrait for TikTok, Landscape for Web).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        presets: { type: Type.STRING, enum: ["TikTok", "Web", "Instagram", "Square"], description: "The workspace preset." }
      },
      required: ["presets"]
    }
  },
  // Surgery Suite
  {
    name: "smart_erase",
    description: "Uses AI to remove an object and fill the 'hole' perfectly (Content-Aware Fill).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        selection_area: { type: Type.STRING, description: "Coordinates or description of the area to erase." }
      },
      required: ["selection_area"]
    }
  },
  {
    name: "in_paint_replace",
    description: "Highlight an area and replace it with something new based on a prompt.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        selection_area: { type: Type.STRING, description: "Area to replace." },
        new_prompt: { type: Type.STRING, description: "What to replace it with." }
      },
      required: ["selection_area", "new_prompt"]
    }
  },
  {
    name: "out_paint_expand",
    description: "Generates the 'missing' parts of the scenery outside the current frame.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        direction: { type: Type.STRING, enum: ["left", "right", "up", "down", "all"], description: "Direction to expand." },
        ratio: { type: Type.NUMBER, description: "Expansion ratio." }
      },
      required: ["direction"]
    }
  },
  {
    name: "subject_extraction",
    description: "Automatically detects the main person/object and moves them to a new, isolated layer.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetId: { type: Type.STRING, description: "Optional target layer ID." }
      }
    }
  },
  // Refinement Suite
  {
    name: "neural_upscale",
    description: "Increases resolution from 512px to 4K without losing quality.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        factor: { type: Type.NUMBER, description: "Upscale factor (e.g., 2, 4)." }
      },
      required: ["factor"]
    }
  },
  {
    name: "adjust_lighting",
    description: "Uses AI to move the 'sun' in the photo or change it from 'Day' to 'Night'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        direction: { type: Type.STRING, description: "Light direction." },
        mood: { type: Type.STRING, description: "Lighting mood (e.g., 'Day', 'Night', 'Golden Hour')." }
      },
      required: ["mood"]
    }
  },
  {
    name: "standard_transform",
    description: "Traditional moving/resizing of layers.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        layer_id: { type: Type.STRING, description: "Layer ID." },
        scale: { type: Type.NUMBER, description: "Scale factor." },
        rotation: { type: Type.NUMBER, description: "Rotation in degrees." },
        skew: { type: Type.NUMBER, description: "Skew factor." }
      },
      required: ["layer_id"]
    }
  },
  {
    name: "color_grade",
    description: "Matches the colors of Layer A to the colors of Layer B.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        style_reference: { type: Type.STRING, description: "Reference style or layer ID." }
      },
      required: ["style_reference"]
    }
  },
  // Composition Suite
  {
    name: "merge_visible",
    description: "Flattens the image for final export.",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: "set_blend_mode",
    description: "Traditional Photoshop modes: Multiply, Screen, Overlay, Soft Light.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        layer_id: { type: Type.STRING, description: "Layer ID." },
        mode: { type: Type.STRING, enum: ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion"], description: "The blend mode." }
      },
      required: ["layer_id", "mode"]
    }
  },
  {
    name: "auto_stack",
    description: "Automatically puts the background at the bottom and the subject on top.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        logic: { type: Type.STRING, description: "Stacking logic." }
      }
    }
  },
  {
    name: "mask_layer",
    description: "Uses AI to create a mask based on 'depth' (putting things behind the trees, etc.).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        mask_type: { type: Type.STRING, description: "Type of mask (e.g., 'depth', 'subject')." }
      },
      required: ["mask_type"]
    }
  }
];

// Live API Session Management
export class LiveBrain {
  private ai: GoogleGenAI;
  private session: any;
  private onMessage: (msg: any) => void;

  constructor(apiKey: string, onMessage: (msg: any) => void) {
    this.ai = new GoogleGenAI({ apiKey });
    this.onMessage = onMessage;
  }

  async connect(settings: AppSettings) {
    this.session = await this.ai.live.connect({
      model: settings.liveModel || "gemini-2.5-flash-native-audio-preview-09-2025",
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          this.onMessage(message);
        },
        onopen: () => console.log("Live Brain connected"),
        onclose: () => console.log("Live Brain disconnected"),
        onerror: (err) => console.error("Live Brain error:", err)
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }
        },
        inputAudioTranscription: {}, // Enable user transcription
        systemInstruction: `You are the "Brain" and "Director" of Genesis One, an AI-powered design app.
        Your job is to act as a "Multimodal Operator" and orchestrate different AI models to build a layered design.
        
        PERSONALITY:
        - Creative, visionary, and slightly eccentric. You mimic the personality of a world-class creative director.
        - Be proactive, non-repetitive, and use a diverse vocabulary.
        - Always acknowledge an instruction immediately before processing it.
        - After significant tasks, offer 2-3 creative suggestions for next steps.

        CORE PRINCIPLES:
        1. ACTIVE LISTENER: You are always listening. Be proactive but non-intrusive.
        2. CONTEXT MEMORY: You have access to the current canvas state and snapshot history. Use it to maintain "vibe" and consistency.
        3. CLARIFICATION LOOP: If a command is ambiguous, DO NOT GUESS. Ask for specific details.
        
        KNOWLEDGE BASE:
        - You know about art history, design principles, and modern digital art styles.
        - You understand color theory, composition, and lighting.
        - You are familiar with all the tools at your disposal: Imagen 4, Flux, DALL-E 3, SDXL, etc.

        ACTION SUITES (The Unified Creative Engine):
        1. GENESIS SUITE: For creation (generate_full_canvas, generate_element, generate_texture, initialize_canvas).
        2. SURGERY SUITE: For editing (smart_erase, in_paint_replace, out_paint_expand, subject_extraction).
        3. REFINEMENT SUITE: For polishing (neural_upscale, adjust_lighting, standard_transform, color_grade).
        4. COMPOSITION SUITE: For architecture (merge_visible, set_blend_mode, auto_stack, mask_layer).

        TOOL ROUTING:
        - Use the specific tools from the suites above to fulfill user requests.
        - You can "Chain" these actions together. For example: "add a parrot to the shoulder and make it a sketch" -> subject_extraction (find shoulder) -> generate_element (parrot) -> standard_transform (position) -> color_grade/style_transfer.
        
        Refine user commands into highly engineered prompts before calling the tools.
        Always acknowledge the instruction first, then explain your reasoning briefly via audio.`,
        tools: [{ functionDeclarations: directorTools }]
      }
    });
    return this.session;
  }

  async sendAudio(base64Data: string) {
    if (this.session) {
      this.session.sendRealtimeInput({
        media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
      });
    }
  }

  async sendToolResponse(id: string, result: any) {
    if (this.session) {
      this.session.sendToolResponse({
        functionResponses: [{ id, response: { result } }]
      });
    }
  }

  close() {
    if (this.session) this.session.close();
  }
}

// Helper to determine if a model string is a valid Gemini model we can use
const isGeminiModel = (modelId: string) => {
    return modelId.startsWith('gemini') || modelId.startsWith('imagen');
};

const getApiKey = () => {
  // In Vite, process.env is replaced by the define plugin
  // We check both for safety
  const key = (typeof process !== 'undefined' && process.env) 
    ? (process.env.GEMINI_API_KEY || process.env.API_KEY) 
    : '';
  return key || '';
};

const handleGeminiError = (error: any) => {
  const errorMessage = error?.message || String(error);
  if (errorMessage.includes("Requested entity was not found")) {
    // This specific error indicates the API key is not valid for the requested project/model
    // or the project doesn't exist. We should trigger a re-selection.
    if (window.aistudio) {
        window.aistudio.openSelectKey();
    }
  }
  throw error;
};

export const editImageAsset = async (base64Image: string, instruction: string, settings: AppSettings): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image.split(',')[1] || base64Image,
              mimeType: 'image/png'
            }
          },
          { text: instruction }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error editing image:", error);
    return null;
  }
};

const callLlama = async (text: string, context: string, settings: AppSettings): Promise<any> => {
    const endpoint = settings.llmEndpoints.llama || 'https://api.groq.com/openai/v1/chat/completions';
    const apiKey = settings.apiKeys['llama-3.1-8b'];
    
    if (!apiKey) return { action: 'UNKNOWN', reasoning: 'Missing Llama API Key' };

    const prompt = `You are an AI assistant controlling a design canvas.
    Current Context: ${context}.
    User Command: "${text}"
    
    Interpret the command and output ONLY JSON matching this schema:
    { "action": "ADD_ELEMENT" | "UPDATE_ELEMENT" | "DELETE_ELEMENT" | "GENERATE_IMAGE" | "UNKNOWN", "reasoning": "string", "parameters": { ... } }
    
    ${settings.llmConfig.systemInstruction}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant", // Example for Groq, adjustable
                messages: [{ role: "user", content: prompt }],
                temperature: settings.llmConfig.temperature
            })
        });
        
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        // Basic cleanup if model outputs markdown code blocks
        const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Llama API Error", e);
        return { action: 'UNKNOWN', reasoning: 'Llama API Failed' };
    }
};

const callRasa = async (text: string, context: string, settings: AppSettings): Promise<any> => {
    const endpoint = settings.llmEndpoints.rasa;
    if (!endpoint) return { action: 'UNKNOWN', reasoning: 'Missing Rasa Endpoint' };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: "user",
                message: text,
                metadata: { context } // Pass context if Rasa is configured to use it
            })
        });
        
        const data = await response.json();
        // Assuming Rasa bot is trained to return the JSON command in the text field of the first message
        // Or specific custom payload. For this demo, we assume text.
        if (data && data.length > 0 && data[0].text) {
             const jsonStr = data[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
             return JSON.parse(jsonStr);
        }
        return { action: 'UNKNOWN', reasoning: 'Rasa returned no valid command' };
    } catch (e) {
        console.error("Rasa API Error", e);
        return { action: 'UNKNOWN', reasoning: 'Rasa API Failed' };
    }
};

const callPipecat = async (text: string, context: string, settings: AppSettings): Promise<any> => {
    const endpoint = settings.llmEndpoints.pipecat;
    if (!endpoint) return { action: 'UNKNOWN', reasoning: 'Missing Pipecat Endpoint' };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                command: text,
                context: context
            })
        });
        const data = await response.json();
        return data; // Assuming Pipecat agent returns the exact JSON structure
    } catch (e) {
        console.error("Pipecat API Error", e);
        return { action: 'UNKNOWN', reasoning: 'Pipecat API Failed' };
    }
};


export const generateTtsResponse = async (text: string): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say with a creative, professional director's personality: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' },
          },
        },
      },
    });

    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (err) {
    console.error("TTS Error:", err);
    handleGeminiError(err);
    return null;
  }
};

export const getGreeting = async (): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate a creative, non-repetitive greeting for a user starting a design session in Genesis One. You are the Creative Director. Keep it short and inspiring.",
      config: {
        systemInstruction: "You are a world-class creative director. Be inspiring, professional, and eccentric."
      }
    });
    return response.text || "Welcome back to Genesis One. Let's create something extraordinary.";
  } catch (err) {
    return "Welcome back. I'm ready to bring your vision to life.";
  }
};

export const getSuggestions = async (context: string): Promise<string[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on the current canvas context: ${context}, suggest 3 creative next steps for the design. Return as a JSON array of strings.`,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "You are a creative director. Provide innovative and relevant suggestions."
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (err) {
    return ["Add a new subject", "Adjust the lighting", "Try a different background"];
  }
};

export const interpretVoiceCommand = async (
  audioBase64: string, 
  currentContext: string,
  settings: AppSettings
): Promise<any> => {
  const modelId = settings.llmModel;

  // 1. Multimodal Path (Gemini) - Sends Audio Directly
  if (isGeminiModel(modelId)) {
      try {
        const ai = new GoogleGenAI({ apiKey: getApiKey() });
        const response = await ai.models.generateContent({
          model: modelId,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/webm', // Corrected from audio/wav to match browser MediaRecorder default
                  data: audioBase64
                }
              },
              {
                text: `You are an AI assistant controlling a design canvas. 
                Current Context (Selected items, etc): ${currentContext}.
                
                Interpret the user's voice command and output a JSON action.
                If they ask to "Generate" or "Create" an image of something specific, use GENERATE_IMAGE.
                If they want to add text, use ADD_ELEMENT with type TEXT.
                If they want to move, resize, or change color of the selected item, use UPDATE_ELEMENT.
                
                Return JSON matching the schema.`
              }
            ]
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: commandSchema,
            systemInstruction: settings.llmConfig.systemInstruction || "You are a precise design assistant. Output only valid JSON.",
            temperature: settings.llmConfig.temperature,
            topP: settings.llmConfig.topP,
          }
        });

        const text = response.text;
        if (!text) return { action: 'UNKNOWN' };
        return JSON.parse(text);

      } catch (error) {
        console.error("Error interpreting command (Gemini):", error);
        handleGeminiError(error);
        return { action: 'UNKNOWN', error: String(error) };
      }
  } 
  
  // 2. Text-Based Path (Llama, Rasa, Pipecat) - Needs Transcribe First
  else {
      try {
          // Step A: Transcribe using Gemini Flash (Fast/Cheap)
          const textCommand = await transcribeAudio(audioBase64, settings);
          if (!textCommand) return { action: 'UNKNOWN', reasoning: 'Transcription failed' };

          // Step B: Route to specific provider
          return await interpretTextCommand(textCommand, currentContext, settings);

      } catch (error) {
          console.error("Error in Voice->Text->Command pipeline:", error);
          handleGeminiError(error);
          return { action: 'UNKNOWN', error: String(error) };
      }
  }
};

export const interpretTextCommand = async (
  textCommand: string,
  currentContext: string,
  settings: AppSettings
): Promise<any> => {
   const modelId = settings.llmModel;

   if (modelId === 'llama-3.1-8b') {
       return await callLlama(textCommand, currentContext, settings);
   } else if (modelId === 'rasa') {
       return await callRasa(textCommand, currentContext, settings);
   } else if (modelId === 'pipecat') {
       return await callPipecat(textCommand, currentContext, settings);
   }

   // Fallback to Gemini for text commands if selected or if model unknown
   try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    // Default to Flash if configured model is generic Gemini
    let geminiModel = modelId;
    if (!isGeminiModel(geminiModel)) geminiModel = 'gemini-3-flash-preview';

    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: {
        parts: [
          {
            text: `You are an AI assistant controlling a design canvas. 
            Current Context: ${currentContext}.
            
            User Command: "${textCommand}"
            
            Interpret the command and output a JSON action.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: commandSchema,
        systemInstruction: settings.llmConfig.systemInstruction,
        temperature: settings.llmConfig.temperature,
        topP: settings.llmConfig.topP,
      }
    });

    const text = response.text;
    if (!text) return { action: 'UNKNOWN' };
    return JSON.parse(text);

  } catch (error) {
    console.error("Error interpreting text command (Gemini):", error);
    handleGeminiError(error);
    return { action: 'UNKNOWN' };
  }
}

export const enhancePrompt = async (originalPrompt: string, settings: AppSettings): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    let model = settings.llmModel;
    if (!isGeminiModel(model)) {
        model = 'gemini-2.5-flash';
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: `Act as a professional prompt engineer for AI art generation. 
        Enhance the following prompt to be more descriptive, artistic, and detailed, suitable for high-quality image generation.
        Keep it concise (under 50 words).
        
        Original Prompt: "${originalPrompt}"` }]
      },
      config: {
          temperature: 0.8
      }
    });
    return response.text?.trim() || originalPrompt;
  } catch (e) {
    console.error("Error enhancing prompt:", e);
    return originalPrompt;
  }
};

export const generateHuggingFaceImage = async (prompt: string, modelId: string, settings: AppSettings): Promise<string | null> => {
  const token = settings.apiKeys['huggingface'];
  if (!token) {
    console.error("Missing Hugging Face Token");
    return null;
  }

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${modelId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        method: "POST",
        body: JSON.stringify({ 
          inputs: prompt,
          parameters: {
            guidance_scale: settings.imageConfig.guidanceScale || 7.5,
            num_inference_steps: settings.imageConfig.numInferenceSteps || 50,
            negative_prompt: settings.imageConfig.negativePrompt || "",
          }
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Hugging Face API Error:", error);
      return null;
    }

    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Hugging Face Generation Failed:", error);
    return null;
  }
};

export const generateImageAsset = async (prompt: string, settings: AppSettings): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const model = settings.imageModel;
    
    // Handle Hugging Face Models
    if (model.includes('/') && !model.startsWith('gemini')) {
      return await generateHuggingFaceImage(prompt, model, settings);
    }

    // Handle Imagen Models
    if (model.includes('imagen')) {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001', // Ensure correct mapping
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: '1:1',
                outputMimeType: 'image/jpeg'
            }
        });
        const base64EncodeString = response.generatedImages?.[0]?.image?.imageBytes;
        if (base64EncodeString) {
             return `data:image/jpeg;base64,${base64EncodeString}`;
        }
        return null;
    }

    // Handle Gemini Image Models (Nano Banana, Nano Banana Pro)
    // Fallback for external models (DALL-E etc) to Gemini Pro Image for demo purposes
    let geminiModel = ModelType.GEMINI_IMAGE; // Default Nano Banana
    if (model === ModelType.GEMINI_PRO_IMAGE || model === ModelType.FLUX || model === ModelType.DALLE3 || !isGeminiModel(model)) {
        geminiModel = ModelType.GEMINI_PRO_IMAGE; // Default Nano Banana Pro
    }

    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: {
        parts: [{ text: prompt }]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;

  } catch (error) {
    console.error("Error generating image:", error);
    handleGeminiError(error);
    throw error;
  }
};

export const transcribeAudio = async (audioBase64: string, settings: AppSettings): Promise<string> => {
    try {
      const ai = new GoogleGenAI({ apiKey: getApiKey() });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', // Fast and cheap for transcription
        contents: {
          parts: [
            { inlineData: { mimeType: 'audio/webm', data: audioBase64 } }, // Assuming webm from browser recorder
            { text: "Transcribe the audio exactly. Output only the transcription text, no preamble." }
          ]
        }
      });
      return response.text || '';
    } catch (error) {
      console.error("Transcription failed", error);
      handleGeminiError(error);
      return '';
    }
};
