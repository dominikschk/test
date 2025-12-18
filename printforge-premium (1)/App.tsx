
import React, { useState, useRef, useEffect } from 'react';
import { Viewer3D, Viewer3DHandle } from './components/Keychain3D';
import { analyzeDesign } from './services/geminiService';
import { processLogo } from './utils/imageProcessor';
import { saveDesignToDatabase, getAllDesigns, SavedDesign } from './services/storageService';
import { LogoConfig, AnalysisResult } from './types';
import { 
  Upload, 
  Move, 
  Maximize, 
  RotateCw, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck, 
  Layers,
  Sparkles,
  Loader2,
  Palette,
  XCircle,
  Package,
  ShoppingCart,
  Database,
  ExternalLink,
  Download,
  Lock
} from 'lucide-react';

// KONFIGURATION FÜR NETLIFY & SHOPIFY
// Diese Werte werden bevorzugt aus den Netlify Environment Variables geladen.
const SHOPIFY_DOMAIN = process.env.REACT_APP_SHOPIFY_DOMAIN || process.env.SHOPIFY_DOMAIN || "your-shop.myshopify.com"; 
const PRODUCT_VARIANT_ID = process.env.REACT_APP_PRODUCT_VARIANT_ID || process.env.PRODUCT_VARIANT_ID || "123456789"; 

const App: React.FC = () => {
  // Admin-Modus checken (?admin=true in der URL)
  const queryParams = new URLSearchParams(window.location.search);
  const isAdmin = queryParams.get('admin') === 'true';

  // States
  const [logoConfig, setLogoConfig] = useState<LogoConfig>({
    url: null,
    x: 0,
    y: 0,
    scale: 30, 
    rotation: 0,
  });
  
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [redirectStatus, setRedirectStatus] = useState<'idle' | 'saving' | 'redirecting'>('idle');
  
  const [adminDesigns, setAdminDesigns] = useState<SavedDesign[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  const viewerRef = useRef<Viewer3DHandle>(null);

  useEffect(() => {
    if (isAdmin) {
      setLoadingAdmin(true);
      getAllDesigns().then(data => {
        setAdminDesigns(data);
        setLoadingAdmin(false);
      });
    }
  }, [isAdmin]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFileError("Datei zu groß. Maximal 5MB.");
      return;
    }

    setFileError(null);
    setActiveStep(2); 
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawResult = event.target?.result as string;
      
      try {
        setProcessingStatus("Hintergrund wird entfernt...");
        const processedImage = await processLogo(rawResult);
        
        setLogoConfig({ 
            url: processedImage,
            x: 0,
            y: 0,
            scale: 30, 
            rotation: 0
        });

        setProcessingStatus("KI prüft Druckbarkeit...");
        const aiResult = await analyzeDesign(processedImage);
        setAnalysis(aiResult);
        
        if (aiResult.isPrintable) {
          setLogoConfig(prev => ({
            ...prev,
            scale: aiResult.recommendedScale || 36 
          }));
          setActiveStep(3); 
        }
        
      } catch (err) {
        console.error(err);
        setFileError("Systemfehler bei der Analyse.");
        setActiveStep(1);
      } finally {
        setProcessingStatus("");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleShopifyCheckout = async () => {
      if (!analysis || !logoConfig) return;
      
      setRedirectStatus('saving');

      try {
          // 1. In Supabase speichern
          const designId = await saveDesignToDatabase(logoConfig, analysis);

          setRedirectStatus('redirecting');
          
          // 2. Zu Shopify weiterleiten (Warenkorb-Permalink)
          const baseUrl = `https://${SHOPIFY_DOMAIN}/cart/${PRODUCT_VARIANT_ID}:1`;
          const params = new URLSearchParams();
          
          params.append('attributes[Design ID]', designId);
          params.append('attributes[Farben]', analysis.suggestedColors.length.toString());
          params.append('attributes[Groesse]', `${logoConfig.scale}mm`);
          
          window.location.href = `${baseUrl}?${params.toString()}`;
      } catch (err) {
          console.error("Checkout Error:", err);
          alert("Fehler beim Speichern des Designs. Bitte versuche es erneut.");
          setRedirectStatus('idle');
      }
  };

  // --- ADMIN VIEW ---
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between mb-8">
            <h1 className="text-2xl font-bold flex items-center gap-2"><Lock /> Bestell-Übersicht</h1>
            <a href="/" className="text-blue-600">Zurück zum Shop</a>
          </div>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            {loadingAdmin ? <div className="p-10 text-center text-slate-400">Lädt Daten...</div> : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-4">ID</th>
                    <th className="p-4">Vorschau</th>
                    <th className="p-4">Details</th>
                    <th className="p-4">Download</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {adminDesigns.map(d => (
                    <tr key={d.id}>
                      <td className="p-4 font-mono font-bold">{d.id}</td>
                      <td className="p-4"><img src={d.image_url} className="w-10 h-10 object-contain border" /></td>
                      <td className="p-4">Scale: {d.config.scale}mm | Colors: {d.analysis.suggestedColors.length}</td>
                      <td className="p-4">
                        <a href={d.image_url} target="_blank" className="text-blue-600 flex items-center gap-1"><Download size={14}/> PNG</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- KUNDEN VIEW ---
  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white"><Layers /></div>
            <h1 className="font-display font-bold text-xl">PrintForge <span className="text-blue-600">Studio</span></h1>
          </div>
          <div className="hidden md:flex gap-4 text-xs font-bold uppercase tracking-widest text-slate-400">
             <span className={activeStep >= 1 ? 'text-slate-900' : ''}>1. Design</span>
             <span>/</span>
             <span className={activeStep >= 3 ? 'text-slate-900' : ''}>2. Anpassung</span>
             <span>/</span>
             <span className={activeStep === 4 ? 'text-slate-900' : ''}>3. Bestellung</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* 3D Viewer Links */}
        <div className="lg:col-span-7">
          {logoConfig.url ? (
            <Viewer3D ref={viewerRef} logoConfig={logoConfig} detectedColors={analysis?.suggestedColors} />
          ) : (
            <div className="w-full h-[400px] rounded-2xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400">
              Vorschau erscheint nach Upload
            </div>
          )}
        </div>

        {/* Steuerung Rechts */}
        <div className="lg:col-span-5 space-y-6">
          {activeStep <= 2 && (
            <div className="bg-white p-6 rounded-2xl shadow-card border">
              <h2 className="text-lg font-bold mb-4">Design hochladen</h2>
              {activeStep === 1 ? (
                <div className="relative h-40 border-2 border-dashed rounded-xl flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50 transition-colors">
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <Upload className="text-slate-400 mb-2" />
                  <span className="text-sm font-semibold">Logo oder Bild wählen</span>
                </div>
              ) : (
                <div className="text-center py-10">
                  <Loader2 className="animate-spin mx-auto text-blue-600 mb-2" />
                  <p className="text-sm text-slate-500">{processingStatus}</p>
                </div>
              )}
              {fileError && <p className="text-red-500 text-xs mt-2">{fileError}</p>}
            </div>
          )}

          {activeStep >= 3 && analysis && (
            <div className="bg-white p-6 rounded-2xl shadow-card border space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg">Konfiguration</h2>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">✓ Druckbereit</span>
              </div>

              {activeStep === 3 ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Größe ({logoConfig.scale}mm)</label>
                    <input type="range" min="10" max="39" value={logoConfig.scale} onChange={e => setLogoConfig({...logoConfig, scale: parseInt(e.target.value)})} className="w-full accent-blue-600" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Rotation</label>
                    <input type="range" min="0" max={Math.PI * 2} step="0.1" value={logoConfig.rotation} onChange={e => setLogoConfig({...logoConfig, rotation: parseFloat(e.target.value)})} className="w-full accent-blue-600" />
                  </div>
                  <button onClick={() => setActiveStep(4)} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                    Weiter zum Checkout <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-4 bg-slate-50 rounded-xl border">
                    <div className="flex justify-between text-sm mb-2"><span>Basis-Preis</span><span>14,99 €</span></div>
                    <div className="flex justify-between text-sm font-bold pt-2 border-t"><span>Gesamt</span><span>{analysis.estimatedPrice.toFixed(2)} €</span></div>
                  </div>
                  <button onClick={handleShopifyCheckout} disabled={redirectStatus !== 'idle'} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                    {redirectStatus === 'idle' ? 'Jetzt auf Shopify kaufen' : 'Design wird gespeichert...'}
                  </button>
                  <button onClick={() => setActiveStep(3)} className="w-full text-xs text-slate-400 underline">Zurück zur Anpassung</button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
