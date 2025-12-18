export interface LogoConfig {
  url: string | null;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  // emboss removed as it is now standard
}

export interface AnalysisResult {
  isPrintable: boolean;
  confidenceScore: number; // 0-100
  reasoning: string;
  suggestedColors: string[]; // Hex codes
  complexityRating: number; // 1-10
  estimatedPrice: number;
  recommendedScale: number; // New field for AI-driven auto-scaling
}

export interface PrintSettings {
  material: 'PLA' | 'PETG' | 'TPU';
  quality: 'draft' | 'standard' | 'fine';
}