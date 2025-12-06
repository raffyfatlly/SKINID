import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Sparkles, Image as ImageIcon, ArrowLeft, ScanFace, BrainCircuit } from 'lucide-react';
import { analyzeSkinFrame, drawBiometricOverlay, validateFrame, enhanceSkinTexture, drawImperfectionMap } from '../services/visionService';
import { analyzeFaceSkin } from '../services/geminiService';
import { SkinMetrics } from '../types';

interface FaceScannerProps {
  onScanComplete: (metrics: SkinMetrics, image: string) => void;
}

const FaceScanner: React.FC<FaceScannerProps> = ({ onScanComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Optimization Refs
  const metricsBuffer = useRef<SkinMetrics[]>([]); 
  const lastFacePos = useRef<{ cx: number, cy: number } | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const progressRef = useRef<number>(0);
  const circleRef = useRef<SVGCircleElement>(null);
  const lastAnalysisTimeRef = useRef<number>(0);
  const cachedMetricsRef = useRef<SkinMetrics | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false); // New AI State
  const [aiProgress, setAiProgress] = useState(0); // For AI Loading Bar
  const [streamError, setStreamError] = useState<string | null>(null);
  const [instruction, setInstruction] = useState<string>("Align Face");
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    let isMounted = true;

    const startCamera = async () => {
      try {
        let stream;
        // Try to get advanced focus control
        try {
            const constraints: MediaStreamConstraints = {
                video: { 
                    facingMode: 'user', 
                    width: { ideal: 1920 }, // High Res for better texture
                    height: { ideal: 1080 },
                    // @ts-ignore - 'advanced' is standard but TS might complain
                    advanced: [{ focusMode: 'continuous' }] 
                }
            };
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            // Fallback
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' }
            });
        }

        if (!isMounted) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }

        currentStream = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(e => console.error("Video play failed", e));
          };
        }
      } catch (err) {
        console.error("Camera Error:", err);
        if (isMounted) setStreamError("Camera access denied.");
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Simulate AI Progress
  useEffect(() => {
      let interval: ReturnType<typeof setInterval>;
      if (isProcessingAI) {
          setAiProgress(0);
          interval = setInterval(() => {
              setAiProgress(prev => {
                  if (prev >= 90) return prev; // Stall at 90% until promise resolves
                  // Variable speed to feel realistic
                  const boost = prev < 30 ? 2 : prev < 70 ? 1 : 0.5;
                  return prev + boost;
              });
          }, 50);
      }
      return () => clearInterval(interval);
  }, [isProcessingAI]);

  const calculateAverageMetrics = (buffer: SkinMetrics[]): SkinMetrics => {
      if (buffer.length === 0) return { 
          overallScore: 70, 
          acneActive: 70, 
          acneScars: 70, 
          poreSize: 70, 
          blackheads: 70, 
          wrinkleFine: 70, 
          wrinkleDeep: 70, 
          sagging: 70, 
          pigmentation: 70, 
          redness: 70, 
          texture: 70, 
          hydration: 70, 
          oiliness: 70, 
          darkCircles: 70, 
          timestamp: Date.now() 
      };

      const sum = buffer.reduce((acc, curr) => ({
          overallScore: acc.overallScore + curr.overallScore,
          acneActive: acc.acneActive + curr.acneActive,
          acneScars: acc.acneScars + curr.acneScars,
          poreSize: acc.poreSize + curr.poreSize,
          blackheads: acc.blackheads + curr.blackheads,
          wrinkleFine: acc.wrinkleFine + curr.wrinkleFine,
          wrinkleDeep: acc.wrinkleDeep + curr.wrinkleDeep,
          sagging: acc.sagging + curr.sagging,
          pigmentation: acc.pigmentation + curr.pigmentation,
          redness: acc.redness + curr.redness,
          texture: acc.texture + curr.texture,
          hydration: acc.hydration + curr.hydration,
          oiliness: acc.oiliness + curr.oiliness,
          darkCircles: acc.darkCircles + curr.darkCircles,
          timestamp: 0
      }), { 
          overallScore: 0, 
          acneActive: 0, 
          acneScars: 0, 
          poreSize: 0, 
          blackheads: 0, 
          wrinkleFine: 0, 
          wrinkleDeep: 0, 
          sagging: 0, 
          pigmentation: 0, 
          redness: 0, 
          texture: 0, 
          hydration: 0, 
          oiliness: 0, 
          darkCircles: 0, 
          timestamp: 0 
      });

      const len = buffer.length;
      return {
          overallScore: Math.round(sum.overallScore / len),
          acneActive: Math.round(sum.acneActive / len),
          acneScars: Math.round(sum.acneScars / len),
          poreSize: Math.round(sum.poreSize / len),
          blackheads: Math.round(sum.blackheads / len),
          wrinkleFine: Math.round(sum.wrinkleFine / len),
          wrinkleDeep: Math.round(sum.wrinkleDeep / len),
          sagging: Math.round(sum.sagging / len),
          pigmentation: Math.round(sum.pigmentation / len),
          redness: Math.round(sum.redness / len),
          texture: Math.round(sum.texture / len),
          hydration: Math.round(sum.hydration / len),
          oiliness: Math.round(sum.oiliness / len),
          darkCircles: Math.round(sum.darkCircles / len),
          observations: buffer[buffer.length-1].observations, // Carry over observations if present
          timestamp: Date.now()
      };
  };

  const captureSnapshot = (source: HTMLVideoElement | HTMLImageElement, metrics: SkinMetrics, flip: boolean): string => {
      const captureCanvas = document.createElement('canvas');
      const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
      const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;

      captureCanvas.width = width;
      captureCanvas.height = height;
      const ctx = captureCanvas.getContext('2d');
      if (ctx) {
          if (flip) {
              ctx.translate(captureCanvas.width, 0);
              ctx.scale(-1, 1);
          }
          ctx.drawImage(source, 0, 0, captureCanvas.width, captureCanvas.height);
          if (flip) ctx.setTransform(1, 0, 0, 1, 0, 0);
          
          // 1. Apply Texture Enhancement (Sharpening/Contrast)
          const enhancedImageData = enhanceSkinTexture(ctx, width, height);
          ctx.putImageData(enhancedImageData, 0, 0);

          // 2. Draw IMPERFECTION MAP instead of Biometric Overlay
          drawImperfectionMap(ctx, captureCanvas.width, captureCanvas.height);
          
          return captureCanvas.toDataURL('image/jpeg', 0.95);
      }
      return '';
  };
  
  // Helper to get raw image for AI (Optimized for Machine Vision)
  const captureRawImage = (source: HTMLVideoElement | HTMLImageElement, flip: boolean): string => {
      const captureCanvas = document.createElement('canvas');
      const width = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
      const height = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
      captureCanvas.width = width;
      captureCanvas.height = height;
      const ctx = captureCanvas.getContext('2d');
      if (ctx) {
           if (flip) {
              ctx.translate(captureCanvas.width, 0);
              ctx.scale(-1, 1);
          }
          ctx.drawImage(source, 0, 0, width, height);

          // ENHANCE FOR AI
          const enhancedImageData = enhanceSkinTexture(ctx, width, height);
          ctx.putImageData(enhancedImageData, 0, 0);
          
          return captureCanvas.toDataURL('image/jpeg', 0.95);
      }
      return '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsProcessingAI(true); // Start AI loader immediately for upload
      
      const reader = new FileReader();
      reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
              // 1. Convert to Base64
              const canvas = document.createElement('canvas');
              const maxDim = 1920;
              let w = img.naturalWidth;
              let h = img.naturalHeight;
              if (w > maxDim || h > maxDim) {
                  const ratio = Math.min(maxDim/w, maxDim/h);
                  w *= ratio;
                  h *= ratio;
              }
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  ctx.drawImage(img, 0, 0, w, h);

                  // ENHANCE UPLOADED PHOTO TOO
                  const enhancedImageData = enhanceSkinTexture(ctx, w, h);
                  ctx.putImageData(enhancedImageData, 0, 0);

                  const rawBase64 = canvas.toDataURL('image/jpeg', 0.9);
                  
                  // 2. Analyze with Gemini
                  analyzeFaceSkin(rawBase64).then(aiMetrics => {
                      setAiProgress(100); // Complete bar
                      // 3. Create display snapshot
                      // Draw IMPERFECTION MAP for upload display as well
                      drawImperfectionMap(ctx, w, h); 
                      
                      const displaySnapshot = canvas.toDataURL('image/jpeg', 0.9);
                      setTimeout(() => { // Small delay to show 100%
                        onScanComplete(aiMetrics, displaySnapshot);
                        setIsProcessingAI(false);
                      }, 500);
                  }).catch(err => {
                      console.error(err);
                      setIsProcessingAI(false);
                      setStreamError("AI Analysis Failed.");
                  });
              }
          };
          img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
  };

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning || isProcessingAI) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Time delta calculation for smooth, constant progress
    const now = performance.now();
    const deltaTime = now - lastTimeRef.current;
    lastTimeRef.current = now;

    if (ctx && video.readyState === 4) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      
      const check = validateFrame(ctx, canvas.width, canvas.height, lastFacePos.current);
      setInstruction(prev => prev !== check.message ? check.message : prev); // Only update state if changed
      
      if (check.facePos) lastFacePos.current = check.facePos;

      // --- THROTTLED HEAVY ANALYSIS ---
      // Run deep analysis only every 150ms to keep 60fps UI
      let currentMetrics = cachedMetricsRef.current;
      if (!currentMetrics || (now - lastAnalysisTimeRef.current > 150)) {
          // Perform heavy CV
          currentMetrics = analyzeSkinFrame(ctx, canvas.width, canvas.height);
          cachedMetricsRef.current = currentMetrics;
          lastAnalysisTimeRef.current = now;
          
          if (check.isGood) {
              metricsBuffer.current.push(currentMetrics);
              if (metricsBuffer.current.length > 40) metricsBuffer.current.shift();
          }
      }
      
      // Draw the AR Overlay using cached metrics (fast)
      if (currentMetrics) {
          drawBiometricOverlay(ctx, canvas.width, canvas.height, currentMetrics);
      }

      // --- SMOOTH PROGRESS UPDATE ---
      // Always update progress if conditions are met, completely decoupled from analysis frame rate
      if (check.isGood) {
          const SCAN_DURATION = 6500; // 6.5 seconds
          const increment = (deltaTime / SCAN_DURATION) * 100;
          progressRef.current = Math.min(100, progressRef.current + increment);

          // Direct DOM manipulation for butter smooth 60fps animation
          if (circleRef.current) {
              const radius = 130;
              const circumference = 2 * Math.PI * radius;
              const offset = circumference - (progressRef.current / 100) * circumference;
              circleRef.current.style.strokeDashoffset = `${offset}`;
          }

          if (progressRef.current >= 100) {
               // STOP & PROCESS
               setIsScanning(false);
               setIsProcessingAI(true); // Trigger AI Loader
               
               const rawImage = captureRawImage(video, true);
               const avgLocalMetrics = calculateAverageMetrics(metricsBuffer.current);
               const displayImage = captureSnapshot(video, avgLocalMetrics, true);
               
               setCapturedSnapshot(displayImage);

               analyzeFaceSkin(rawImage).then(aiMetrics => {
                   setAiProgress(100);
                   setTimeout(() => {
                       onScanComplete(aiMetrics, displayImage);
                   }, 500);
               }).catch(err => {
                   console.error("AI Failed, falling back", err);
                   setAiProgress(100);
                   setTimeout(() => {
                       onScanComplete(avgLocalMetrics, displayImage);
                   }, 500);
               });
          }
      } 
      // Removed Decay logic for smoother experience
    }

    if (isScanning && !isProcessingAI) {
      requestAnimationFrame(scanFrame);
    }
  }, [isScanning, isProcessingAI, onScanComplete]);

  useEffect(() => {
    if (isScanning) {
      metricsBuffer.current = []; 
      lastFacePos.current = undefined;
      progressRef.current = 0;
      cachedMetricsRef.current = null;
      lastTimeRef.current = performance.now();
      
      // Reset circle visually
      if (circleRef.current) {
         const radius = 130;
         const circumference = 2 * Math.PI * radius;
         circleRef.current.style.strokeDashoffset = `${circumference}`;
      }

      requestAnimationFrame(scanFrame);
    }
  }, [isScanning, scanFrame]);

  const getAIStatusText = (p: number) => {
      if (p < 30) return "Uploading High-Res Map...";
      if (p < 60) return "Analyzing Pore Structure...";
      if (p < 90) return "Calculating Biological Age...";
      return "Finalizing Report...";
  };

  // Loading Screen for AI Processing
  if (isProcessingAI) {
      return (
          <div className="h-screen w-full bg-black flex flex-col items-center justify-center relative overflow-hidden font-sans">
             {/* Background blurred snapshot if available */}
             {capturedSnapshot && (
                 <img src={capturedSnapshot} className="absolute inset-0 w-full h-full object-cover opacity-30 blur-2xl scale-110" />
             )}
             
             <div className="relative z-10 flex flex-col items-center w-full max-w-[280px]">
                 <div className="w-24 h-24 relative mb-10">
                     <div className="absolute inset-0 bg-teal-500/30 rounded-full animate-ping duration-1000"></div>
                     <div className="relative z-10 w-24 h-24 bg-gradient-to-tr from-teal-500 to-cyan-600 rounded-full flex items-center justify-center shadow-2xl border border-white/20">
                        <BrainCircuit size={40} className="text-white animate-pulse" />
                     </div>
                 </div>
                 
                 <h2 className="text-3xl font-black text-white tracking-tight mb-2 text-center">Analyzing Dermis</h2>
                 <p className="text-teal-200 text-xs font-bold tracking-widest uppercase mb-8 animate-pulse text-center">{getAIStatusText(aiProgress)}</p>
                 
                 {/* Progress Bar */}
                 <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
                     <div 
                        className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-400 transition-all duration-300 ease-out"
                        style={{ width: `${aiProgress}%` }}
                     />
                 </div>
                 <div className="text-white font-black text-xl tracking-tight">{Math.round(aiProgress)}%</div>
             </div>
          </div>
      )
  }

  // Circular Progress Constants
  const radius = 130;
  const circumference = 2 * Math.PI * radius;
  // Initial state: Full offset (Hidden/Empty)
  const initialOffset = circumference;

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden font-sans">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }} 
      />
      
      {/* Canvas for AR Overlay */}
      <canvas 
        ref={canvasRef} 
        className={`absolute inset-0 w-full h-full object-contain ${!isScanning ? 'opacity-0' : 'opacity-100'}`} 
      />

      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileUpload} />

      {/* --- FOCUS MASK (Vignette) --- */}
      <div className="absolute inset-0 pointer-events-none z-10">
         <svg width="100%" height="100%" preserveAspectRatio="none">
           <defs>
             <mask id="faceMask">
               <rect width="100%" height="100%" fill="white" />
               <ellipse cx="50%" cy="45%" rx="38%" ry="28%" fill="black" />
             </mask>
           </defs>
           <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#faceMask)" />
         </svg>
      </div>
      
      {/* --- UI LAYER --- */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between">
          
          {/* Header */}
          <div className="w-full p-6 pt-12 flex justify-between items-start">
             <div className="bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 flex items-center gap-2">
                <ScanFace size={16} className="text-white" />
                <span className="text-white text-xs font-bold tracking-wider">SKIN AI</span>
             </div>
             
             {isScanning && (
                <div className="bg-white/90 backdrop-blur rounded-full px-5 py-2 shadow-lg animate-in fade-in flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-zinc-900 text-xs font-bold uppercase tracking-widest">{instruction}</span>
                </div>
             )}
          </div>

          {/* Central Guide & Progress Ring */}
          <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[76vw] h-[56vh] flex items-center justify-center pointer-events-none">
              
              {/* The Static Guide Frame */}
              {!isScanning && (
                  <div className="absolute inset-0 border border-white/30 rounded-[48%] opacity-60">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-white/60"></div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-white/60"></div>
                  </div>
              )}

              {/* Active Scanning Progress Ring */}
              {isScanning && (
                <svg className="w-[300px] h-[300px] absolute opacity-90 drop-shadow-2xl" style={{ transform: 'rotate(-90deg)' }}>
                   <circle
                      cx="150"
                      cy="150"
                      r={radius}
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="6"
                      fill="transparent"
                   />
                   <circle
                      ref={circleRef}
                      cx="150"
                      cy="150"
                      r={radius}
                      stroke="#10B981"
                      strokeWidth="6"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={initialOffset}
                      strokeLinecap="round"
                      className="shadow-[0_0_15px_#10B981]" 
                   />
                </svg>
              )}
          </div>

          {/* Footer Controls */}
          <div className="w-full pb-safe">
            <div className="pt-20 pb-10 px-6 flex flex-col items-center justify-end h-48 bg-gradient-to-t from-black via-black/40 to-transparent">
                
                {streamError ? (
                     <div className="text-rose-300 bg-rose-900/40 px-6 py-4 rounded-xl backdrop-blur-md border border-rose-500/30 mb-8 text-center">
                        <p>{streamError}</p>
                        <button onClick={() => fileInputRef.current?.click()} className="mt-3 text-white text-sm underline font-bold">Upload Photo Instead</button>
                     </div>
                ) : !isScanning ? (
                    <div className="flex items-center gap-10 animate-in slide-in-from-bottom-8 duration-700">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95 border border-white/10"
                        >
                            <ImageIcon size={20} />
                        </button>

                        <button
                            onClick={() => setIsScanning(true)}
                            className="w-20 h-20 bg-transparent rounded-full flex items-center justify-center border-4 border-white/30 hover:border-white transition-colors relative active:scale-95 group"
                        >
                            <div className="w-16 h-16 bg-white rounded-full group-hover:scale-90 transition-transform duration-300" />
                        </button>
                        
                        <div className="w-12 h-12" /> {/* Spacer */}
                    </div>
                ) : (
                    <div className="text-center">
                        <p className="text-white/80 text-xs font-medium tracking-widest uppercase animate-pulse mb-2">Analyzing Features...</p>
                        <button onClick={() => setIsScanning(false)} className="px-6 py-2 rounded-full bg-white/10 backdrop-blur text-white text-xs font-bold hover:bg-white/20">Cancel</button>
                    </div>
                )}
            </div>
          </div>
      </div>
    </div>
  );
};

export default FaceScanner;