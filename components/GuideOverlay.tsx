
import React from 'react';
import { ScanBarcode, LayoutGrid, ArrowDown, User } from 'lucide-react';

interface GuideOverlayProps {
  step: 'ANALYSIS' | 'SCAN' | 'SHELF' | null;
  onDismiss: () => void;
  onNext: () => void;
}

const GuideOverlay: React.FC<GuideOverlayProps> = ({ step, onDismiss, onNext }) => {
  if (!step) return null;

  const isAnalysis = step === 'ANALYSIS';
  const isScan = step === 'SCAN';
  // If not analysis or scan, it is SHELF

  // Positioning logic
  // Left Button (Analysis) : -88px
  // Center Button (Scan) : 0px
  // Right Button (Shelf) : 88px
  const translateX = isAnalysis ? '-88px' : isScan ? '0px' : '88px';

  const getContent = () => {
      if (isAnalysis) return {
          icon: <User size={16} />,
          title: "Skin Analysis",
          desc: "View your skin health metrics."
      };
      if (isScan) return {
          icon: <ScanBarcode size={16} />,
          title: "Scan Product",
          desc: "Check product compatibility."
      };
      return {
          icon: <LayoutGrid size={16} />,
          title: "Smart Shelf",
          desc: "Manage routine & detect conflicts."
      };
  }

  const content = getContent();

  return (
    <div 
        className="fixed inset-0 z-30 flex flex-col justify-end pb-32 pointer-events-auto" 
        onClick={onDismiss}
    >
      {/* Darken background slightly to focus attention */}
      <div className="absolute inset-0 bg-black/20 transition-opacity duration-1000 animate-in fade-in" />

      <div 
        className="relative w-full flex justify-center transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
        style={{ transform: `translateX(${translateX})` }}
      >
        <div 
            className="flex flex-col items-center max-w-[155px] text-center animate-in slide-in-from-bottom-4 fade-in duration-700 cursor-pointer active:scale-95 transition-transform"
            onClick={(e) => {
                e.stopPropagation();
                onNext();
            }}
        >
            
            {/* Text Bubble */}
            <div className="bg-white/95 backdrop-blur-xl p-3.5 rounded-2xl shadow-xl border border-white/40 mb-3 relative group hover:border-teal-200 transition-colors">
                <div className="flex items-center justify-center gap-2 mb-1.5 text-teal-600">
                    {content.icon}
                </div>
                <h4 className="text-xs font-bold text-zinc-900 leading-tight mb-1">
                    {content.title}
                </h4>
                <p className="text-[10px] text-zinc-500 font-medium leading-relaxed">
                    {content.desc}
                </p>
                <div className="mt-2 text-[8px] font-bold uppercase tracking-widest text-teal-600">Next</div>

                {/* Triangle Pointer */}
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 rotate-45 border-b border-r border-white/40 group-hover:border-teal-200"></div>
            </div>

            {/* Bouncing Arrow */}
            <ArrowDown className="text-white drop-shadow-md animate-bounce" size={20} />
            
        </div>
      </div>
    </div>
  );
};

export default GuideOverlay;
