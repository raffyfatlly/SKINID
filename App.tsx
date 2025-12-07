import React, { useState, useEffect } from 'react';
import { UserProfile, AppView, Product, SkinMetrics, SkinType } from './types';
import FaceScanner from './components/FaceScanner';
import ProductScanner from './components/ProductScanner';
import SmartShelf from './components/SmartShelf';
import SkinAnalysisReport from './components/SkinAnalysisReport';
import Onboarding from './components/Onboarding';
import GuideOverlay from './components/GuideOverlay';
import SaveProfileModal from './components/SaveProfileModal';
import ProfileSetup from './components/ProfileSetup';
import AIAssistant from './components/AIAssistant';
import { getBuyingDecision, auditProduct } from './services/geminiService';
import { LayoutGrid, ScanBarcode, User, ChevronDown, Sparkles, X, Check, AlertOctagon, ShoppingBag, ArrowRightLeft, ThumbsUp, ThumbsDown, AlertTriangle, Trophy, Target, ShieldCheck, Zap, HelpCircle, BrainCircuit, FlaskConical, Ban } from 'lucide-react';

// --- VISUAL HIGHLIGHT COMPONENT ---
const PulseRing = ({ color = 'teal' }: { color?: 'teal' | 'indigo' }) => (
    <>
        <span className={`absolute -inset-1 rounded-[1.4rem] border-2 ${color === 'teal' ? 'border-teal-400' : 'border-indigo-400'} opacity-30 animate-ping pointer-events-none duration-1000`} />
        <span className={`absolute -inset-1 rounded-[1.4rem] border ${color === 'teal' ? 'border-teal-500' : 'border-indigo-500'} opacity-100 pointer-events-none shadow-[0_0_15px_rgba(20,184,166,0.5)]`} />
    </>
);

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  isHighlighted?: boolean;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, isHighlighted }) => (
  <button 
      onClick={onClick}
      className={`w-12 h-12 rounded-[1rem] flex items-center justify-center transition-all duration-300 relative ${
        active 
          ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/10 scale-105' 
          : 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600'
      }`}
  >
      {isHighlighted && <PulseRing color="teal" />}
      {icon}
  </button>
);

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.ONBOARDING);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tempUserData, setTempUserData] = useState<{name: string, age: number, skinType: SkinType} | null>(null);
  const [shelf, setShelf] = useState<Product[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [lastScannedProduct, setLastScannedProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // AI Chat State
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiTriggerQuery, setAiTriggerQuery] = useState<string | null>(null);
  
  // New Guidance State
  const [guideStep, setGuideStep] = useState<'ANALYSIS' | 'SCAN' | 'SHELF' | null>(null);
  const [showSaveProfileModal, setShowSaveProfileModal] = useState(false);

  // Persistence & Initial Load
  useEffect(() => {
    setTimeout(() => setIsLoading(false), 2000);

    const savedUser = localStorage.getItem('skinos_user_v2');
    const savedShelf = localStorage.getItem('skinos_shelf_v2');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      // Ensure backwards compatibility for existing users who might not have isAnonymous
      if (parsedUser.isAnonymous === undefined) parsedUser.isAnonymous = false;
      setUser(parsedUser);
      setView(AppView.DASHBOARD);
    }
    if (savedShelf) {
      setShelf(JSON.parse(savedShelf));
    }
  }, []);

  // --- INTERACTIVE GUIDE SEQUENCER ---
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    // Sequence Logic: Analysis (5s) -> Scan (5s) -> Shelf (5s) -> Off
    if (guideStep === 'ANALYSIS') {
        timer = setTimeout(() => {
            setGuideStep('SCAN');
        }, 5000);
    } else if (guideStep === 'SCAN') {
        timer = setTimeout(() => {
            setGuideStep('SHELF');
        }, 5000);
    } else if (guideStep === 'SHELF') {
        timer = setTimeout(() => {
            setGuideStep(null);
        }, 5000);
    }
    return () => clearTimeout(timer);
  }, [guideStep]);

  const startGuide = (isManual = false) => {
      // If not manually triggered, check if user has already seen the guide
      const hasSeen = localStorage.getItem('skinos_guide_seen_v2');
      if (!isManual && hasSeen) return;

      // Reset first to allow re-triggering if clicked rapidly
      setGuideStep(null);
      setTimeout(() => setGuideStep('ANALYSIS'), 100);

      // Mark as seen
      if (!isManual) {
          localStorage.setItem('skinos_guide_seen_v2', 'true');
      }
  };

  const advanceGuideStep = () => {
      if (guideStep === 'ANALYSIS') setGuideStep('SCAN');
      else if (guideStep === 'SCAN') setGuideStep('SHELF');
      else setGuideStep(null);
  };

  const stopGuide = () => {
      setGuideStep(null);
  };

  const resetApp = () => {
      localStorage.removeItem('skinos_user_v2');
      localStorage.removeItem('skinos_shelf_v2');
      localStorage.removeItem('skinos_guide_seen_v2');
      setUser(null);
      setShelf([]);
      setTempUserData(null);
      setGuideStep(null);
      setView(AppView.ONBOARDING);
  };

  const handleOnboardingComplete = (data: { name: string; age: number; skinType: SkinType }) => {
    setTempUserData(data);
    setView(AppView.FACE_SCANNER);
  };

  const handleScanComplete = (metrics: SkinMetrics, image: string) => {
    if (!tempUserData && !user) return; 

    const baseData = user ? { name: user.name, age: user.age, skinType: user.skinType } : tempUserData!;
    const isAnonymous = user ? user.isAnonymous : true;

    const newUser: UserProfile = {
      ...baseData,
      hasScannedFace: true,
      biometrics: metrics,
      faceImage: image,
      isAnonymous
    };
    setUser(newUser);
    localStorage.setItem('skinos_user_v2', JSON.stringify(newUser));
    setView(AppView.DASHBOARD);

    // Auto trigger save profile modal if anonymous
    if (newUser.isAnonymous) {
        setTimeout(() => setShowSaveProfileModal(true), 1500);
    }
  };

  const handleProductFound = (product: Product) => {
    setLastScannedProduct(product);
    setShowProductModal(true);
    setView(AppView.SMART_SHELF); 
  };

  const addToShelf = () => {
    if (lastScannedProduct) {
      const newShelf = [...shelf, lastScannedProduct];
      setShelf(newShelf);
      localStorage.setItem('skinos_shelf_v2', JSON.stringify(newShelf));
      setShowProductModal(false);
      setLastScannedProduct(null);
    }
  };

  const removeFromShelf = (id: string) => {
    const newShelf = shelf.filter(p => p.id !== id);
    setShelf(newShelf);
    localStorage.setItem('skinos_shelf_v2', JSON.stringify(newShelf));
  };
  
  const handleUpdateProduct = (updatedProduct: Product) => {
    const newShelf = shelf.map(p => p.id === updatedProduct.id ? updatedProduct : p);
    setShelf(newShelf);
    localStorage.setItem('skinos_shelf_v2', JSON.stringify(newShelf));
  };

  const handleSaveProfile = () => {
      if (user) {
          const updatedUser = { ...user, isAnonymous: false };
          setUser(updatedUser);
          localStorage.setItem('skinos_user_v2', JSON.stringify(updatedUser));
          setShowSaveProfileModal(false);
          startGuide(false); // Auto-start guide if not seen yet
      }
  };

  const handleCloseSaveProfile = () => {
      setShowSaveProfileModal(false);
      startGuide(false); // Auto-start guide if not seen yet
  }

  // Splash Screen
  if (isLoading) {
      return (
          <div className="h-screen w-full bg-white flex flex-col items-center justify-center">
              <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-[2rem] bg-teal-600 text-white flex items-center justify-center shadow-2xl shadow-teal-200">
                      <Sparkles className="animate-pulse" size={32} strokeWidth={1.5} />
                  </div>
                  <div className="absolute inset-0 bg-teal-600 rounded-[2rem] animate-ping opacity-20"></div>
              </div>
              <h1 className="text-sm font-bold tracking-[0.25em] uppercase text-zinc-900">SkinOS</h1>
          </div>
      )
  }

  const renderView = () => {
    switch (view) {
      case AppView.ONBOARDING:
        return <Onboarding onComplete={handleOnboardingComplete} />;

      case AppView.FACE_SCANNER:
        return <FaceScanner key="face-scanner" onScanComplete={handleScanComplete} />;
      
      case AppView.PRODUCT_SCANNER:
        return user ? (
          <ProductScanner 
            userProfile={user} 
            onProductFound={handleProductFound} 
            onCancel={() => setView(AppView.DASHBOARD)} 
          />
        ) : null;

      case AppView.SMART_SHELF:
        return user ? (
            <div className="pt-28 min-h-screen bg-white animate-in fade-in">
                 <SmartShelf 
                    products={shelf} 
                    onRemoveProduct={removeFromShelf} 
                    onScanNew={() => setView(AppView.PRODUCT_SCANNER)}
                    onUpdateProduct={handleUpdateProduct}
                    userProfile={user}
                />
            </div>
        ) : null;

      case AppView.PROFILE_SETUP:
        return user ? (
          <div className="pt-0 min-h-screen bg-white animate-in fade-in">
             <ProfileSetup 
                user={user} 
                onComplete={(updatedUser) => {
                    setUser(updatedUser);
                    localStorage.setItem('skinos_user_v2', JSON.stringify(updatedUser));
                    setView(AppView.DASHBOARD);
                }} 
                onBack={() => setView(AppView.DASHBOARD)} 
                onReset={resetApp}
             />
          </div>
        ) : null;

      case AppView.DASHBOARD:
      default:
        return user ? (
          <div className="pt-28 pb-32 min-h-screen bg-white animate-in fade-in duration-700">
             {/* Clean Modern Header */}
             <header className="fixed top-0 left-0 right-0 z-30 px-6 pt-12 pb-4 bg-white/90 backdrop-blur-xl border-b border-zinc-50 flex justify-between items-center h-28 transition-all">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-zinc-400 text-[10px] font-bold tracking-widest uppercase">Welcome back</p>
                        <button 
                            onClick={() => startGuide(true)}
                            className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                        >
                            <HelpCircle size={12} />
                        </button>
                    </div>
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight">{user.name}</h1>
                </div>
                
                {/* AVATAR / PROFILE BUTTON */}
                <button 
                    className={`relative w-12 h-12 rounded-[1rem] bg-zinc-50 border border-zinc-100 flex items-center justify-center font-bold text-teal-600 shadow-sm cursor-pointer group hover:bg-zinc-100 transition-colors z-30 active:scale-95`}
                    onClick={() => {
                        if (user.isAnonymous) {
                             setShowSaveProfileModal(true);
                        } else {
                            setView(AppView.PROFILE_SETUP);
                        }
                    }}
                >
                    {user.name.charAt(0)}
                    {user.isAnonymous && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                </button>
             </header>

             <div className="px-6 space-y-12">
                <SkinAnalysisReport 
                    userProfile={user}
                    shelf={shelf}
                    onRescan={() => {
                        setTempUserData({ name: user.name, age: user.age, skinType: user.skinType });
                        setView(AppView.FACE_SCANNER);
                    }}
                    onConsultAI={(query) => {
                        setAiTriggerQuery(query);
                        setIsAiChatOpen(true);
                    }}
                />
             </div>
          </div>
        ) : null;
    }
  };

  // --- SHOPPING ASSISTANT RENDERER ---
  const renderBuyingDecision = () => {
      if (!lastScannedProduct || !user) return null;

      const { verdict, audit, shelfConflicts, existingSameType, comparison } = getBuyingDecision(lastScannedProduct, shelf, user);
      
      const getColorClasses = (color: string) => {
          switch(color) {
              case 'emerald': return { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-100', icon: ShieldCheck };
              case 'rose': return { bg: 'bg-rose-500', text: 'text-rose-600', light: 'bg-rose-50', border: 'border-rose-100', icon: AlertTriangle };
              case 'amber': return { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50', border: 'border-amber-100', icon: AlertOctagon };
              case 'zinc': return { bg: 'bg-zinc-500', text: 'text-zinc-600', light: 'bg-zinc-100', border: 'border-zinc-200', icon: HelpCircle }; // Skip/Neutral
              default: return { bg: 'bg-zinc-500', text: 'text-zinc-500', light: 'bg-zinc-50', border: 'border-zinc-200', icon: HelpCircle };
          }
      }
      
      const theme = getColorClasses(verdict.color);
      
      const sortedBenefits = [...lastScannedProduct.benefits].sort((a, b) => {
          const scoreA = user.biometrics[a.target as keyof SkinMetrics] as number || 100;
          const scoreB = user.biometrics[b.target as keyof SkinMetrics] as number || 100;
          return scoreA - scoreB;
      });

      // Score-based status logic (Strict)
      const isLowScore = audit.adjustedScore < 50;
      const isMediocre = audit.adjustedScore >= 50 && audit.adjustedScore < 70;

      return (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900/40 backdrop-blur-md animate-in slide-in-from-bottom-full duration-500">
            <div className="mt-auto bg-white rounded-t-[2.5rem] overflow-hidden flex flex-col max-h-[92vh] shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-zinc-50 bg-white sticky top-0 z-10">
                    <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <ShoppingBag size={14} className="text-teal-500" /> Buying Assistant
                    </h2>
                    <button onClick={() => { setShowProductModal(false); setLastScannedProduct(null); }} className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center hover:bg-zinc-100 text-zinc-400">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6 bg-white">
                    {/* VERDICT CARD */}
                    <div className="text-center space-y-4 mb-8">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border ${theme.light} ${theme.border} ${theme.text}`}>
                             {verdict.decision === 'BUY' || verdict.decision === 'SWAP' ? <ThumbsUp size={12} /> : verdict.decision === 'COMPARE' ? <ArrowRightLeft size={12} /> : <ThumbsDown size={12} />} 
                             {verdict.title}
                        </div>
                        <div>
                            <h1 className={`text-7xl font-black tracking-tighter mb-1 ${theme.text.replace('600', '500')}`}>{audit.adjustedScore}%</h1>
                            <p className="text-zinc-500 font-medium text-sm">{verdict.description}</p>
                        </div>
                    </div>

                    {/* CONCISE REASONING CARD */}
                    <div className="modern-card rounded-[1.5rem] p-5 bg-zinc-50/50">
                        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <BrainCircuit size={14} className="text-teal-500" /> Analysis
                        </h3>
                        
                        <div className="space-y-3">
                            {/* 1. SAFETY CHECK (Strict) */}
                            {audit.warnings.length > 0 ? (
                                <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                                    <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-xs font-bold text-rose-700 block mb-0.5">Safety Alert</span>
                                        <p className="text-xs text-rose-600 leading-snug">{audit.warnings[0].reason}</p>
                                    </div>
                                </div>
                            ) : isLowScore ? (
                                <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                                    <Ban size={16} className="text-rose-500 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-xs font-bold text-rose-700 block mb-0.5">Low Compatibility</span>
                                        <p className="text-xs text-rose-600 leading-snug">{audit.analysisReason}</p>
                                    </div>
                                </div>
                            ) : isMediocre ? (
                                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                    <AlertOctagon size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-xs font-bold text-amber-700 block mb-0.5">Average Fit</span>
                                        <p className="text-xs text-amber-600 leading-snug">{audit.analysisReason}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                                    <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-xs font-bold text-emerald-700 block mb-0.5">Biometric Match</span>
                                        <p className="text-xs text-emerald-600 leading-snug">{audit.analysisReason}</p>
                                    </div>
                                </div>
                            )}

                            {/* 2. SHELF CONTEXT */}
                            {shelfConflicts.length > 0 ? (
                                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                    <AlertOctagon size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-xs font-bold text-amber-700 block mb-0.5">Routine Conflict</span>
                                        <p className="text-xs text-amber-600 leading-snug">{shelfConflicts[0]}</p>
                                    </div>
                                </div>
                            ) : existingSameType.length > 0 ? (
                                <div className="flex items-start gap-3 p-3 bg-zinc-100 border border-zinc-200 rounded-xl">
                                    <ArrowRightLeft size={16} className="text-zinc-500 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-xs font-bold text-zinc-700 block mb-0.5">Comparison</span>
                                        <p className="text-xs text-zinc-600 leading-snug">
                                            {comparison.result === 'BETTER' 
                                                ? `Scores higher than your current ${existingSameType[0].name}.` 
                                                : comparison.result === 'WORSE'
                                                ? `Your current ${existingSameType[0].name} is a better match.`
                                                : `Similar performance to your current ${existingSameType[0].name}.`}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* FORMULA BREAKDOWN LIST (Merged Risks & Benefits) */}
                    <div>
                        <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                             <FlaskConical size={12} /> Formula Breakdown
                        </h3>
                        <div className="space-y-3">
                             {/* Show Warnings First */}
                             {audit.warnings.map((risk, i) => (
                                 <div key={`r-${i}`} className="flex items-start gap-3 p-3 rounded-2xl bg-rose-50 border border-rose-100">
                                     <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                                     <div>
                                         <span className="text-xs font-bold text-rose-900 block mb-0.5">Safety Warning</span>
                                         <p className="text-xs text-zinc-600 leading-snug">{risk.reason}</p>
                                     </div>
                                 </div>
                             ))}

                             {/* Show Top Ingredients & Impact */}
                             {sortedBenefits.slice(0, 3).map((benefit, i) => {
                                 // Determine if this benefit is actually useful based on user's score
                                 const userScore = user.biometrics[benefit.target as keyof SkinMetrics] as number || 0;
                                 const isRelevant = userScore < 70; // Only relevant if user actually needs help in this area
                                 const isMismatch = isLowScore; // If product is a mismatch, benefits are theoretical

                                 // Skip positive benefits for mismatched products to avoid confusion
                                 if (isMismatch) return null;

                                 return (
                                     <div key={`b-${i}`} className="flex items-start gap-3 p-3 rounded-2xl bg-zinc-50 border border-zinc-100">
                                         <Zap size={16} className={isRelevant ? "text-teal-500 shrink-0 mt-0.5" : "text-zinc-400 shrink-0 mt-0.5"} />
                                         <div>
                                             <div className="flex items-center gap-2 mb-0.5">
                                                 <span className="text-xs font-bold text-zinc-900">{benefit.ingredient}</span>
                                                 {isRelevant && (
                                                     <span className="text-[9px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded uppercase">Helpful</span>
                                                 )}
                                             </div>
                                             <p className="text-xs text-zinc-600 leading-snug">
                                                 {benefit.description}
                                             </p>
                                         </div>
                                     </div>
                                 )
                             })}
                             
                             {/* Fallback if list is empty due to mismatch filter */}
                             {sortedBenefits.length > 0 && isLowScore && audit.warnings.length === 0 && (
                                 <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-center">
                                     <p className="text-xs text-zinc-400 italic">Beneficial ingredients not shown due to low overall compatibility.</p>
                                 </div>
                             )}
                        </div>
                    </div>

                </div>

                <div className="p-6 border-t border-zinc-100 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
                    <div className="grid grid-cols-2 gap-4">
                         <button 
                            onClick={() => { setShowProductModal(false); setLastScannedProduct(null); }}
                            className="py-4 rounded-2xl font-bold text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-colors"
                         >
                            Discard
                         </button>
                         <button 
                            onClick={addToShelf}
                            className="py-4 rounded-2xl bg-zinc-900 text-white font-bold shadow-xl shadow-zinc-900/10 hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                         >
                            Add to Shelf
                         </button>
                    </div>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen text-zinc-900 font-sans selection:bg-teal-100 selection:text-teal-900">
      {renderView()}

      {/* OVERLAYS */}
      <GuideOverlay step={guideStep} onDismiss={stopGuide} onNext={advanceGuideStep} />

      {showSaveProfileModal && (
          <SaveProfileModal 
            onSave={handleSaveProfile} 
            onClose={handleCloseSaveProfile} 
          />
      )}
      
      {/* AI ASSISTANT (Accessible from anywhere) */}
      {user && view !== AppView.ONBOARDING && view !== AppView.FACE_SCANNER && view !== AppView.PRODUCT_SCANNER && (
         <AIAssistant 
            user={user} 
            shelf={shelf} 
            isOpen={isAiChatOpen} 
            onOpen={() => setIsAiChatOpen(true)}
            onClose={() => setIsAiChatOpen(false)}
            triggerQuery={aiTriggerQuery}
         />
      )}

      {/* FLOATING DOCK NAVIGATION */}
      {view !== AppView.ONBOARDING && view !== AppView.FACE_SCANNER && view !== AppView.PRODUCT_SCANNER && view !== AppView.PROFILE_SETUP && (
        <div className="fixed bottom-8 left-0 right-0 z-40 flex justify-center pointer-events-none">
            <nav className="floating-nav pointer-events-auto rounded-[2rem] h-20 px-6 flex gap-8 items-center shadow-2xl">
                <NavButton 
                    active={view === AppView.DASHBOARD} 
                    onClick={() => setView(AppView.DASHBOARD)} 
                    icon={<User size={20} strokeWidth={view === AppView.DASHBOARD ? 3 : 2} />}
                    isHighlighted={guideStep === 'ANALYSIS'}
                />

                <button 
                    onClick={() => setView(AppView.PRODUCT_SCANNER)}
                    className={`w-16 h-16 bg-teal-600 rounded-[1.8rem] flex items-center justify-center text-white shadow-xl shadow-teal-600/40 transform transition-all duration-300 hover:scale-110 active:scale-95 border-4 border-white relative ${guideStep === 'SCAN' ? 'ring-4 ring-teal-400/50' : ''}`}
                >
                    {guideStep === 'SCAN' && <PulseRing color="teal" />}
                    <ScanBarcode size={28} strokeWidth={2.5} />
                </button>

                <NavButton 
                    active={view === AppView.SMART_SHELF} 
                    onClick={() => setView(AppView.SMART_SHELF)} 
                    icon={<LayoutGrid size={20} strokeWidth={view === AppView.SMART_SHELF ? 3 : 2} />}
                    isHighlighted={guideStep === 'SHELF'} 
                />
            </nav>
        </div>
      )}

      {showProductModal && renderBuyingDecision()}
    </div>
  );
};

export default App;