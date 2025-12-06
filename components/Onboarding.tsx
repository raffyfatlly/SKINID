import React, { useState } from 'react';
import { SkinType } from '../types';
import { ChevronRight, Sparkles, User, Calendar, ArrowRight, HelpCircle } from 'lucide-react';

interface OnboardingProps {
  onComplete: (data: { name: string; age: number; skinType: SkinType }) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');

  const handleNext = () => {
    if (step === 0 && name) setStep(1);
    else if (step === 1 && age) setStep(2);
  };

  const handleFinalSelection = (selectedType: SkinType) => {
    onComplete({ name, age: parseInt(age), skinType: selectedType });
  };

  const skinTypes = [
    { type: SkinType.OILY, label: 'Oily', desc: 'Shiny t-zone' },
    { type: SkinType.DRY, label: 'Dry', desc: 'Tight, flaky' },
    { type: SkinType.COMBINATION, label: 'Combination', desc: 'Oily T-zone' },
    { type: SkinType.SENSITIVE, label: 'Sensitive', desc: 'Redness' },
    { type: SkinType.NORMAL, label: 'Normal', desc: 'Balanced' },
  ];

  return (
    <div className="h-screen w-full relative bg-white overflow-hidden flex flex-col font-sans p-8">
      
      <div className="w-full flex justify-between items-center mb-12 pt-4">
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? 'w-8 bg-teal-600' : 'w-2 bg-zinc-100'}`} />
            ))}
          </div>
          <div className="text-zinc-300 text-[10px] font-bold tracking-widest uppercase">
            Step {step + 1}/3
          </div>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">
            {step === 0 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-50 rounded-full mb-8 border border-teal-100">
                            <Sparkles size={12} className="text-teal-600" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-teal-600">AI Dermatologist</span>
                        </div>
                        <h1 className="text-6xl font-black text-zinc-900 tracking-tighter mb-4 leading-tight">Hello, <br/><span className="text-zinc-300">Beautiful.</span></h1>
                        <p className="text-lg text-zinc-500 font-medium leading-relaxed">Let's create your digital skin profile.</p>
                    </div>
                    <div className="space-y-4 pt-4">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Your Name</label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Type here..."
                            className="w-full bg-transparent border-b-2 border-zinc-100 px-0 py-4 text-4xl font-bold text-zinc-900 placeholder:text-zinc-200 focus:outline-none focus:border-teal-600 transition-all rounded-none"
                            autoFocus
                        />
                    </div>
                </div>
            )}

            {step === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
                    <div>
                         <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-50 rounded-full mb-8 border border-teal-100">
                            <Calendar size={12} className="text-teal-600" />
                            <span className="text-[10px] font-bold tracking-widest uppercase text-teal-600">Bio-Age</span>
                        </div>
                        <h1 className="text-6xl font-black text-zinc-900 tracking-tighter mb-4 leading-tight">Age is just <br/><span className="text-zinc-300">data.</span></h1>
                        <p className="text-lg text-zinc-500 font-medium leading-relaxed">This helps us track collagen needs.</p>
                    </div>
                    <div className="space-y-4 pt-4">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest ml-1">Your Age</label>
                        <input 
                            type="number" 
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            placeholder="e.g. 25"
                            className="w-full bg-transparent border-b-2 border-zinc-100 px-0 py-4 text-4xl font-bold text-zinc-900 placeholder:text-zinc-200 focus:outline-none focus:border-teal-600 transition-all rounded-none"
                            autoFocus
                        />
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
                    <div className="shrink-0 mb-8">
                        <h1 className="text-4xl font-black text-zinc-900 tracking-tighter mb-3">Skin Type</h1>
                        <p className="text-zinc-500 font-medium">Select the one that matches best.</p>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto no-scrollbar pb-4 space-y-3">
                        {skinTypes.map((s) => (
                            <button
                                key={s.type}
                                onClick={() => handleFinalSelection(s.type)}
                                className="w-full p-6 rounded-[1.5rem] bg-white border border-zinc-100 shadow-sm text-left transition-all duration-200 group hover:border-teal-600 hover:shadow-lg active:scale-[0.99] flex items-center justify-between"
                            >
                                <div>
                                    <span className="block font-bold text-lg text-zinc-900">{s.label}</span>
                                    <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">{s.desc}</span>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                                    <ChevronRight size={18} />
                                </div>
                            </button>
                        ))}
                        
                        <button
                            onClick={() => handleFinalSelection(SkinType.UNKNOWN)}
                            className="w-full p-6 rounded-[1.5rem] border-2 border-dashed border-zinc-200 text-center transition-all duration-200 flex items-center justify-center gap-2 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-400 hover:text-zinc-600 mt-2"
                        >
                            <HelpCircle size={18} />
                            <span className="font-bold text-sm">I'm not sure, let AI decide</span>
                        </button>
                    </div>
                </div>
            )}
      </div>

      {step < 2 && (
          <button
            onClick={handleNext}
            disabled={(step === 0 && !name) || (step === 1 && !age)}
            className="w-full h-20 bg-zinc-900 text-white rounded-[2rem] font-bold text-lg flex items-center justify-between px-8 disabled:opacity-50 disabled:scale-100 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-zinc-900/20 mt-4 group shrink-0"
        >
            <span>Next Step</span>
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors border border-white/10">
                <ArrowRight size={22} />
            </div>
        </button>
      )}
    </div>
  );
};

export default Onboarding;