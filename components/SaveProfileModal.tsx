
import React from 'react';
import { UserCheck, X, ShieldCheck, Sparkles, Fingerprint } from 'lucide-react';

interface SaveProfileModalProps {
  onSave: () => void;
  onClose: () => void;
}

const SaveProfileModal: React.FC<SaveProfileModalProps> = ({ onSave, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 relative animate-in zoom-in-95 shadow-2xl overflow-hidden border border-white/50">
        
        {/* Decorative Background Elements - Teal Theme */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-teal-50 rounded-full -mr-12 -mt-12 blur-3xl opacity-60"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-50 rounded-full -ml-10 -mb-10 blur-2xl opacity-60"></div>

        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-zinc-50 rounded-full text-zinc-400 hover:bg-zinc-100 transition-colors z-50 active:scale-95">
          <X size={20} />
        </button>

        <div className="relative z-10 text-center pt-2">
            <div className="relative w-24 h-24 mx-auto mb-6">
                 <div className="absolute inset-0 bg-teal-100/50 rounded-full animate-pulse"></div>
                 <div className="relative w-full h-full bg-gradient-to-tr from-teal-50 to-white rounded-full flex items-center justify-center shadow-lg shadow-teal-100 border border-teal-100">
                    <UserCheck size={36} className="text-teal-600" />
                 </div>
                 <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center">
                    <Fingerprint size={14} className="text-white" />
                 </div>
            </div>

            <h2 className="text-2xl font-black text-zinc-900 tracking-tight mb-3">Skin Profile</h2>
            
            <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-8">
                Save your biometric data to enable personalized AI tracking and product matching evolution.
            </p>

            <div className="space-y-3 mb-8 text-left">
                <div className="flex items-center gap-3 p-4 bg-teal-50/50 rounded-2xl border border-teal-100/50">
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                        <ShieldCheck size={14} className="text-teal-600" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-teal-900 block mb-0.5">Secure Storage</span>
                        <span className="text-[10px] text-teal-700 font-medium leading-none">Encrypted local biometric history</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-cyan-50/50 rounded-2xl border border-cyan-100/50">
                     <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center shrink-0">
                        <Sparkles size={14} className="text-cyan-600" />
                    </div>
                    <div>
                        <span className="text-xs font-bold text-cyan-900 block mb-0.5">Smart Matching</span>
                        <span className="text-[10px] text-cyan-700 font-medium leading-none">Higher precision shelf analysis</span>
                    </div>
                </div>
            </div>

            <button 
                onClick={onSave}
                className="w-full py-4 rounded-[1.5rem] bg-zinc-900 text-white font-bold text-sm uppercase tracking-widest shadow-xl shadow-zinc-900/10 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
            >
                Confirm Save
            </button>
            
            <button onClick={onClose} className="mt-4 text-xs font-bold text-zinc-400 hover:text-zinc-600">
                Maybe later
            </button>
        </div>
      </div>
    </div>
  );
};

export default SaveProfileModal;
