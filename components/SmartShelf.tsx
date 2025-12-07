


import React, { useState, useMemo } from 'react';
import { Product, UserProfile, SkinMetrics } from '../types';
import { Plus, Droplet, Sun, Zap, Sparkles, AlertTriangle, Layers, AlertOctagon, Target, ShieldCheck, X, FlaskConical, Clock, Ban, ArrowRightLeft, CheckCircle2, Microscope, Dna, Palette, Brush, SprayCan, Stamp, DollarSign, TrendingUp, TrendingDown, Wallet, ArrowUpRight, Edit2, Save, Info, ArrowUpCircle } from 'lucide-react';
import { auditProduct, analyzeShelfHealth, analyzeProductContext } from '../services/geminiService';

interface SmartShelfProps {
  products: Product[];
  onRemoveProduct: (id: string) => void;
  onScanNew: () => void;
  onUpdateProduct: (product: Product) => void;
  userProfile: UserProfile;
}

const SmartShelf: React.FC<SmartShelfProps> = ({ products, onRemoveProduct, onScanNew, onUpdateProduct, userProfile }) => {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'ROUTINE' | 'VANITY'>('ROUTINE');
  
  // Price Editing State
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [tempPrice, setTempPrice] = useState<string>('');

  const shelfIQ = useMemo(() => analyzeShelfHealth(products, userProfile), [products, userProfile]);

  const makeupTypes = ['FOUNDATION', 'CONCEALER', 'POWDER', 'PRIMER', 'SETTING_SPRAY', 'BLUSH', 'BRONZER'];

  const filteredProducts = useMemo(() => {
      if (activeTab === 'ROUTINE') {
          return products.filter(p => !makeupTypes.includes(p.type));
      } else {
          return products.filter(p => makeupTypes.includes(p.type));
      }
  }, [products, activeTab]);

  const costAnalysis = useMemo(() => {
      let totalValue = 0;
      let monthlyCost = 0;
      let totalSuitability = 0;
      let count = 0;

      products.forEach(p => {
          const price = p.estimatedPrice || 45; 
          totalValue += price;

          // Estimate monthly cost based on depletion rate
          let durationMonths = 3;
          if (makeupTypes.includes(p.type)) durationMonths = 6;
          else if (p.type === 'SPF') durationMonths = 1.5;
          else if (p.type === 'SERUM' || p.type === 'TREATMENT') durationMonths = 2;
          else if (p.type === 'CLEANSER' || p.type === 'TONER') durationMonths = 3;
          else if (p.type === 'MOISTURIZER') durationMonths = 2.5;

          monthlyCost += price / durationMonths;
          
          // Use adjusted suitability score (after audit penalties) for realistic match
          const audit = auditProduct(p, userProfile);
          totalSuitability += audit.adjustedScore;
          count++;
      });
      
      const avgSuitability = count > 0 ? totalSuitability / count : 0;

      // Verdict Logic based on Cost vs Match % (Suitability)
      let verdict = { 
          title: "Balanced Investment", 
          desc: "Spending aligns with efficacy.", 
          icon: Wallet, 
          color: "text-zinc-600 bg-zinc-50 border-zinc-100" 
      };

      if (monthlyCost > 250 && avgSuitability < 70) {
          verdict = { title: "High Waste", desc: "High spend on low-match products.", icon: TrendingDown, color: "text-rose-600 bg-rose-50 border-rose-100" };
      } else if (monthlyCost > 150 && avgSuitability < 75) {
          verdict = { title: "Inefficient Spend", desc: "Overpaying for average results.", icon: AlertTriangle, color: "text-amber-600 bg-amber-50 border-amber-100" };
      } else if (monthlyCost < 200 && avgSuitability > 80) {
          verdict = { title: "Smart Value", desc: "High match at a smart price.", icon: TrendingUp, color: "text-emerald-600 bg-emerald-50 border-emerald-100" };
      } else if (monthlyCost > 300 && avgSuitability > 85) {
          verdict = { title: "Premium Match", desc: "High investment, excellent fit.", icon: Sparkles, color: "text-purple-600 bg-purple-50 border-purple-100" };
      } else if (monthlyCost < 100 && avgSuitability < 60) {
           verdict = { title: "Low Impact", desc: "Low cost, but needs optimization.", icon: AlertTriangle, color: "text-zinc-500 bg-zinc-50 border-zinc-200" };
      }

      return { totalValue: Math.round(totalValue), monthlyCost: Math.round(monthlyCost), avgSuitability: Math.round(avgSuitability), verdict };
  }, [products, userProfile]);

  const handleStartEditPrice = (p: Product) => {
      setTempPrice((p.estimatedPrice || 45).toString());
      setIsEditingPrice(true);
  };

  const handleSavePrice = () => {
      if (selectedProduct) {
          const newPrice = parseFloat(tempPrice);
          if (!isNaN(newPrice)) {
              onUpdateProduct({ ...selectedProduct, estimatedPrice: newPrice });
          }
          setIsEditingPrice(false);
      }
  };

  const getProductColor = (type: string) => {
      switch(type) {
          case 'CLEANSER': return 'bg-sky-50 text-sky-600';
          case 'SPF': return 'bg-amber-50 text-amber-600';
          case 'SERUM': return 'bg-teal-50 text-teal-600';
          case 'MOISTURIZER': return 'bg-rose-50 text-rose-600';
          case 'FOUNDATION': return 'bg-orange-50 text-orange-600';
          case 'POWDER': return 'bg-stone-50 text-stone-600';
          case 'PRIMER': return 'bg-purple-50 text-purple-600';
          default: return 'bg-zinc-50 text-zinc-600';
      }
  }

  const getProductIcon = (type: string) => {
      switch(type) {
          case 'CLEANSER': return <Droplet size={20} />;
          case 'SPF': return <Sun size={20} />;
          case 'SERUM': return <Zap size={20} />;
          case 'FOUNDATION': return <Palette size={20} />;
          case 'POWDER': return <Stamp size={20} />;
          case 'PRIMER': return <Layers size={20} />;
          case 'SETTING_SPRAY': return <SprayCan size={20} />;
          case 'BLUSH': return <Brush size={20} />;
          default: return <Sparkles size={20} />;
      }
  }

  const getGradeColor = (grade: string) => {
      switch(grade) {
          case 'S': return 'text-emerald-500 border-emerald-500 bg-emerald-50';
          case 'A': return 'text-teal-500 border-teal-500 bg-teal-50';
          case 'B': return 'text-sky-500 border-sky-500 bg-sky-50';
          case 'C': return 'text-amber-500 border-amber-500 bg-amber-50';
          default: return 'text-rose-500 border-rose-500 bg-rose-50';
      }
  }

  const getSortedBenefits = (product: Product) => {
      return [...product.benefits].sort((a, b) => {
          const scoreA = userProfile.biometrics[a.target as keyof SkinMetrics] as number || 100;
          const scoreB = userProfile.biometrics[b.target as keyof SkinMetrics] as number || 100;
          return scoreA - scoreB;
      });
  };

  const renderActionPlan = () => {
      const { analysis } = shelfIQ;
      const hasActions = analysis.riskyProducts.length > 0 || analysis.conflicts.length > 0 || analysis.missing.length > 0 || analysis.redundancies.length > 0 || analysis.upgrades.length > 0;

      if (!hasActions && products.length > 0) return null;

      return (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-700">
               <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                    <CheckCircle2 size={14} className="text-teal-500" /> Optimization Plan
               </h3>
               
               {/* 1. DISCONTINUE / REPLACE */}
               {analysis.riskyProducts.map((item, i) => (
                   <div key={`risk-${i}`} className="flex items-start gap-4 p-4 rounded-[1.5rem] bg-rose-50 border border-rose-100 relative overflow-hidden group">
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-400"></div>
                       <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 border border-rose-100 text-rose-500 shadow-sm">
                           <Ban size={18} />
                       </div>
                       <div className="flex-1">
                           <h4 className="text-xs font-black uppercase tracking-wide text-rose-800 mb-1">Issue: {item.name}</h4>
                           <p className="text-xs text-rose-700 font-medium leading-relaxed mb-2">
                               {item.reason}
                           </p>
                           <button 
                                onClick={() => {
                                    const p = products.find(prod => prod.name === item.name);
                                    if (p) { setSelectedProduct(p); }
                                }}
                                className="text-[10px] font-bold uppercase tracking-widest text-rose-600 bg-white px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-100 transition-colors"
                           >
                               View Product
                           </button>
                       </div>
                   </div>
               ))}

               {/* 2. UPGRADES (Replaces missing/bad items) */}
               {analysis.upgrades.map((upgrade, i) => (
                    <div key={`upg-${i}`} className="flex items-start gap-4 p-4 rounded-[1.5rem] bg-indigo-50 border border-indigo-100 relative overflow-hidden">
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400"></div>
                       <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 border border-indigo-100 text-indigo-500 shadow-sm">
                           <ArrowUpCircle size={18} />
                       </div>
                       <div className="flex-1">
                           <h4 className="text-xs font-black uppercase tracking-wide text-indigo-800 mb-1">Change {upgrade}</h4>
                           <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                               Your current {upgrade.toLowerCase()} has a low match score. Consider switching to a better suited formula.
                           </p>
                       </div>
                   </div>
               ))}

               {/* 3. SCHEDULE / CONFLICTS */}
               {analysis.conflicts.map((conflict, i) => (
                   <div key={`conflict-${i}`} className="flex items-start gap-4 p-4 rounded-[1.5rem] bg-orange-50 border border-orange-100 relative overflow-hidden">
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-400"></div>
                       <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 border border-orange-100 text-orange-500 shadow-sm">
                           <Clock size={18} />
                       </div>
                       <div className="flex-1">
                           <h4 className="text-xs font-black uppercase tracking-wide text-orange-800 mb-1">Adjust Routine</h4>
                           <p className="text-xs text-orange-700 font-medium leading-relaxed">
                               {conflict}. Use these products at different times of day (AM vs PM) or alternate nights.
                           </p>
                       </div>
                   </div>
               ))}

                {/* 4. SIMPLIFY / REDUNDANCIES */}
                {analysis.redundancies.map((red, i) => (
                   <div key={`red-${i}`} className="flex items-start gap-4 p-4 rounded-[1.5rem] bg-amber-50 border border-amber-100 relative overflow-hidden">
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>
                       <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 border border-amber-100 text-amber-500 shadow-sm">
                           <ArrowRightLeft size={18} />
                       </div>
                       <div className="flex-1">
                           <h4 className="text-xs font-black uppercase tracking-wide text-amber-800 mb-1">Simplify Steps</h4>
                           <p className="text-xs text-amber-700 font-medium leading-relaxed">
                               {red}. Choose the formula with the highest match score and store the other to avoid barrier damage.
                           </p>
                       </div>
                   </div>
               ))}

               {/* 5. ADD / MISSING */}
               {analysis.missing.map((missing, i) => (
                   <div key={`miss-${i}`} className="flex items-start gap-4 p-4 rounded-[1.5rem] bg-teal-50 border border-teal-100 relative overflow-hidden">
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-400"></div>
                       <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 border border-teal-100 text-teal-500 shadow-sm">
                           <Plus size={18} />
                       </div>
                       <div className="flex-1">
                           <h4 className="text-xs font-black uppercase tracking-wide text-teal-800 mb-1">Add {missing}</h4>
                           <p className="text-xs text-teal-700 font-medium leading-relaxed">
                               Your routine lacks a {missing.toLowerCase()}. Adding this step will improve your overall efficacy score.
                           </p>
                       </div>
                   </div>
               ))}
          </div>
      )
  };

  const renderDashboard = () => {
      const { analysis } = shelfIQ;
      
      if (products.length === 0) {
           return (
               <div className="modern-card rounded-[2rem] p-8 text-center border border-dashed border-zinc-200 shadow-none">
                   <p className="text-sm font-medium text-zinc-400">Your digital shelf is empty. Scan products to get AI insights.</p>
               </div>
           );
      }

      return (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
               {/* ROUTINE DNA MATRIX */}
               <div className="bg-white border border-zinc-100 rounded-[2rem] p-6 shadow-sm">
                   <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Dna size={12} className="text-teal-500" /> Routine DNA
                   </h3>
                   <div className="space-y-4">
                        {[
                            { label: 'Exfoliation', val: analysis.balance.exfoliation, color: 'bg-rose-400' },
                            { label: 'Hydration', val: analysis.balance.hydration, color: 'bg-sky-400' },
                            { label: 'Protection', val: analysis.balance.protection, color: 'bg-amber-400' },
                            { label: 'Actives', val: analysis.balance.treatment, color: 'bg-emerald-400' }
                        ].map((stat, i) => (
                            <div key={i}>
                                <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-1.5">
                                    <span>{stat.label}</span>
                                    <span>{stat.val > 100 ? 'High' : stat.val > 40 ? 'Optimal' : 'Low'}</span>
                                </div>
                                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${stat.color} transition-all duration-1000`} 
                                        style={{ width: `${Math.min(100, stat.val)}%` }} 
                                    />
                                </div>
                            </div>
                        ))}
                   </div>
               </div>
               
               {/* COST ANALYSIS CARD */}
               <div className="modern-card rounded-[2rem] p-6 relative overflow-hidden">
                   <div className="flex justify-between items-center mb-6">
                        <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                            <DollarSign size={12} className="text-teal-500" /> Cost Efficiency
                        </h3>
                        <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 border ${costAnalysis.verdict.color}`}>
                             <costAnalysis.verdict.icon size={12} />
                             {costAnalysis.verdict.title}
                        </div>
                   </div>
                   
                   <div className="flex items-center gap-6 mb-6">
                       <div className="flex-1">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block mb-1">Monthly Burn</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xs font-bold text-zinc-500">RM</span>
                                <span className="text-3xl font-black text-zinc-900 tracking-tight">{costAnalysis.monthlyCost}</span>
                            </div>
                       </div>
                       <div className="w-px h-10 bg-zinc-100"></div>
                       <div className="flex-1">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block mb-1">Skin Match</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-zinc-900 tracking-tight">{costAnalysis.avgSuitability}</span>
                                <span className="text-xs font-bold text-zinc-500">%</span>
                            </div>
                       </div>
                   </div>
                   
                   <p className="text-xs text-zinc-500 font-medium mb-6 leading-relaxed bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                       {costAnalysis.verdict.desc}
                   </p>
                   
                   <div className="flex gap-4 pt-4 border-t border-zinc-100">
                        <div>
                             <span className="block text-xs font-bold text-zinc-900">RM {costAnalysis.totalValue}</span>
                             <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide">Total Inventory</span>
                        </div>
                        <div>
                             <span className="block text-xs font-bold text-zinc-900">{products.length} Items</span>
                             <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide">Routine Size</span>
                        </div>
                   </div>
               </div>
          </div>
      )
  };

  return (
    <div className="pb-32 animate-in fade-in duration-500">
       <div className="px-6 space-y-8">
          <div className="flex justify-between items-end pt-6">
              <div>
                  <h2 className="text-3xl font-black text-zinc-900 tracking-tight">Digital Shelf</h2>
                  <p className="text-zinc-400 font-medium text-sm mt-1">Deep formula analysis.</p>
              </div>
              <button onClick={onScanNew} className="w-14 h-14 rounded-[1.2rem] bg-teal-600 text-white flex items-center justify-center shadow-xl shadow-teal-200 hover:scale-105 transition-transform active:scale-95">
                  <Plus size={24} />
              </button>
          </div>

          {/* MAIN SCORE CARD */}
          <div className="modern-card rounded-[2.5rem] p-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                 <span className={`text-9xl font-black ${getGradeColor(shelfIQ.analysis.grade).split(' ')[0]}`}>
                     {shelfIQ.analysis.grade}
                 </span>
             </div>

             <div className="relative z-10 flex items-start justify-between">
                 <div>
                     <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Routine Grade</h3>
                     <div className="flex items-baseline gap-2">
                         <span className={`text-5xl font-black ${getGradeColor(shelfIQ.analysis.grade).split(' ')[0]}`}>
                             {shelfIQ.analysis.grade}
                         </span>
                     </div>
                     <p className="text-xs font-medium text-zinc-500 mt-2 max-w-[180px] leading-relaxed">
                         {shelfIQ.analysis.grade === 'S' ? "Clinical perfection. High efficiency & safety." :
                          shelfIQ.analysis.grade === 'A' ? "Excellent. Covers all essential bases." :
                          shelfIQ.analysis.grade === 'B' ? "Good start, but missing some key steps." :
                          "Optimization required for safety/efficacy."}
                     </p>
                 </div>
                 
                 {/* Mini Stats Column */}
                 <div className="text-right space-y-3 pt-1">
                     <div>
                         <span className="block text-xl font-bold text-zinc-900">{products.length}</span>
                         <span className="text-[9px] font-bold text-zinc-400 uppercase">Items</span>
                     </div>
                     <div>
                         <span className={`block text-xl font-bold ${shelfIQ.analysis.conflicts.length > 0 ? 'text-amber-500' : 'text-zinc-900'}`}>{shelfIQ.analysis.conflicts.length}</span>
                         <span className="text-[9px] font-bold text-zinc-400 uppercase">Conflicts</span>
                     </div>
                 </div>
             </div>
          </div>

          {/* OPTIMIZATION PLAN (Moved directly under routine grade) */}
          {renderActionPlan()}

          {/* DASHBOARD CHARTS */}
          {renderDashboard()}
       </div>

       {/* TABS FOR ROUTINE VS VANITY */}
       <div className="px-6 mt-10">
           <div className="flex bg-zinc-100/50 p-1 rounded-2xl mb-6 border border-zinc-100">
               <button 
                  onClick={() => setActiveTab('ROUTINE')}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'ROUTINE' ? 'bg-white shadow-sm text-teal-700' : 'text-zinc-400 hover:text-zinc-600'}`}
               >
                  Skincare
               </button>
               <button 
                  onClick={() => setActiveTab('VANITY')}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'VANITY' ? 'bg-white shadow-sm text-teal-700' : 'text-zinc-400 hover:text-zinc-600'}`}
               >
                  Vanity
               </button>
           </div>
       </div>

       {/* PRODUCT LIST */}
       <div className="px-6 grid grid-cols-2 gap-4">
           {filteredProducts.map((p) => {
               const audit = auditProduct(p, userProfile);
               const warning = audit.warnings.length > 0;
               const score = Number(audit.adjustedScore);
               const isLowScore = !warning && (score < 70 || isNaN(score));
               const isRisky = shelfIQ.analysis.riskyProducts.some(r => r.name === p.name);
               const isConflict = shelfIQ.analysis.conflicts.some(c => c.toLowerCase().includes(p.ingredients[0]?.toLowerCase()) || p.ingredients.some(i => c.toLowerCase().includes(i.toLowerCase())));

               return (
                   <button 
                        key={p.id} 
                        onClick={() => setSelectedProduct(p)}
                        className="modern-card rounded-[2rem] p-5 text-left relative group flex flex-col items-start min-h-[180px] hover:border-teal-100 transition-colors"
                   >
                        <div className={`absolute top-5 right-5 w-2 h-2 rounded-full ${warning ? 'bg-rose-500' : isLowScore ? 'bg-amber-500' : 'bg-emerald-400'}`} />

                        <div className={`w-14 h-14 rounded-2xl ${getProductColor(p.type)} flex items-center justify-center mb-5`}>
                            {getProductIcon(p.type)}
                        </div>

                        <div className="flex-1 w-full">
                            <h3 className="font-bold text-sm text-zinc-900 leading-tight mb-1 line-clamp-2">{p.name}</h3>
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide truncate max-w-[70px]">{p.brand || 'Unknown'}</p>
                                <span className="text-[10px] font-bold text-zinc-300">RM {p.estimatedPrice || 45}</span>
                            </div>
                        </div>

                        <div className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wide ${
                            warning ? 'bg-rose-50 text-rose-700' : 
                            isLowScore ? 'bg-amber-50 text-amber-700' :
                            'bg-emerald-50 text-emerald-700'
                        }`}>
                            {warning ? (
                                <>
                                    <AlertTriangle size={12} className="mr-1.5" />
                                    AVOID
                                </>
                            ) : isConflict ? (
                                <>
                                    <Clock size={12} className="mr-1.5" />
                                    SCHEDULE
                                </>
                            ) : (
                                `${score}% MATCH`
                            )}
                        </div>
                   </button>
               )
           })}

           <button onClick={onScanNew} className="rounded-[2rem] border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-3 min-h-[180px] text-zinc-400 hover:bg-zinc-50 hover:border-zinc-300 transition-all group">
               <div className="w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center group-hover:bg-white group-hover:shadow-sm transition-all">
                   <Plus size={24} />
               </div>
               <span className="text-[10px] font-bold uppercase tracking-widest">Add Product</span>
           </button>
       </div>
       
       {activeTab === 'VANITY' && filteredProducts.length === 0 && (
           <div className="px-6 mt-4 text-center">
               <p className="text-zinc-400 text-sm font-medium">No cosmetics found. Scan foundation, powder, or primer to check compatibility.</p>
           </div>
       )}

       {/* PRODUCT DETAIL MODAL */}
       {selectedProduct && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/40 backdrop-blur-md animate-in fade-in">
                <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-8 relative animate-in zoom-in-95 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar">
                    <button onClick={() => { setSelectedProduct(null); setIsEditingPrice(false); }} className="absolute top-6 right-6 p-2 bg-zinc-50 rounded-full text-zinc-400 hover:bg-zinc-100 transition-colors">
                        <X size={20} />
                    </button>

                    <div className="text-center mb-8 mt-4">
                        <div className={`w-20 h-20 mx-auto rounded-[1.5rem] ${getProductColor(selectedProduct.type)} flex items-center justify-center mb-5 shadow-sm`}>
                            {getProductIcon(selectedProduct.type)}
                        </div>
                        <h3 className="text-2xl font-black text-zinc-900 leading-tight mb-2 tracking-tight">{selectedProduct.name}</h3>
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">{selectedProduct.brand}</p>
                        
                        {/* PRICE EDITOR */}
                        <div className="flex items-center justify-center gap-2">
                            {isEditingPrice ? (
                                <div className="flex items-center gap-2 animate-in fade-in">
                                    <span className="text-sm font-bold text-zinc-500">RM</span>
                                    <input 
                                        type="number" 
                                        value={tempPrice}
                                        onChange={(e) => setTempPrice(e.target.value)}
                                        className="w-20 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-sm font-bold focus:outline-none focus:border-teal-500"
                                        autoFocus
                                    />
                                    <button onClick={handleSavePrice} className="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                                        <Save size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => handleStartEditPrice(selectedProduct)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-zinc-50 text-zinc-500 hover:text-zinc-700 transition-colors group"
                                >
                                    <span className="text-sm font-bold">RM {selectedProduct.estimatedPrice || 45}</span>
                                    <Edit2 size={12} className="opacity-50 group-hover:opacity-100" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {(() => {
                             const audit = auditProduct(selectedProduct, userProfile);
                             const warning = audit.warnings.length > 0;
                             const score = Number(audit.adjustedScore);
                             const isLowScore = !warning && (score < 70 || isNaN(score));
                             
                             const cardStyle = warning ? 'bg-rose-50 border-rose-100' : 
                                               isLowScore ? 'bg-amber-50 border-amber-100' : 
                                               'bg-emerald-50 border-emerald-100';

                             const textStyle = warning ? 'text-rose-700' : 
                                               isLowScore ? 'text-amber-700' :
                                               'text-emerald-700';

                             const scoreStyle = warning ? 'text-rose-600' : 
                                                isLowScore ? 'text-amber-600' :
                                                'text-emerald-600';

                             const label = warning ? 'Biometric Mismatch' : 
                                           isLowScore ? 'Low Compatibility' : 
                                           'Excellent Fit';

                             return (
                                 <div className={`p-6 rounded-[1.5rem] border ${cardStyle}`}>
                                     <div className="flex justify-between items-center mb-2">
                                         <span className={`text-xs font-bold uppercase tracking-wide ${textStyle}`}>
                                             {label}
                                         </span>
                                         <span className={`text-3xl font-black ${scoreStyle}`}>{score}%</span>
                                     </div>
                                     {warning ? (
                                         <p className="text-sm text-rose-800 font-medium leading-relaxed">{audit.warnings[0].reason}</p>
                                     ) : isLowScore ? (
                                          <p className="text-sm text-amber-800 font-medium leading-relaxed">{audit.analysisReason}</p>
                                     ) : (
                                         <p className="text-sm text-emerald-800 font-medium leading-relaxed">Formulation aligns with your current skin metrics.</p>
                                     )}
                                 </div>
                             )
                        })()}

                        {(() => {
                             // Context Check
                             const otherProducts = products.filter(p => p.id !== selectedProduct.id);
                             const context = analyzeProductContext(selectedProduct, otherProducts);
                             const isRisky = shelfIQ.analysis.riskyProducts.some(r => r.name === selectedProduct.name);

                             if (isRisky && !auditProduct(selectedProduct, userProfile).warnings.length) {
                                // Fallback risk message if it was caught by shelf analysis but not individual audit (e.g. SPF warning)
                                const shelfRisk = shelfIQ.analysis.riskyProducts.find(r => r.name === selectedProduct.name);
                                if (shelfRisk) {
                                    return (
                                        <div className="p-6 rounded-[1.5rem] bg-rose-50 border border-rose-100">
                                            <h4 className="text-xs font-bold text-rose-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <AlertTriangle size={14} /> Biometric Alert
                                            </h4>
                                            <p className="text-sm text-rose-800 font-medium leading-relaxed">
                                                {shelfRisk.reason}
                                            </p>
                                        </div>
                                    )
                                }
                             }
                             
                             if (context.conflicts.length > 0) {
                                 return (
                                     <div className="p-6 rounded-[1.5rem] bg-indigo-50 border border-indigo-100">
                                          <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                              <Clock size={14} /> Usage Protocol
                                          </h4>
                                          <p className="text-sm text-indigo-800 font-medium leading-relaxed mb-3">
                                              Conflict detected. Do not use in the same session as:
                                          </p>
                                          {context.conflicts.map((c, i) => (
                                              <div key={i} className="flex items-start gap-2 text-indigo-600 bg-white p-2 rounded-lg border border-indigo-100 mb-2">
                                                  <AlertOctagon size={14} className="mt-0.5 shrink-0" />
                                                  <span className="text-xs font-bold leading-tight">{c}</span>
                                              </div>
                                          ))}
                                     </div>
                                 )
                             }
                             
                             if (context.typeCount > 0) {
                                return (
                                    <div className="p-6 rounded-[1.5rem] bg-amber-50 border border-amber-100">
                                        <h4 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <ArrowRightLeft size={14} /> Redundancy
                                        </h4>
                                        <p className="text-xs text-amber-800 font-medium leading-relaxed">
                                            You have {context.typeCount} other {selectedProduct.type.toLowerCase()}{context.typeCount > 1 ? 's' : ''}.
                                        </p>
                                    </div>
                                )
                             }

                             return null;
                        })()}
                        
                        {/* FORMULA ANALYSIS LIST (Combined Risks and Benefits) */}
                        {(() => {
                            const audit = auditProduct(selectedProduct, userProfile);
                            const risks = audit.warnings;
                            const benefits = selectedProduct.benefits;
                            
                            if (risks.length === 0 && benefits.length === 0) return null;

                            return (
                                <div className="p-6 rounded-[1.5rem] bg-zinc-50 border border-zinc-100">
                                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <FlaskConical size={14} /> Formula Analysis
                                    </h4>
                                    <ul className="space-y-3">
                                        {/* Risks First */}
                                        {risks.map((risk, i) => (
                                            <li key={`r-${i}`} className="flex items-start gap-3 bg-white p-3 rounded-2xl border border-rose-100 shadow-sm">
                                                <div className="mt-0.5 shrink-0">
                                                    <AlertTriangle size={16} className="text-rose-500" />
                                                </div>
                                                <div className="flex-1">
                                                     <div className="flex justify-between items-start mb-1">
                                                         <span className="text-xs font-bold text-rose-950">Safety Alert</span>
                                                         <span className="text-[9px] font-black uppercase px-2 py-1 rounded-md tracking-wide bg-rose-100 text-rose-600">
                                                             Avoid
                                                         </span>
                                                     </div>
                                                     <p className="text-[11px] text-zinc-600 font-medium leading-snug">
                                                         {risk.reason}
                                                     </p>
                                                </div>
                                            </li>
                                        ))}

                                        {/* Benefits Next */}
                                        {getSortedBenefits(selectedProduct).slice(0, 3).map((b, i) => {
                                             const userScore = userProfile.biometrics[b.target as keyof SkinMetrics] as number || 0;
                                             const isCritical = userScore < 50;
                                             const isMismatch = audit.adjustedScore < 60;
                                             
                                             // Only show positive benefits if not a total mismatch
                                             if (isMismatch) return null;

                                             return (
                                                 <li key={`b-${i}`} className="flex items-start gap-3 bg-white p-3 rounded-2xl border border-zinc-100 shadow-sm">
                                                     <div className={`mt-0.5 shrink-0`}>
                                                         {isCritical ? <ShieldCheck size={16} className="text-emerald-500" /> : 
                                                          <Zap size={16} className="text-teal-500" />}
                                                     </div>
                                                     
                                                     <div className="flex-1">
                                                         <div className="flex justify-between items-start mb-1">
                                                             <span className="text-xs font-bold text-zinc-900">{b.ingredient}</span>
                                                             <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-md tracking-wide ${
                                                                 isCritical ? 'bg-emerald-100 text-emerald-600' :
                                                                 'bg-teal-50 text-teal-600'
                                                             }`}>
                                                                 {isCritical ? 'Priority Fix' : 'Effective'}
                                                             </span>
                                                         </div>
                                                         <p className="text-[11px] text-zinc-600 font-medium leading-snug">
                                                             {b.description}
                                                         </p>
                                                     </div>
                                                 </li>
                                             )
                                        })}
                                    </ul>
                                </div>
                            )
                        })()}

                        <div>
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Active Ingredients</h4>
                            <div className="flex flex-wrap gap-2">
                                {selectedProduct.ingredients.slice(0, 8).map((ing, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-zinc-50 text-zinc-600 text-[10px] font-bold rounded-lg uppercase border border-zinc-100">
                                        {ing}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                onRemoveProduct(selectedProduct.id);
                                setSelectedProduct(null);
                            }}
                            className="w-full py-4 mt-4 rounded-2xl border border-rose-200 text-rose-500 font-bold text-xs uppercase hover:bg-rose-50 transition-colors"
                        >
                            Remove from Shelf
                        </button>
                    </div>
                </div>
           </div>
       )}
    </div>
  );
};

export default SmartShelf;
