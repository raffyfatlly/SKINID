
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SkinMetrics, Product, UserProfile } from '../types';
import { auditProduct } from '../services/geminiService';
import { RefreshCw, Sparkles, Sun, Moon, Ban, CheckCircle2, AlertTriangle, Target, BrainCircuit, Stethoscope, Plus, Microscope, X, FlaskConical, Search, ArrowRight, Pipette, Droplet, Layers, Fingerprint, Info, AlertOctagon, GitBranch, ArrowUpRight } from 'lucide-react';

// --- SUB COMPONENTS ---

interface MetricRingProps {
  label: string;
  value: number;
  metricKey: keyof SkinMetrics;
  onSelect: (key: keyof SkinMetrics) => void;
}

const MetricRing: React.FC<MetricRingProps> = ({ label, value, metricKey, onSelect }) => {
  // Management by Exception Color Logic
  let colorClass = "text-zinc-300"; // Default / Average
  if (value < 60) colorClass = "text-rose-500"; // Critical
  else if (value > 89) colorClass = "text-emerald-500"; // Excellent
  
  // Animation state
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
      const observer = new IntersectionObserver(
          ([entry]) => {
              if (entry.isIntersecting) {
                  setIsVisible(true);
                  observer.disconnect(); // Trigger once
              }
          },
          { threshold: 0.1 } // Start when 10% visible
      );

      if (elementRef.current) {
          observer.observe(elementRef.current);
      }

      return () => observer.disconnect();
  }, []);

  useEffect(() => {
      if (!isVisible) return;

      // Animate value on view
      let start = 0;
      const duration = 1500;
      const startTime = performance.now();

      const animate = (time: number) => {
          const elapsed = time - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // Ease Out Quart
          const ease = 1 - Math.pow(1 - progress, 4);
          
          setDisplayValue(Math.round(start + (value - start) * ease));

          if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
  }, [value, isVisible]);

  return (
      <button 
        ref={elementRef}
        onClick={() => onSelect(metricKey)}
        className="flex flex-col items-center justify-center p-2 relative transition-transform w-full group hover:scale-110 duration-300 ease-out"
      >
          <div className="relative w-11 h-11 flex items-center justify-center mb-3">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle
                    cx="50" cy="50" r="40"
                    className="text-black transition-colors opacity-10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8" 
                  />
                  {/* Animated Stroke */}
                  <circle
                    cx="50" cy="50" r="40"
                    className={`${colorClass} transition-all duration-1000 ease-out`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={`${displayValue * 2.51}, 251`}
                    strokeLinecap="round"
                    style={{ 
                        opacity: isVisible ? 1 : 0,
                        transition: 'opacity 0.5s ease-out'
                    }}
                  />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-[10px] font-black tracking-tighter text-black`}>{displayValue}</span>
              </div>
          </div>
          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest truncate w-full text-center group-hover:text-teal-600 transition-colors">{label}</span>
      </button>
  );
};

interface GroupSectionProps {
    title: string;
    score: number;
    delayClass?: string;
    children?: React.ReactNode;
}

const GroupSection: React.FC<GroupSectionProps> = ({ title, score, delayClass = "", children }) => (
  <div className={`modern-card rounded-[2rem] p-6 tech-reveal ${delayClass} hover:shadow-lg transition-shadow duration-500`}>
      <div className="flex justify-between items-center mb-6 px-1 border-b border-zinc-50 pb-4">
          <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest">{title}</h3>
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${score > 89 ? 'bg-emerald-50 text-emerald-600' : score < 60 ? 'bg-rose-50 text-rose-600' : 'text-zinc-400 bg-zinc-50'}`}>
              Avg: {Math.round(score)}
          </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
          {children}
      </div>
  </div>
);

interface MetricModalProps {
    metric: string; 
    score: number;
    age: number;
    observation?: string;
    onClose: () => void;
}

const MetricModal: React.FC<MetricModalProps> = ({ metric, score, age, observation, onClose }) => {
    const getAverage = () => {
        if (metric === 'sagging' || metric === 'wrinkleFine') return age < 30 ? 85 : 65;
        if (metric === 'oiliness') return age < 30 ? 60 : 80;
        return 75;
    };
    
    const avg = getAverage();
    const performance = score >= avg ? 'Above Average' : 'Below Average';

    const getObservation = () => {
        if (observation) return observation;
        
        const ROIMap: Record<string, string> = {
            'acneActive': 'Cheeks and Jawline',
            'acneScars': 'Cheek area',
            'poreSize': 'Nose/T-Zone',
            'blackheads': 'Nose and Chin',
            'wrinkleFine': 'Around eyes and forehead',
            'wrinkleDeep': 'Nasolabial folds and forehead',
            'sagging': 'Lower jawline contour',
            'pigmentation': 'Cheeks and forehead (Sun exposed areas)',
            'redness': 'Cheeks and nose bridge',
            'texture': 'Cheek surface',
            'hydration': 'General facial surface',
            'oiliness': 'Forehead and Nose (T-Zone)',
            'darkCircles': 'Under-eye area',
        };

        const location = ROIMap[metric] || 'Facial area';
        const severity = score < 60 ? 'Significant' : score < 80 ? 'Mild' : 'Minimal';
        
        // Detailed Fallbacks
        if (metric === 'poreSize') return `${severity} enlargement detected on ${location} based on shadow analysis.`;
        if (metric === 'acneActive') return `${severity} inflammatory markers detected on ${location}.`;
        if (metric === 'redness') return `${severity} vascular reactivity observed on ${location}.`;
        if (metric === 'wrinkleFine') return `${severity} static lines detected ${location}.`;
        if (metric === 'pigmentation') return `${severity} melanin clustering observed on ${location}.`;
        
        if (score > 85) return `Healthy tissue density and clear skin surface detected on ${location}.`;
        return `${severity} biometric markers detected on ${location} needing attention.`;
    }

    // Simplified Display terms
    const getDisplayTerm = (m: string) => {
        if (m === 'acneActive') return 'Acne';
        if (m === 'wrinkleFine') return 'Fine Lines';
        if (m === 'wrinkleDeep') return 'Wrinkles';
        if (m === 'poreSize') return 'Pores (Enlarged)';
        if (m === 'acneScars') return 'Scars/Marks';
        return m.charAt(0).toUpperCase() + m.slice(1);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/40 backdrop-blur-md animate-in fade-in duration-300">
             <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 relative animate-in zoom-in-95 shadow-2xl">
                 <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-zinc-50 rounded-full text-zinc-400 hover:bg-zinc-100 transition-colors">
                     <X size={20} />
                 </button>

                 <div className="text-center mb-10 mt-4 tech-reveal">
                     <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{getDisplayTerm(metric)}</span>
                     <h2 className="text-7xl font-black text-zinc-900 mt-4 mb-4 tracking-tighter">{score}</h2>
                     <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-wide ${score > avg ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                         {performance}
                     </span>
                 </div>

                 <div className="mb-10 tech-reveal delay-100">
                     <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
                         <span>Peer Average ({avg})</span>
                         <span>You ({score})</span>
                     </div>
                     <div className="h-3 bg-zinc-100 rounded-full overflow-hidden relative">
                         <div className="absolute top-0 bottom-0 w-0.5 bg-zinc-400 z-10" style={{ left: `${avg}%` }} />
                         <div className={`h-full rounded-full transition-all duration-1000 draw-stroke ${score > 80 ? 'bg-emerald-400' : score > 60 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${score}%` }} />
                     </div>
                     <p className="text-[10px] text-zinc-400 mt-3 text-center">Comparing against age group: {age-5}-{age+5}</p>
                 </div>

                 <div className="bg-teal-50/50 rounded-2xl p-6 border border-teal-100/50 tech-reveal delay-200">
                     <h4 className="text-xs font-bold text-teal-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                         <Microscope size={14} /> AI Observation
                     </h4>
                     <p className="text-sm text-zinc-600 leading-relaxed font-medium">
                         {getObservation()}
                     </p>
                 </div>
             </div>
        </div>
    )
}

interface RoutineRecommendation {
    ingredients: string[];
    benefit: string;
    formulation: string;
    vehicle: string;
    actionType: string;
}

const SkinAnalysisReport: React.FC<{ userProfile: UserProfile; shelf: Product[]; onRescan: () => void; }> = ({ userProfile, shelf, onRescan }) => {
  const metrics = userProfile.biometrics;
  const age = userProfile.age || 25; 
  
  const [selectedMetric, setSelectedMetric] = useState<keyof SkinMetrics | null>(null);
  const [activeRoutineTab, setActiveRoutineTab] = useState<'AM' | 'PM'>('AM');
  const [complexity, setComplexity] = useState<'BASIC' | 'ADVANCED'>(userProfile.preferences?.complexity === 'ADVANCED' ? 'ADVANCED' : 'BASIC');
  const [isStrategyDismissed, setIsStrategyDismissed] = useState(false);
  
  // Intersection Observer for Radar Chart
  const [isChartVisible, setIsChartVisible] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const observer = new IntersectionObserver(
          ([entry]) => {
              if (entry.isIntersecting) {
                  setIsChartVisible(true);
                  observer.disconnect();
              }
          },
          { threshold: 0.3 }
      );
      if (chartRef.current) observer.observe(chartRef.current);
      return () => observer.disconnect();
  }, []);

  const calculatedSkinType = useMemo(() => {
      const parts = [];
      const isSensitive = metrics.redness < 60;
      
      // FIX: Prioritize Dryness over Oiliness when hydration is critically low.
      // Computer vision often mistakes peeling skin (white flakes) for shine/oil due to high reflectivity.
      // If hydration is critically low (<45), it is almost certainly Dry/Peeling, not Oily.
      const isCriticallyDry = metrics.hydration < 45;
      
      const isOily = metrics.oiliness < 50;
      const isDry = metrics.hydration < 55;
      
      if (isSensitive) parts.push("Sensitive");

      if (isCriticallyDry) {
          parts.push("Dry");
      } else if (isOily) {
          parts.push("Oily");
      } else if (isDry) {
          parts.push("Dry");
      } else if (metrics.oiliness > 50 && metrics.oiliness < 70) {
          parts.push("Combination");
      } else {
          parts.push("Normal");
      }

      return parts.join(" + ");
  }, [metrics]);

  const groupAnalysis = useMemo(() => {
      const blemishScore = (metrics.acneActive + metrics.acneScars + metrics.blackheads + metrics.poreSize) / 4;
      const healthScore = (metrics.hydration + metrics.oiliness + metrics.redness + metrics.texture) / 4;
      const agingScore = (metrics.pigmentation + metrics.darkCircles + metrics.wrinkleFine + metrics.wrinkleDeep + metrics.sagging) / 5;

      const scores = [{ name: 'Blemishes', val: blemishScore }, { name: 'Skin Health', val: healthScore }, { name: 'Aging Signs', val: agingScore }].sort((a,b) => a.val - b.val);
      const lowestGroup = scores[0];

      let summary = "";
      if (lowestGroup.val > 80) summary = "Your skin is resilient and balanced. Focus on maintenance.";
      else if (lowestGroup.name === 'Blemishes') summary = "Blemishes are the primary concern. We detected congestion and active spots.";
      else if (lowestGroup.name === 'Skin Health') summary = "Barrier health is compromised. Signs of sensitivity or dehydration detected.";
      else summary = "Early structural changes detected. Focus on collagen support.";

      return { blemishScore, healthScore, agingScore, priorityCategory: lowestGroup.name, priorityScore: lowestGroup.val, summaryText: metrics.analysisSummary || summary };
  }, [metrics]);

  const strategyInsight = useMemo(() => {
      const goals = userProfile.preferences?.goals || [];
      if (goals.length === 0) return null;

      const primaryGoal = goals[0];
      const isAcneCritical = metrics.acneActive < 60;
      const isBarrierCritical = metrics.redness < 55 || metrics.hydration < 50;

      // Conflict 1: Wants Anti-Aging, but has Acne
      if (primaryGoal === 'Look Younger & Firm' || primaryGoal === 'Brighten Dark Spots') {
          if (isAcneCritical) return {
              type: 'CONFLICT',
              title: 'Prioritizing Health',
              message: `You targeted ${primaryGoal.toLowerCase()}, but active inflammation must be cleared first.`,
              subMessage: "We've focused the routine on stabilization. Anti-aging actives can be added once skin is clear."
          };
      }
      
      // Conflict 2: Wants Anti-Aging/Brightening, but has damaged barrier
      if (primaryGoal !== 'Smooth & Hydrated Skin' && isBarrierCritical) {
          return {
              type: 'CONFLICT',
              title: 'Barrier Repair First',
              message: "Your skin barrier is compromised. Strong actives for your goal may cause irritation right now.",
              subMessage: "We're starting with repair. Your goal actives are phased in later."
          };
      }

      return {
          type: 'ALIGNED',
          title: 'Goal Aligned',
          message: `Your clinical needs align perfectly with your goal to ${primaryGoal.toLowerCase()}.`,
          subMessage: "Routine optimized for maximum efficacy toward your target."
      };
  }, [metrics, userProfile.preferences]);

  const highlightVerdict = (text: string) => {
      const keyTerms = [
          "Blemishes", "congestion", "active spots", "Acne", "breakouts",
          "Barrier health", "sensitivity", "dehydration", "compromised", "Dry", "Oily",
          "Structural changes", "collagen", "aging", "wrinkles", "fine lines", "sagging",
          "Resilient", "balanced", "maintenance", "healthy", "glow",
          "Inflammation", "Redness", "Pigmentation", "Dark spots"
      ];
      
      const regex = new RegExp(`(${keyTerms.join('|')})`, 'gi');
      const parts = text.split(regex);

      return (
          <span>
              {parts.map((part, i) => 
                  keyTerms.some(k => k.toLowerCase() === part.toLowerCase()) 
                      ? <span key={i} className="font-black text-zinc-900">{part}</span> 
                      : <span key={i} className="text-zinc-500 font-medium">{part}</span>
              )}
          </span>
      );
  };

  const prescription = useMemo(() => {
    // 1. Base Scores
    let rankedConcerns = [
        { id: 'acneActive', score: metrics.acneActive }, { id: 'acneScars', score: metrics.acneScars },
        { id: 'pigmentation', score: metrics.pigmentation }, { id: 'redness', score: metrics.redness },
        { id: 'wrinkleFine', score: metrics.wrinkleFine }, { id: 'wrinkleDeep', score: metrics.wrinkleDeep },
        { id: 'hydration', score: metrics.hydration }, { id: 'oiliness', score: metrics.oiliness },
        { id: 'poreSize', score: metrics.poreSize }, { id: 'blackheads', score: metrics.blackheads },
        { id: 'texture', score: metrics.texture }, { id: 'sagging', score: metrics.sagging },
        { id: 'darkCircles', score: metrics.darkCircles }
    ];

    // 2. Apply "Clinical Gravity" 
    // Active conditions (Acne, Redness) are inherently heavier/more urgent than passive ones (Wrinkles)
    // We subtract from their score to make them rank higher (since we sort ascending)
    rankedConcerns = rankedConcerns.map(c => {
        if (c.id === 'acneActive') return { ...c, score: c.score - 15 }; // Huge priority boost
        if (c.id === 'redness') return { ...c, score: c.score - 10 };   // Priority boost
        return c;
    });

    // 3. User Preference Nudge (Minor)
    // We do NOT let preference override critical issues (score < 50), but we use it for tie-breaking
    const goals = userProfile.preferences?.goals || [];
    if (goals.length > 0) {
        if (goals.includes('Look Younger & Firm')) {
             const idx = rankedConcerns.findIndex(c => c.id === 'wrinkleFine');
             if (idx > -1) rankedConcerns[idx].score -= 5; // Slight nudges only
        }
        if (goals.includes('Clear Acne & Blemishes')) {
             const idx = rankedConcerns.findIndex(c => c.id === 'acneActive');
             if (idx > -1) rankedConcerns[idx].score -= 5;
        }
        // ... add others
    }

    // 4. Sort: Lowest score = Highest Priority
    rankedConcerns.sort((a, b) => a.score - b.score);
    const topConcerns = rankedConcerns.slice(0, 3);

    const ingredients: { name: string, action: string }[] = [];
    topConcerns.forEach(concern => {
        switch(concern.id) {
            case 'acneActive': ingredients.push({ name: 'Salicylic Acid', action: 'Unclogs pores & clears acne.' }, { name: 'Benzoyl Peroxide', action: 'Kills acne bacteria.' }); break;
            case 'acneScars': ingredients.push({ name: 'Azelaic Acid', action: 'Fades post-acne redness.' }, { name: 'Niacinamide', action: 'Fades dark spots.' }); break;
            case 'pigmentation': ingredients.push({ name: 'Vitamin C', action: 'Brightens skin tone.' }, { name: 'Tranexamic Acid', action: 'Prevents pigment transfer.' }); break;
            case 'redness': ingredients.push({ name: 'Centella', action: 'Soothes inflammation.' }, { name: 'Panthenol', action: 'Strengthens barrier.' }); break;
            case 'wrinkleFine': ingredients.push({ name: 'Retinol', action: 'Smooths fine lines.' }, { name: 'Peptides', action: 'Boosts collagen.' }); break;
            case 'wrinkleDeep': ingredients.push({ name: 'Retinal', action: 'Reduces deep wrinkles.' }, { name: 'Growth Factors', action: 'Deep tissue repair.' }); break;
            case 'hydration': ingredients.push({ name: 'Hyaluronic Acid', action: 'Deep hydration.' }, { name: 'Polyglutamic Acid', action: 'Locks in moisture.' }); break;
            case 'oiliness': ingredients.push({ name: 'Niacinamide', action: 'Balances oil production.' }, { name: 'Green Tea', action: 'Antioxidant & Oil control.' }); break;
            case 'poreSize': ingredients.push({ name: 'BHA', action: 'Cleans out pores.' }, { name: 'Niacinamide', action: 'Tightens pore appearance.' }); break;
            case 'blackheads': ingredients.push({ name: 'Salicylic Acid', action: 'Dissolves blackheads.' }, { name: 'Clay', action: 'Absorbs excess oil.' }); break;
            case 'texture': ingredients.push({ name: 'Glycolic Acid', action: 'Exfoliates surface.' }, { name: 'Urea', action: 'Softens rough skin.' }); break;
            case 'sagging': ingredients.push({ name: 'Copper Peptides', action: 'Firms skin.' }, { name: 'Vitamin C', action: 'Boosts firmness.' }); break;
            case 'darkCircles': ingredients.push({ name: 'Caffeine', action: 'Depuffs eyes.' }); break;
        }
    });

    const uniqueIngredients = ingredients.filter((v,i,a)=>a.findIndex(t=>(t.name===v.name))===i).slice(0, 4);

    const avoid: string[] = [];
    if (metrics.redness < 65) avoid.push('Fragrance', 'Alcohol Denat', 'Essential Oils');
    if (metrics.hydration < 55) avoid.push('Clay Masks', 'SLS', 'High % Acids');
    if (metrics.acneActive < 65 || metrics.oiliness < 55) avoid.push('Coconut Oil', 'Shea Butter', 'Mineral Oil');
    if (avoid.length === 0) avoid.push('Harsh Physical Scrubs');

    return { topConcerns, ingredients: uniqueIngredients, avoid };
  }, [metrics, complexity, userProfile.preferences]);

  const routinePlan = useMemo(() => {
    const plan: Record<string, RoutineRecommendation> = {};
    const usedIngredients = new Set<string>();

    const vehicleMap: Record<string, string[]> = {
        'CLEANSER': ['Salicylic Acid', 'Benzoyl Peroxide', 'Glycolic Acid', 'Lactic Acid', 'BHA', 'AHA', 'Tea Tree', 'Oat'],
        'TONER': ['Glycolic Acid', 'Salicylic Acid', 'Lactic Acid', 'BHA', 'AHA', 'Centella', 'Green Tea'],
        'SERUM': ['Retinol', 'Retinal', 'Vitamin C', 'Niacinamide', 'Tranexamic Acid', 'Alpha Arbutin', 'Peptides', 'Copper Peptides', 'Azelaic Acid'],
        'MOISTURIZER': ['Ceramides', 'Urea', 'Peptides', 'Centella', 'Panthenol', 'Squalane', 'Hyaluronic Acid'],
        'SPF': ['Zinc Oxide', 'Titanium Dioxide', 'Vitamin C', 'Niacinamide'],
        'TREATMENT': ['Benzoyl Peroxide', 'Salicylic Acid', 'Adapalene', 'Azelaic Acid', 'Retinol', 'Tretinoin', 'Sulfur']
    };

    // Helper: Determine Ideal Texture/Formulation based on Skin Type
    const getFormulation = (step: string): string => {
        const isOily = metrics.oiliness < 50;
        const isDry = metrics.hydration < 55 || metrics.oiliness > 80;
        const isSensitive = metrics.redness < 60;

        switch(step) {
            case 'CLEANSER':
                if (isOily) return "Foaming Gel";
                if (isDry) return "Milky Lotion";
                if (isSensitive) return "Fragrance-Free Gel";
                return "Gentle Gel";
            case 'TONER':
                if (isOily) return "Light Liquid";
                if (isDry) return "Milky Essence";
                return "Hydrating Mist";
            case 'SERUM':
                if (isOily) return "Water-based";
                if (isDry) return "Oil-in-Water Emulsion";
                return "Lightweight Fluid";
            case 'MOISTURIZER':
                if (isOily) return "Gel-Cream";
                if (isDry) return "Rich Cream or Balm";
                return "Light Cream";
            case 'SPF':
                if (isOily) return "Matte / Oil-Free";
                if (isSensitive) return "Mineral (Zinc Based)";
                return "Invisible Finish";
            case 'TREATMENT':
                return "Spot Gel";
            default: return "Standard";
        }
    };

    // Global Routine Solver
    // 1. Sort prescriptions by urgency
    const sortedActiveNeeds = [...prescription.ingredients]; // Already ranked

    const slotsToFill = [
        { key: 'SERUM_PM', type: 'SERUM', time: 'PM' },
        { key: 'CLEANSER_PM', type: 'CLEANSER', time: 'PM' },
        { key: 'TREATMENT_PM', type: 'TREATMENT', time: 'PM' },
        { key: 'SERUM_AM', type: 'SERUM', time: 'AM' },
        { key: 'CLEANSER_AM', type: 'CLEANSER', time: 'AM' },
        { key: 'TONER_AM', type: 'TONER', time: 'AM' },
        { key: 'TONER_PM', type: 'TONER', time: 'PM' },
        { key: 'MOISTURIZER_PM', type: 'MOISTURIZER', time: 'PM' },
        { key: 'SPF_AM', type: 'SPF', time: 'AM' }
    ];

    // Auto-fill slots
    slotsToFill.forEach(slot => {
        const potentialMatches: { name: string, action: string }[] = [];
        const formulation = getFormulation(slot.type);

        // Try to place a prescribed active
        for (const ing of sortedActiveNeeds) {
            if (usedIngredients.has(ing.name)) continue;
            
            const fitsVehicle = vehicleMap[slot.type]?.some(v => ing.name.includes(v));
            if (!fitsVehicle) continue;

            const isPMOnly = ['Retinol', 'Retinal', 'Growth Factors', 'Glycolic Acid', 'AHA'].some(x => ing.name.includes(x));
            const isAMOnly = ['Vitamin C', 'SPF'].some(x => ing.name.includes(x));
            if (slot.time === 'AM' && isPMOnly) continue;
            if (slot.time === 'PM' && isAMOnly) continue;

            potentialMatches.push(ing);
        }

        if (potentialMatches.length > 0) {
            const primary = potentialMatches[0];
            const alternatives = potentialMatches.slice(1, 3).map(i => i.name);
            usedIngredients.add(primary.name);
            
            plan[slot.key] = {
                ingredients: [primary.name, ...alternatives],
                vehicle: slot.type,
                formulation: formulation,
                benefit: primary.action,
                actionType: slot.type === 'CLEANSER' ? 'Wash-off Treatment' : 'Leave-on Active'
            };
        } else {
            // Fallback Logic
            let fallbackBenefit = "Maintenance";
            let fallbackIngs = [] as string[];
            
            if (slot.type === 'CLEANSER') {
                const isOily = metrics.oiliness < 50;
                fallbackBenefit = isOily ? 'Oil Control' : 'Gentle Cleansing';
                fallbackIngs = isOily ? ['Salicylic Acid', 'Tea Tree'] : ['Glycerin', 'Ceramides'];
            }
            else if (slot.type === 'TONER') {
                fallbackBenefit = 'pH Balance';
                fallbackIngs = ['Hyaluronic Acid', 'Rose Water'];
            }
            else if (slot.type === 'SERUM') {
                fallbackBenefit = slot.time === 'AM' ? 'Antioxidant Protection' : 'Repair & Recovery';
                fallbackIngs = slot.time === 'AM' ? ['Vitamin E', 'Ferulic Acid'] : ['Peptides', 'Niacinamide'];
            }
            else if (slot.type === 'MOISTURIZER') {
                fallbackBenefit = 'Barrier Support';
                fallbackIngs = ['Ceramides', 'Squalane'];
            }
            else if (slot.type === 'SPF') {
                fallbackBenefit = 'UV Defense';
                fallbackIngs = ['Zinc Oxide', 'Avobenzone'];
            }
            else if (slot.type === 'TREATMENT') {
                fallbackBenefit = 'Targeted Correction';
                fallbackIngs = ['Spot Treatment', 'Patches'];
            }

            plan[slot.key] = {
                ingredients: fallbackIngs,
                vehicle: slot.type,
                formulation: formulation,
                benefit: fallbackBenefit,
                actionType: 'Essential Step'
            };
        }
    });

    return plan;
  }, [prescription, metrics]);

  const findBestMatch = (type: string, stepName: string) => {
      let candidates = shelf.filter(p => {
          if (type === 'CLEANSER') return p.type === 'CLEANSER';
          if (type === 'TONER') return p.type === 'TONER';
          if (type === 'SERUM') return p.type === 'SERUM' || p.type === 'TREATMENT';
          if (type === 'TREATMENT') return p.type === 'TREATMENT' || p.type === 'SERUM';
          if (type === 'MOISTURIZER') return p.type === 'MOISTURIZER';
          if (type === 'SPF') return p.type === 'SPF' || (p.type === 'MOISTURIZER' && p.name.toLowerCase().includes('spf'));
          return false;
      });

      if (candidates.length === 0) return null;

      const scored = candidates.map(p => {
          const audit = auditProduct(p, userProfile);
          let score = audit.adjustedScore;
          const hasPrescribed = prescription.ingredients.some(i => p.ingredients.join(' ').toLowerCase().includes(i.name.toLowerCase()));
          if (hasPrescribed) score += 15;
          return { product: p, score, audit, hasPrescribed };
      });

      scored.sort((a,b) => b.score - a.score);
      return scored[0];
  };

  const RoutineStep = ({ step, type, time }: { step: string, type: string, time: 'AM' | 'PM' }) => {
      const match = findBestMatch(type, step);
      const planKey = `${type}_${time}`;
      const rec = routinePlan[planKey] || { ingredients: ['Recommended'], vehicle: type, formulation: 'Standard', benefit: 'Care', actionType: 'Standard' };

      return (
          <div className="modern-card rounded-[1.5rem] p-6 relative transition-all hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl duration-300 animate-in slide-in-from-bottom-2 group cursor-default">
               <div className="flex justify-between items-start mb-4">
                   <div className="flex items-center gap-3">
                       <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 px-2 py-1 rounded-md border border-zinc-100 group-hover:bg-zinc-900 group-hover:text-white transition-colors duration-300">
                         {step} • <span className="font-black group-hover:text-white text-zinc-700">{type}</span>
                       </span>
                       {match?.hasPrescribed && match.audit.warnings.length === 0 && (
                           <span className="pulse-ring text-[10px] font-bold text-teal-600 flex items-center gap-1 bg-teal-50 px-2 py-1 rounded-md">
                               <Sparkles size={10} /> Smart Choice
                           </span>
                       )}
                   </div>
                   {match && (
                       <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide ${match.audit.warnings.length > 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                           {match.audit.warnings.length > 0 ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                           {match.audit.adjustedScore}% Match
                       </div>
                   )}
               </div>

               {match ? (
                   <div>
                       <h4 className="font-bold text-sm text-zinc-900 truncate leading-tight tracking-tight">{match.product.name}</h4>
                       <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest mb-4">{match.product.brand || 'Unknown Brand'}</p>
                       <div className="text-[11px] p-3 bg-zinc-50 rounded-xl text-zinc-600 font-medium border border-zinc-100">
                           {match.audit.warnings.length > 0 ? (
                               <p className="text-rose-600 font-bold flex gap-2 items-center"><Ban size={12}/> {match.audit.warnings[0].reason}</p>
                           ) : (
                               <p className="flex gap-2 items-center">
                                   <BrainCircuit size={12} className="text-teal-500 shrink-0" />
                                   {match.hasPrescribed ? `Contains prescribed ${prescription.ingredients.find(i => match.product.ingredients.join(' ').toLowerCase().includes(i.name.toLowerCase()))?.name || 'actives'}.` : `Safe, effective formula.`}
                               </p>
                           )}
                       </div>
                   </div>
               ) : (
                   <div className="border border-dashed border-zinc-200 rounded-xl p-5 bg-zinc-50/50 hover:bg-zinc-50 transition-colors group-hover:border-teal-200 group-hover:bg-teal-50/30">
                       <div className="flex items-center gap-2 mb-4 tech-reveal">
                           <div className="w-6 h-6 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 text-teal-500">
                              <Target size={12} />
                           </div>
                           <span className="text-[10px] font-bold uppercase tracking-widest text-teal-700">Goal: {rec.benefit}</span>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4 mb-4">
                           <div className="tech-reveal delay-100">
                               <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Key Active</span>
                               <div className="text-sm font-black text-zinc-900 tracking-tight flex items-center gap-2">
                                   {rec.ingredients[0]}
                               </div>
                           </div>
                           <div className="tech-reveal delay-200">
                               <span className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">Recommended Formula</span>
                               <div className="text-sm font-bold text-zinc-700 tracking-tight flex items-center gap-2">
                                   {rec.formulation}
                               </div>
                           </div>
                       </div>
                       
                       <div className="pt-3 border-t border-zinc-200/50 flex items-center justify-between tech-reveal delay-300">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-zinc-400 uppercase">Or try:</span>
                                <div className="flex flex-wrap gap-1">
                                    {rec.ingredients.slice(1).map((alt, i) => (
                                        <span key={i} className="text-[9px] font-medium text-zinc-500 bg-white px-1.5 py-0.5 rounded border border-zinc-100">{alt}</span>
                                    ))}
                                </div>
                            </div>
                            <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded">{rec.actionType}</span>
                       </div>
                   </div>
               )}
          </div>
      )
  };

  const priorityColor = groupAnalysis.priorityScore > 80 ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-rose-600 bg-rose-50 border-rose-100';
  const priorityLabel = groupAnalysis.priorityScore > 80 ? 'Maintenance' : 'Focus';

  return (
    <div className="space-y-12 pb-32">
        {/* HERO SELFIE - Full width clean look */}
        <div className="modern-card rounded-[2.5rem] overflow-hidden relative group hover:shadow-2xl transition-shadow duration-500">
            <div className="relative w-full overflow-hidden aspect-[4/5] sm:aspect-[16/9]">
                 {userProfile.faceImage ? (
                    <img src={userProfile.faceImage} className="w-full h-full object-cover transform transition-transform duration-[2s] group-hover:scale-105" alt="Scan" />
                 ) : (
                    <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-300">No Image</div>
                 )}
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                 
                 {/* Tech Overlay Grid Effect on Hover */}
                 <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />
                 
                 <button onClick={onRescan} className="absolute top-6 right-6 z-20 bg-white/20 backdrop-blur-md text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white/30 transition-colors border border-white/20">
                    <RefreshCw size={12} /> Rescan
                 </button>

                 <div className="absolute bottom-8 left-8 text-white w-full pr-8 flex justify-between items-end">
                     <div className="tech-reveal">
                         <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-1 block">Skin Health Score</span>
                         <span className="text-6xl font-black tracking-tighter">{metrics.overallScore}</span>
                     </div>
                     <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-right tech-reveal delay-100">
                         <span className="text-[9px] font-bold opacity-70 uppercase tracking-widest block mb-1">Skin Type</span>
                         <span className="text-sm font-bold tracking-wide flex items-center justify-end gap-2">
                            <Fingerprint size={14} className="text-teal-400" />
                            {calculatedSkinType}
                         </span>
                     </div>
                 </div>
            </div>
            
            <div className="p-8">
                {/* CLINICAL VERDICT */}
                <div className="mb-6 tech-reveal delay-200">
                    <div className="flex items-center justify-between mb-3">
                         <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                             <Stethoscope size={12} className="text-teal-500" />
                             Clinical Verdict
                         </h3>
                         <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${priorityColor}`}>
                             {priorityLabel}: {groupAnalysis.priorityCategory}
                         </span>
                    </div>
                    <div className="p-5 bg-zinc-50/80 rounded-[1.5rem] border border-zinc-100 relative group-hover:border-teal-100/50 transition-colors">
                        <div className="absolute left-0 top-6 bottom-6 w-1 bg-teal-500 rounded-r-full"></div>
                        <p className="text-sm text-zinc-700 leading-7 font-medium pl-4">
                             {highlightVerdict(groupAnalysis.summaryText)}
                        </p>
                    </div>
                </div>

                {/* STRATEGY INSIGHT (Goal Conflict) */}
                {strategyInsight && !isStrategyDismissed && (
                    <div className="mb-8 tech-reveal delay-300">
                        <div className={`modern-card rounded-[1.5rem] overflow-hidden group relative transition-all duration-300 ${strategyInsight.type === 'CONFLICT' ? 'border-cyan-100 hover:border-cyan-200' : 'border-emerald-100 hover:border-emerald-200'}`}>
                            
                            {/* Dismiss Button */}
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsStrategyDismissed(true);
                                }}
                                className="absolute top-3 right-3 p-2 rounded-full text-zinc-300 hover:text-zinc-500 hover:bg-zinc-50 transition-all z-20 active:scale-90"
                            >
                                <X size={14} />
                            </button>

                            {/* Accent Strip */}
                            <div className={`absolute top-0 bottom-0 left-0 w-1 ${strategyInsight.type === 'CONFLICT' ? 'bg-cyan-500' : 'bg-emerald-500'}`} />
                            
                            <div className="p-6 pl-7">
                                <div className="flex items-start gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${strategyInsight.type === 'CONFLICT' ? 'bg-cyan-50 text-cyan-600 border-cyan-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                                        {strategyInsight.type === 'CONFLICT' ? <GitBranch size={18} className="rotate-90" /> : <Target size={18} />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className={`text-xs font-black uppercase tracking-widest mb-1 ${strategyInsight.type === 'CONFLICT' ? 'text-cyan-900' : 'text-emerald-900'}`}>
                                                {strategyInsight.title}
                                            </h4>
                                            {strategyInsight.type === 'CONFLICT' && (
                                                <div className="flex items-center gap-1 bg-cyan-50 px-2 py-0.5 rounded text-[9px] font-bold text-cyan-600 border border-cyan-100 mr-6">
                                                   <ArrowUpRight size={10} /> Pivot
                                                </div>
                                            )}
                                        </div>
                                        
                                        <p className={`text-sm font-medium leading-relaxed mb-3 ${strategyInsight.type === 'CONFLICT' ? 'text-cyan-900' : 'text-emerald-900'}`}>
                                            {strategyInsight.message}
                                        </p>
                                        
                                        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide border shadow-sm ${strategyInsight.type === 'CONFLICT' ? 'bg-white text-cyan-600 border-cyan-100' : 'bg-white text-emerald-600 border-emerald-100'}`}>
                                            <Info size={12} /> {strategyInsight.subMessage}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mb-8">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <FlaskConical size={12} /> Prescribed Actives
                    </h4>
                    <div className="flex flex-wrap gap-2.5">
                        {prescription.ingredients.map((ing, i) => (
                            <div key={i} className={`bg-white border border-zinc-100 rounded-xl px-4 py-3 flex flex-col min-w-[100px] shadow-sm tech-reveal hover:border-teal-300 transition-colors cursor-default`} style={{ animationDelay: `${i * 100}ms` }}>
                                <span className="text-xs font-bold text-zinc-900 mb-0.5">{ing.name}</span>
                                <span className="text-[10px] text-zinc-400 font-medium">{ing.action}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {prescription.avoid.length > 0 && (
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 flex items-start gap-4 tech-reveal delay-300">
                        <Ban size={18} className="text-rose-500 mt-0.5 shrink-0" />
                        <div>
                            <span className="text-xs font-bold text-rose-700 block uppercase mb-1 tracking-wide">Ingredients to Avoid</span>
                            <p className="text-xs text-rose-600 leading-tight font-medium">
                                {prescription.avoid.join(', ')}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* RADAR CHART - Tech Obsidian Style with Interactive Zoom */}
        <div ref={chartRef} className="modern-card rounded-[2.5rem] p-10 flex flex-col items-center relative overflow-hidden animate-in slide-in-from-bottom-8 duration-700 delay-100 chart-container group cursor-crosshair">
             <h3 className="text-xs font-black text-zinc-900 uppercase tracking-widest mb-10">Balance Matrix</h3>
             
             <div className="relative w-full max-w-[260px] aspect-square chart-zoom">
                 <svg viewBox="-10 -10 140 140" className="w-full h-full">
                     {[20, 40, 60].map(r => (
                        <circle key={r} cx="60" cy="60" r={r/2} fill="none" stroke="#F4F4F5" strokeWidth="1" className={isChartVisible ? "draw-stroke" : "opacity-0"} />
                     ))}
                     
                     {/* Web lines */}
                     {[0, 60, 120, 180, 240, 300].map(deg => {
                         const rad = deg * Math.PI / 180;
                         return <line key={deg} x1="60" y1="60" x2={60 + 30*Math.cos(rad)} y2={60 + 30*Math.sin(rad)} stroke="#F4F4F5" strokeWidth="1" className={isChartVisible ? "draw-stroke" : "opacity-0"} />
                     })}
                     
                     {(() => {
                         const pts = [
                             { v: metrics.acneActive, a: -Math.PI/2 }, { v: metrics.redness, a: -Math.PI/6 },
                             { v: metrics.texture, a: Math.PI/6 }, { v: metrics.oiliness, a: Math.PI/2 },
                             { v: metrics.hydration, a: 5*Math.PI/6 }, { v: metrics.wrinkleFine, a: 7*Math.PI/6 }
                         ].map(p => {
                             const r = (p.v / 100) * 30; 
                             return { x: 60 + r * Math.cos(p.a), y: 60 + r * Math.sin(p.a) };
                         });

                         const polyPoints = pts.map(p => `${p.x},${p.y}`).join(' ');

                         return (
                            <g className={isChartVisible ? "opacity-100 transition-opacity duration-1000" : "opacity-0"}>
                                <polygon points={polyPoints} fill="rgba(13, 148, 136, 0.15)" stroke="#0F766E" strokeWidth="2" strokeLinejoin="round" className="draw-stroke" />
                                {pts.map((p, i) => (
                                    <circle key={i} cx={p.x} cy={p.y} r="2" fill="#0D9488" className="animate-pulse" />
                                ))}
                            </g>
                         )
                     })()}
                     
                     <text x="60" y="22" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#A1A1AA" letterSpacing="0.2">ACNE</text>
                     <text x="94" y="42" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#A1A1AA" letterSpacing="0.2">TONE</text>
                     <text x="94" y="78" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#A1A1AA" letterSpacing="0.2">TEXTURE</text>
                     <text x="60" y="98" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#A1A1AA" letterSpacing="0.2">OIL</text>
                     <text x="26" y="78" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#A1A1AA" letterSpacing="0.2">HYDRA</text>
                     <text x="26" y="42" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#A1A1AA" letterSpacing="0.2">AGING</text>
                 </svg>
             </div>
        </div>

        {/* METRICS - Spacious Layout with Smart Colors */}
        <div className="space-y-6">
             <GroupSection title="Blemishes" score={groupAnalysis.blemishScore} delayClass="delay-150">
                 <MetricRing label="Acne" value={metrics.acneActive} metricKey="acneActive" onSelect={setSelectedMetric} />
                 <MetricRing label="Scars" value={metrics.acneScars} metricKey="acneScars" onSelect={setSelectedMetric} />
                 <MetricRing label="Pores" value={metrics.poreSize} metricKey="poreSize" onSelect={setSelectedMetric} />
                 <MetricRing label="Blackheads" value={metrics.blackheads} metricKey="blackheads" onSelect={setSelectedMetric} />
             </GroupSection>

             <GroupSection title="Health" score={groupAnalysis.healthScore} delayClass="delay-200">
                 <MetricRing label="Hydration" value={metrics.hydration} metricKey="hydration" onSelect={setSelectedMetric} />
                 <MetricRing label="Oil Ctrl" value={metrics.oiliness} metricKey="oiliness" onSelect={setSelectedMetric} />
                 <MetricRing label="Redness" value={metrics.redness} metricKey="redness" onSelect={setSelectedMetric} />
                 <MetricRing label="Texture" value={metrics.texture} metricKey="texture" onSelect={setSelectedMetric} />
             </GroupSection>

             <GroupSection title="Aging" score={groupAnalysis.agingScore} delayClass="delay-300">
                 <MetricRing label="Fine Lines" value={metrics.wrinkleFine} metricKey="wrinkleFine" onSelect={setSelectedMetric} />
                 <MetricRing label="Wrinkles" value={metrics.wrinkleDeep} metricKey="wrinkleDeep" onSelect={setSelectedMetric} />
                 <MetricRing label="Firmness" value={metrics.sagging} metricKey="sagging" onSelect={setSelectedMetric} />
                 <MetricRing label="Spots" value={metrics.pigmentation} metricKey="pigmentation" onSelect={setSelectedMetric} />
                 {/* 5th item doesn't fit grid-cols-4 well, but we'll leave it or user scroll */}
                 <div className="col-span-4 mt-2 border-t border-zinc-50 pt-2 flex justify-center">
                    <div className="w-1/4">
                        <MetricRing label="Dark Circles" value={metrics.darkCircles} metricKey="darkCircles" onSelect={setSelectedMetric} />
                    </div>
                 </div>
             </GroupSection>
        </div>

        {/* ROUTINE */}
        <div className="pt-8 animate-in slide-in-from-bottom-8 duration-700 delay-500 relative">
            
            {/* Animated Connecting Line */}
            <div className="absolute top-24 bottom-12 left-[2.25rem] w-px bg-zinc-200 z-0 hidden sm:block origin-top animate-[scaleY_1s_ease-out_forwards] delay-700" style={{ transform: 'scaleY(0)', animationFillMode: 'forwards' }}></div>

            <div className="flex justify-between items-center mb-8 px-2 tech-reveal">
                <div>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Daily Routine</h2>
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mt-1.5">
                        {complexity} PLAN • {activeRoutineTab}
                    </p>
                </div>
                <div className="flex bg-white border border-zinc-100 rounded-full p-1 gap-1 shadow-sm">
                    <button onClick={() => setActiveRoutineTab('AM')} className={`p-3 rounded-full transition-all ${activeRoutineTab === 'AM' ? 'bg-amber-50 text-amber-500 shadow-sm' : 'text-zinc-300 hover:text-zinc-500'}`}><Sun size={20} /></button>
                    <button onClick={() => setActiveRoutineTab('PM')} className={`p-3 rounded-full transition-all ${activeRoutineTab === 'PM' ? 'bg-indigo-50 text-indigo-500 shadow-sm' : 'text-zinc-300 hover:text-zinc-500'}`}><Moon size={20} /></button>
                </div>
            </div>

            <div className="flex justify-center mb-10 tech-reveal delay-100">
                 <div className="inline-flex bg-white border border-zinc-100 rounded-2xl p-1.5 shadow-sm">
                     <button onClick={() => setComplexity('BASIC')} className={`px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${complexity === 'BASIC' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-600'}`}>Essential</button>
                     <button onClick={() => setComplexity('ADVANCED')} className={`px-8 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${complexity === 'ADVANCED' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-600'}`}>Complete</button>
                 </div>
            </div>

            <div className="space-y-5 relative">
                {activeRoutineTab === 'AM' ? (
                    <>
                        <RoutineStep step="01" type="CLEANSER" time="AM" />
                        {complexity === 'ADVANCED' && <RoutineStep step="02" type="TONER" time="AM" />}
                        <RoutineStep step={complexity === 'ADVANCED' ? "03" : "02"} type="SERUM" time="AM" />
                        <RoutineStep step={complexity === 'ADVANCED' ? "04" : "03"} type="SPF" time="AM" />
                    </>
                ) : (
                    <>
                         {complexity === 'ADVANCED' && <RoutineStep step="01" type="CLEANSER" time="PM" />} 
                         <RoutineStep step={complexity === 'ADVANCED' ? "02" : "01"} type="CLEANSER" time="PM" />
                         {complexity === 'ADVANCED' && <RoutineStep step="03" type="TONER" time="PM" />}
                         <RoutineStep step={complexity === 'ADVANCED' ? "04" : "02"} type="SERUM" time="PM" />
                         {complexity === 'ADVANCED' && <RoutineStep step="05" type="TREATMENT" time="PM" />}
                         {complexity === 'ADVANCED' && <RoutineStep step="06" type="MOISTURIZER" time="PM" />}
                         {complexity === 'BASIC' && <RoutineStep step="03" type="MOISTURIZER" time="PM" />}
                    </>
                )}
            </div>
        </div>

        {selectedMetric && (
            <MetricModal 
                metric={selectedMetric} 
                score={metrics[selectedMetric] as number} 
                age={age}
                observation={metrics.observations?.[selectedMetric]}
                onClose={() => setSelectedMetric(null)} 
            />
        )}
    </div>
  );
};

export default SkinAnalysisReport;
