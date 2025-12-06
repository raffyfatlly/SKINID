import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, AlertOctagon, ScanLine, Image as ImageIcon, Upload } from 'lucide-react';
import { analyzeProductImage } from '../services/geminiService';
import { Product, UserProfile } from '../types';

interface ProductScannerProps {
  userProfile: UserProfile;
  onProductFound: (product: Product) => void;
  onCancel: () => void;
}

const ProductScanner: React.FC<ProductScannerProps> = ({ userProfile, onProductFound, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useCamera, setUseCamera] = useState(true);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      if (!useCamera) return;

      try {
        let stream;
        try {
             stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment', 
                    width: { ideal: 1920 }, 
                    height: { ideal: 1080 } 
                }
             });
        } catch(e) {
             stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
             });
        }

        if (!isMounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }
        
        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
             videoRef.current?.play().catch(e => console.error("Play error", e));
          };
        }
      } catch (err) {
        console.error("Camera Error", err);
        if (isMounted) setError("Camera access denied. You can upload a photo instead.");
      }
    };
    
    startCamera();

    return () => {
        isMounted = false;
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
    }
  }, [useCamera]);

  const processImageForAnalysis = async (base64: string) => {
      setCapturedImage(base64);
      setIsProcessing(true);
      setError(null);
      
      // Pause camera stream if active to save resources
      if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(t => t.stop());
      }

      try {
        const product = await analyzeProductImage(base64, userProfile.biometrics);
        onProductFound(product);
      } catch (err) {
        console.error(err);
        setError("Analysis Failed. Please ensure the ingredient list is clear and try again.");
        setIsProcessing(false);
        setCapturedImage(null);
        // Restart camera if needed
        setUseCamera(true); 
      }
  };

  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    processImageForAnalysis(base64);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onloadend = () => {
          const base64 = reader.result as string;
          setUseCamera(false); // Stop camera
          processImageForAnalysis(base64);
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="relative flex-1 bg-gray-900 overflow-hidden flex flex-col">
        {capturedImage ? (
           <img src={capturedImage} alt="Captured" className="w-full h-full object-contain opacity-50 animate-in fade-in" />
        ) : useCamera ? (
           <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        ) : (
           <div className="w-full h-full flex items-center justify-center text-zinc-500">
               <ImageIcon size={64} opacity={0.2} />
           </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
        <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileUpload}
        />
        
        {/* Guides */}
        {!capturedImage && useCamera && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-emerald-400 rounded-xl relative overflow-hidden bg-emerald-400/5 shadow-[0_0_100px_rgba(16,185,129,0.1)]">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 -mt-0.5 -ml-0.5 rounded-tl-lg"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 -mt-0.5 -mr-0.5 rounded-tr-lg"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 -mb-0.5 -ml-0.5 rounded-bl-lg"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 -mb-0.5 -mr-0.5 rounded-br-lg"></div>
                    {isProcessing && <div className="scan-line" />}
                </div>
            </div>
        )}
        
        {/* Loading State */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-20 animate-in fade-in">
            <div className="text-center p-6">
               <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
               <h3 className="text-2xl font-bold text-white mb-2">Analyzing Product...</h3>
               <p className="text-emerald-400 text-sm font-medium tracking-wide">Reading ingredients & calculating safety...</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-zinc-900/90 backdrop-blur-xl p-8 pb-10 border-t border-white/10 flex flex-col items-center gap-6">
        {error && (
            <div className="text-rose-300 text-sm flex items-center gap-2 bg-rose-500/10 px-4 py-3 rounded-xl border border-rose-500/20 w-full justify-center">
                <AlertOctagon size={16} /> {error}
            </div>
        )}
        
        <div className="flex w-full items-center justify-between max-w-md px-4">
            <button 
                onClick={onCancel}
                className="p-4 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition active:scale-95"
                disabled={isProcessing}
            >
                <X size={24} />
            </button>
            
            <button 
                onClick={captureFromCamera}
                disabled={isProcessing || !useCamera}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center relative group active:scale-95 transition disabled:opacity-50 disabled:scale-100"
            >
                <div className="w-16 h-16 bg-white rounded-full shadow-[0_0_20px_white]"></div>
            </button>

            <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isProcessing}
                className="p-4 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition active:scale-95"
            >
                <ImageIcon size={24} />
            </button>
        </div>
        <p className="text-zinc-500 text-xs font-medium tracking-wide">Scan label or upload photo</p>
      </div>
    </div>
  );
};

export default ProductScanner;