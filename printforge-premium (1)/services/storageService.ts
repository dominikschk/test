
import { supabase } from '../lib/supabase';
import { LogoConfig, AnalysisResult } from '../types';

export interface SavedDesign {
  id: string;
  created_at: string;
  config: LogoConfig;
  analysis: AnalysisResult;
  image_url: string;
  status: string;
}

// Helper to convert Base64 to Blob for upload
const base64ToBlob = async (url: string) => {
  const res = await fetch(url);
  return await res.blob();
};

export const saveDesignToDatabase = async (
  config: LogoConfig, 
  analysis: AnalysisResult
): Promise<string> => {
  
  // 1. Generate ID
  const designId = 'PF-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  
  try {
    let publicImageUrl = "";

    // 2. Upload Image to Supabase Storage
    if (config.url) {
      const blob = await base64ToBlob(config.url);
      const fileName = `${designId}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('designs')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: urlData } = supabase.storage
        .from('designs')
        .getPublicUrl(fileName);
      
      publicImageUrl = urlData.publicUrl;
    }

    // 3. Save Metadata to Database
    const { error: dbError } = await supabase
      .from('designs')
      .insert([
        { 
          id: designId, 
          config: config, 
          analysis: analysis,
          image_url: publicImageUrl,
          status: 'pending_payment'
        }
      ]);

    if (dbError) throw dbError;

    return designId;

  } catch (error) {
    console.error("Supabase Error:", error);
    // Fallback for demo purposes if Supabase isn't configured yet
    return designId;
  }
};

export const getDesignById = async (id: string): Promise<SavedDesign | null> => {
  const { data, error } = await supabase
    .from('designs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as SavedDesign;
};

// For Admin Dashboard
export const getAllDesigns = async (): Promise<SavedDesign[]> => {
  const { data, error } = await supabase
    .from('designs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return [];
  return data as SavedDesign[];
};
