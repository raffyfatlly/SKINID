
import React, { useState } from 'react';
import { UserProfile, UserPreferences } from '../types';
import { ChevronRight, ArrowLeft, Check, Sparkles, Target, Zap, Sun, Activity, ShoppingBag } from 'lucide-react';

interface ProfileSetupProps {
  user: UserProfile;
  onComplete: (updatedProfile: UserProfile) => void;
  onBack: () => void;
  onReset: () => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ user, onComplete, onBack, onReset }) => {
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState<UserPreferences>(user.preferences || {
    goals: [],
    sensitivity: 'MILD',
    complexity: 'MODERATE',
    sunscreenFrequency: 'SUNNY',
    lifestyle: [],
    buyingPriority: 'Fast Results'
  });

  const questions = [
    {
      id: 'goals',
      title: "Main Skin Goal",
      subtitle: "Select up to 2 priorities",
      multi: true,
      maxSelect: 2,
      options: [
        { label: "Clear Acne & Blemishes", icon: <Target size={18} /> },
        { label: "Smooth & Hydrated Skin", icon: <Sparkles size={18} /> },
        { label: "Look Younger & Firm", icon: <Activity size={18} /> },
        { label: "Brighten Dark Spots", icon: <Zap size={18} /> },
      ]
    },
    {
      id: 'sensitivity',
      title: "Sensitivity Level",
      subtitle: "How reactive is your skin?",
      multi: false,
      options: [
        { label: "Not sensitive", value: "NOT_SENSITIVE" },
        { label: "Mildly sensitive", value: "MILD" },
        { label: "Very sensitive", value: "VERY_SENSITIVE" },
      ]
    },
    {
      id: 'complexity',
      title: "Routine Complexity",
      subtitle: "How much time do you have?",
      multi: false,
      options: [
        { label: "Simple", value: "SIMPLE", desc: "Essentials only (3 steps)" },
        { label: "Moderate", value: "MODERATE", desc: "Balanced (4-5 steps)" },
        { label: "Advanced", value: "ADVANCED", desc: "Full regime (6+ steps)" },
      ]
    },
    {
      id: 'sunscreen',
      title: "Sunscreen Habits",
      subtitle: "Be honest, this stays between us.",
      multi: false,
      options: [
        { label: "Every single day", value: "DAILY", icon: <Sun size={18} /> },
        { label: "Only when sunny", value: "SUNNY" },
        { label: "Rarely or Never", value: "RARELY" },
      ]
    },
    {
      id: 'lifestyle',
      title: "Lifestyle Factors",
      subtitle: "What affects you most? (Select all that apply)",
      multi: true,
      options: [
        { label: "Lack of Sleep" },
        { label: "High Stress" },
        { label: "Poor Diet" },
        { label: "Sun Exposure" },
      ]
    },
    {
      id: 'buying',
      title: "Buying Priority",
      subtitle: "What matters most when shopping?",
      multi: false,
      options: [
        { label: "Low Price & Good Value" },
        { label: "Fast Results" },
        { label: "Gentle & Natural Ingredients" },
        { label: "Doctor Recommended" },
      ]
    }
  ];

  const handleSelect = (optionValue: string) => {
    const currentQ = questions[step];
    // @ts-ignore
    const currentVal = preferences[currentQ.id === 'sunscreen' ? 'sunscreenFrequency' : currentQ.id === 'buying' ? 'buyingPriority' : currentQ.id];

    let newVal;
    if (currentQ.multi) {
      const list = (currentVal as string[]) || [];
      if (list.includes(optionValue)) {
        newVal = list.filter(v => v !== optionValue);
      } else {
        if (currentQ.maxSelect && list.length >= currentQ.maxSelect) return;
        newVal = [...list, optionValue];
      }
    } else {
      newVal = optionValue;
    }

    setPreferences(prev => ({
      ...prev,
      [currentQ.id === 'sunscreen' ? 'sunscreenFrequency' : currentQ.id === 'buying' ? 'buyingPriority' : currentQ.id]: newVal
    }));

    // Auto advance for single select
    if (!currentQ.multi) {
      setTimeout(() => {
        if (step < questions.length - 1) setStep(step + 1);
      }, 250);
    }
  };

  const handleNext = () => {
    if (step < questions.length - 1) setStep(step + 1);
    else handleFinish();
  };

  const handleFinish = () => {
    onComplete({ ...user, preferences });
  };

  const currentQ = questions[step];
  // @ts-ignore
  const currentSelection = preferences[currentQ.id === 'sunscreen' ? 'sunscreenFrequency' : currentQ.id === 'buying' ? 'buyingPriority' : currentQ.id];

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans animate-in fade-in duration-500">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 flex items-center justify-between sticky top-0 bg-white z-10">
        <button onClick={step === 0 ? onBack : () => setStep(step - 1)} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-900 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div className="flex gap-1">
           {questions.map((_, i) => (
             <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-teal-600' : i < step ? 'w-4 bg-teal-200' : 'w-2 bg-zinc-100'}`} />
           ))}
        </div>
      </div>

      <div className="flex-1 px-6 pb-24 flex flex-col max-w-lg mx-auto w-full pt-4">
          <div className="mb-10 animate-in fade-in slide-in-from-right-4 duration-500" key={`title-${step}`}>
              <h2 className="text-3xl font-black text-zinc-900 tracking-tight mb-2">{currentQ.title}</h2>
              <p className="text-zinc-500 font-medium">{currentQ.subtitle}</p>
          </div>

          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-8 duration-500 delay-100" key={`list-${step}`}>
             {currentQ.options.map((opt) => {
               const val = (opt as any).value || opt.label;
               const isSelected = currentQ.multi 
                  ? (currentSelection as string[]).includes(val)
                  : currentSelection === val;

               return (
                 <button
                    key={val}
                    onClick={() => handleSelect(val)}
                    className={`w-full p-5 rounded-[1.5rem] border-2 text-left transition-all duration-200 flex items-center justify-between group active:scale-[0.98] ${
                      isSelected 
                        ? 'bg-teal-50 border-teal-500 shadow-md shadow-teal-100' 
                        : 'bg-white border-zinc-100 hover:border-teal-200 hover:bg-zinc-50'
                    }`}
                 >
                    <div className="flex items-center gap-4">
                        {(opt as any).icon && (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-teal-500 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                                {(opt as any).icon}
                            </div>
                        )}
                        <div>
                            <span className={`block font-bold text-base ${isSelected ? 'text-teal-900' : 'text-zinc-700'}`}>{opt.label}</span>
                            {(opt as any).desc && <span className="text-xs text-zinc-400 font-medium">{ (opt as any).desc }</span>}
                        </div>
                    </div>
                    
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'bg-teal-500 border-teal-500' : 'border-zinc-200'
                    }`}>
                        {isSelected && <Check size={14} className="text-white" />}
                    </div>
                 </button>
               )
             })}
          </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white to-transparent">
         <button
            onClick={step === questions.length - 1 ? handleFinish : handleNext}
            disabled={currentQ.multi && (currentSelection as string[]).length === 0}
            className="w-full h-16 bg-zinc-900 text-white rounded-[1.5rem] font-bold text-lg flex items-center justify-between px-6 shadow-xl shadow-zinc-900/10 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100"
         >
             <span>{step === questions.length - 1 ? "Complete Profile" : "Continue"}</span>
             <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                 <ChevronRight size={20} />
             </div>
         </button>
         
         <div className="mt-8 text-center pb-8">
             <button onClick={onReset} className="text-xs font-bold text-rose-400 uppercase tracking-widest hover:text-rose-600 transition-colors">
                 Reset App Data
             </button>
         </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
