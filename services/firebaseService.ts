import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, limit, setDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export interface AIPrompt {
  id?: string;
  prompt: string;
  model: string;
  category: string;
  tags: string[];
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  type: 'image' | 'llm';
  isNew?: boolean;
}

// Fetch dynamic models
export const fetchDynamicModels = async (): Promise<AIModel[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, "models"));
    const models: AIModel[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      models.push({ ...data, id: data.id || doc.id } as AIModel);
    });
    return models;
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
};

// Fetch prompts
export const fetchPrompts = async (count: number = 20): Promise<AIPrompt[]> => {
  try {
    const q = query(collection(db, "prompts"), limit(count));
    const querySnapshot = await getDocs(q);
    const prompts: AIPrompt[] = [];
    querySnapshot.forEach((doc) => {
      prompts.push({ id: doc.id, ...doc.data() } as AIPrompt);
    });
    return prompts;
  } catch (error) {
    console.error("Error fetching prompts:", error);
    return [];
  }
};

// Seeding function (to be called once)
export const seedDatabase = async () => {
  const promptsCollection = collection(db, "prompts");
  const modelsCollection = collection(db, "models");

  // Check if already seeded
  const snapshot = await getDocs(query(promptsCollection, limit(1)));
  if (!snapshot.empty) {
    console.log("Database already seeded.");
    return;
  }

  console.log("Seeding database...");

  // Seed Models
  const sanitizeId = (id: string) => id.replace(/\//g, '-');
  const initialModels: AIModel[] = [
    { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro', provider: 'Google', type: 'image' },
    { id: 'gemini-2.5-flash-image', name: 'Nano Banana', provider: 'Google', type: 'image' },
    { id: 'imagen-4.0-generate-001', name: 'Imagen 4', provider: 'Google', type: 'image' },
    { id: 'flux-pro', name: 'Flux Pro', provider: 'Black Forest Labs', type: 'image' },
    { id: 'dalle-3', name: 'DALL-E 3', provider: 'OpenAI', type: 'image' },
    { id: 'stabilityai/sdxl-turbo', name: 'SDXL Turbo', provider: 'Stability AI', type: 'image' },
  ];

  for (const model of initialModels) {
    await setDoc(doc(modelsCollection, sanitizeId(model.id)), model);
  }

  // Seed 200 Prompts (Simplified for brevity in code, but conceptually 200)
  // I will generate a few categories and repeat them with variations to reach 200
  const categories = ['Cyberpunk', 'Nature', 'Abstract', 'Portrait', 'Architecture', 'Surrealism'];
  const styles = ['Cinematic', 'Oil Painting', 'Digital Art', '3D Render', 'Sketch', 'Vibrant'];
  
  const prompts: Partial<AIPrompt>[] = [];
  for (let i = 0; i < 200; i++) {
    const cat = categories[i % categories.length];
    const style = styles[i % styles.length];
    prompts.push({
      prompt: `${cat} scene in ${style} style, highly detailed, 8k resolution, masterpiece #${i+1}`,
      model: initialModels[i % initialModels.length].id,
      category: cat,
      tags: [cat.toLowerCase(), style.toLowerCase(), 'ai-art']
    });
  }

  // Batch add (Firestore doesn't have a simple bulk add in client SDK without loops or writeBatch)
  // For simplicity in this environment, we'll use a loop but in production use writeBatch
  for (const p of prompts) {
    await addDoc(promptsCollection, p);
  }

  console.log("Seeding complete.");
};
