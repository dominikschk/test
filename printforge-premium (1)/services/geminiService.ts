
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from '../types';

// Initialize Gemini Client with API key from environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeDesign = async (imageBase64: string): Promise<AnalysisResult> => {
  // Remove data URL prefix if present for clean base64
  const cleanBase64 = imageBase64.split(',')[1] || imageBase64;

  const prompt = `
    You are a 3D printing expert optimizing a design for a 40x40mm solid keychain.
    The nozzle size is 0.4mm.
    
    TASK:
    1. Analyze the image details.
    2. Determine the maximum scale (in mm) that fits on a 40x40mm surface.
    3. GOAL: Scale UP as much as possible to fill the keychain.
       - Ideal Range: 35mm to 38mm.
       - If details are very fine, you might need to suggest a slightly larger scale to make them printable (max 39mm).
       - If the logo is low-res, suggest a size where artifacts aren't visible (min 30mm).
    
    CRITICAL CHECKS:
    1. Are the details too fine for a 0.4mm nozzle?
    2. Is the contrast sufficient for color-based extrusion?
    
    OUTPUT REQUIREMENTS:
    - Determine 'isPrintable'.
    - 'recommendedScale': A number between 30 and 39. Prioritize 36-38 for bold look.
    - Extract up to 4 distinct colors.
    - Rate complexity (1-10).
    - Provide reasoning.
    
    Return JSON.
  `;

  try {
    // Using gemini-3-pro-preview for complex spatial reasoning and 3D printing analysis
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isPrintable: { type: Type.BOOLEAN },
            confidenceScore: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
            suggestedColors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            complexityRating: { type: Type.NUMBER },
            recommendedScale: { type: Type.NUMBER, description: "Optimal size in mm (30-39)" },
          },
          required: ["isPrintable", "confidenceScore", "reasoning", "suggestedColors", "complexityRating", "recommendedScale"]
        }
      }
    });

    // Directly access the .text property from GenerateContentResponse
    const result = JSON.parse(response.text || '{}');
    
    // Calculate estimated price based on complexity
    const basePrice = 14.99;
    const complexityCost = (result.complexityRating || 1) * 1.50;
    const estimatedPrice = basePrice + complexityCost;

    return {
      isPrintable: result.isPrintable ?? false,
      confidenceScore: result.confidenceScore ?? 0,
      reasoning: result.reasoning ?? "Analysis failed.",
      suggestedColors: result.suggestedColors || ["#FFFFFF"],
      complexityRating: result.complexityRating || 5,
      estimatedPrice: Number(estimatedPrice.toFixed(2)),
      recommendedScale: result.recommendedScale || 36 // Fallback to a "good" size if AI misses it
    };

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      isPrintable: false, 
      confidenceScore: 0,
      reasoning: "AI Analysis could not complete. Please ensure your API key is valid.",
      suggestedColors: ["#CCCCCC"],
      complexityRating: 5,
      estimatedPrice: 19.99,
      recommendedScale: 35
    };
  }
};
