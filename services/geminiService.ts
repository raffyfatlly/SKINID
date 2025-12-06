import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Product, SkinMetrics, UserProfile } from "../types";

// Initialize the Google GenAI client
// SECURITY: API Key must be provided via environment variable.
// We use a safe check to prevent "process is not defined" crashes in Vite/Browser environments.
const getAI = () => {
  let apiKey = '';
  try {
      // Check for standard Node/Webpack process.env
      if (typeof process !== 'undefined' && process.env) {
          apiKey = process.env.API_KEY || '';
      }
  } catch (e) {
      // Ignore ReferenceError if process is not defined
  }
  
  // Fallback for Vite environments if process.env didn't work
  if (!apiKey && (import.meta as any).env) {
      apiKey = (import.meta as any).env.VITE_API_KEY || '';
  }

  return new GoogleGenAI({ apiKey: apiKey });
};

// --- ERROR HANDLING ---

export const isQuotaError = (error: any): boolean => {
    try {
        const raw = error as any;
        const msg = (raw?.message || raw?.error?.message || JSON.stringify(raw) || '').toLowerCase();
        return msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted') || raw?.status === 429 || raw?.error?.code === 429;
    } catch {
        return false;
    }
};

/**
 * Wrapper for AI calls.
 */
async function runWithRetry<T>(
    operation: (ai: GoogleGenAI) => Promise<T>, 
    fallbackValue?: T
): Promise<T> {
    try {
        const ai = getAI();
        return await operation(ai);
    } catch (error) {
        console.error("AI Operation Failed:", error);
        if (fallbackValue) return fallbackValue;
        throw error;
    }
}

// --- FALLBACK DATA (Offline Mode) ---

const getFallbackSkinMetrics = (): SkinMetrics => ({
    overallScore: 78,
    acneActive: 85, acneScars: 80, poreSize: 72, blackheads: 75,
    wrinkleFine: 88, wrinkleDeep: 95, sagging: 90, pigmentation: 70,
    redness: 65, texture: 75, hydration: 60, oiliness: 55, darkCircles: 68,
    analysisSummary: "Offline Analysis: Skin appears generally healthy with mild sensitivity markers.",
    observations: { redness: "Mild redness detected.", hydration: "Skin appears slightly dehydrated." },
    timestamp: Date.now(),
});

const getFallbackProduct = (userMetrics?: SkinMetrics): Product => ({
    id: "fallback-" + Date.now(),
    name: "Scanned Product (Offline)",
    brand: "Unknown Brand",
    ingredients: ["Water", "Glycerin", "Dimethicone"],
    risks: [],
    benefits: [],
    suitabilityScore: 60,
    type: 'MOISTURIZER',
    dateScanned: Date.now()
});

// --- AI FUNCTIONS ---

export const analyzeFaceSkin = async (imageBase64: string): Promise<SkinMetrics> => {
    return runWithRetry(async (ai) => {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] } },
                    { text: "Analyze this face for dermatological metrics (0-100). 100 is perfect health. Return JSON." }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        overallScore: { type: Type.NUMBER },
                        acneActive: { type: Type.NUMBER },
                        acneScars: { type: Type.NUMBER },
                        poreSize: { type: Type.NUMBER },
                        blackheads: { type: Type.NUMBER },
                        wrinkleFine: { type: Type.NUMBER },
                        wrinkleDeep: { type: Type.NUMBER },
                        sagging: { type: Type.NUMBER },
                        pigmentation: { type: Type.NUMBER },
                        redness: { type: Type.NUMBER },
                        texture: { type: Type.NUMBER },
                        hydration: { type: Type.NUMBER },
                        oiliness: { type: Type.NUMBER },
                        darkCircles: { type: Type.NUMBER },
                        analysisSummary: { type: Type.STRING },
                        observations: { 
                            type: Type.OBJECT, 
                            properties: {
                                acneActive: { type: Type.STRING },
                                redness: { type: Type.STRING },
                                hydration: { type: Type.STRING },
                                wrinkleFine: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        });
        
        const data = JSON.parse(response.text || "{}");
        if (!data.overallScore) throw new Error("Invalid AI Response");
        return { ...data, timestamp: Date.now() };
    }, getFallbackSkinMetrics());
};

export const analyzeProductImage = async (imageBase64: string, userMetrics?: SkinMetrics): Promise<Product> => {
    return runWithRetry(async (ai) => {
        let promptText = "Extract product name, brand, type (CLEANSER, TONER, SERUM, MOISTURIZER, SPF, TREATMENT), and ingredients. Analyze suitability (0-100). Return JSON.";
        
        if (userMetrics) {
            promptText = `
            Analyze this product image for a user with the following skin profile:
            - Acne Score: ${userMetrics.acneActive} (Lower is worse)
            - Hydration: ${userMetrics.hydration} (Lower is dry)
            - Sensitivity/Redness: ${userMetrics.redness} (Lower is sensitive)
            - Aging Signs: ${userMetrics.wrinkleFine} (Lower is more wrinkles)
            
            1. Extract Name, Brand, Type (CLEANSER, TONER, SERUM, MOISTURIZER, SPF, TREATMENT), and Ingredients.
            2. Calculate a 'suitabilityScore' (0-100) specifically for THIS user based on ingredients vs their profile.
            3. List specific Risks and Benefits for THIS user.
            Return JSON.
            `;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] } },
                    { text: promptText }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        type: { type: Type.STRING },
                        ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                        suitabilityScore: { type: Type.NUMBER },
                        risks: { 
                            type: Type.ARRAY, 
                            items: { 
                                type: Type.OBJECT, 
                                properties: { 
                                    ingredient: { type: Type.STRING }, 
                                    riskLevel: { type: Type.STRING }, 
                                    reason: { type: Type.STRING } 
                                } 
                            } 
                        },
                        benefits: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    ingredient: { type: Type.STRING },
                                    target: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    relevance: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });

        const data = JSON.parse(response.text || "{}");
        const rawScore = data.suitabilityScore;
        const finalScore = (typeof rawScore === 'number' && !isNaN(rawScore)) ? rawScore : 70;

        return {
            id: Math.random().toString(36).substr(2, 9),
            name: data.name || "Unknown Product",
            brand: data.brand || "Unknown Brand",
            type: (['CLEANSER','TONER','SERUM','MOISTURIZER','SPF','TREATMENT'].includes(data.type) ? data.type : 'UNKNOWN') as any,
            ingredients: data.ingredients || [],
            risks: data.risks || [],
            benefits: data.benefits || [],
            suitabilityScore: finalScore,
            dateScanned: Date.now()
        };
    }, getFallbackProduct(userMetrics));
};

export const createDermatologistSession = (
    userProfile: UserProfile, 
    shelf: Product[], 
    useRecoveryKey = false,
    previousHistory: { role: string, parts: { text: string }[] }[] = []
): Chat => {
    const shelfList = shelf.map(p => `- ${p.name} (${p.brand || 'Unknown'}) [${p.type}]`).join('\n');
    const goals = userProfile.preferences?.goals.join(', ') || 'General Health';
    const { prescribedActives, avoid } = getClinicalPrescription(userProfile);

    const context = `
    USER IDENTITY: Name: ${userProfile.name}, Age: ${userProfile.age}, Skin Type: ${userProfile.skinType}
    GOALS: ${goals}
    METRICS: Overall: ${userProfile.biometrics.overallScore}, Acne: ${userProfile.biometrics.acneActive}, Hydration: ${userProfile.biometrics.hydration}
    PROTOCOL: Prescribe: ${prescribedActives.join(', ')}. Avoid: ${avoid.join(', ')}.
    SHELF: ${shelfList || "Empty"}
    ROLE: SkinOS AI Dermatologist. Concise, professional, empathetic. Short answers.
    `;

    const history = previousHistory.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: h.parts
    }));

    return getAI().chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction: context },
        history: history
    });
};

// --- LOGIC FUNCTIONS (Synchronous Heuristics) ---

export const getClinicalPrescription = (userProfile: UserProfile) => {
    const metrics = userProfile.biometrics;
    let rankedConcerns = [
        { id: 'acneActive', score: metrics.acneActive }, { id: 'acneScars', score: metrics.acneScars },
        { id: 'pigmentation', score: metrics.pigmentation }, { id: 'redness', score: metrics.redness },
        { id: 'wrinkleFine', score: metrics.wrinkleFine }, { id: 'wrinkleDeep', score: metrics.wrinkleDeep },
        { id: 'hydration', score: metrics.hydration }, { id: 'oiliness', score: metrics.oiliness },
        { id: 'poreSize', score: metrics.poreSize }, { id: 'blackheads', score: metrics.blackheads },
        { id: 'texture', score: metrics.texture }, { id: 'sagging', score: metrics.sagging },
        { id: 'darkCircles', score: metrics.darkCircles }
    ];

    rankedConcerns = rankedConcerns.map(c => {
        if (c.id === 'acneActive') return { ...c, score: c.score - 15 }; 
        if (c.id === 'redness') return { ...c, score: c.score - 10 };   
        return c;
    });

    const goals = userProfile.preferences?.goals || [];
    if (goals.includes('Look Younger & Firm')) {
         const idx = rankedConcerns.findIndex(c => c.id === 'wrinkleFine');
         if (idx > -1) rankedConcerns[idx].score -= 5;
    }
    if (goals.includes('Clear Acne & Blemishes')) {
         const idx = rankedConcerns.findIndex(c => c.id === 'acneActive');
         if (idx > -1) rankedConcerns[idx].score -= 5;
    }

    rankedConcerns.sort((a, b) => a.score - b.score);
    const topConcerns = rankedConcerns.slice(0, 3);

    const ingredients: string[] = [];
    topConcerns.forEach(concern => {
        switch(concern.id) {
            case 'acneActive': ingredients.push('Salicylic Acid', 'Benzoyl Peroxide'); break;
            case 'acneScars': ingredients.push('Azelaic Acid', 'Niacinamide'); break;
            case 'pigmentation': ingredients.push('Vitamin C', 'Tranexamic Acid'); break;
            case 'redness': ingredients.push('Centella', 'Panthenol'); break;
            case 'wrinkleFine': ingredients.push('Retinol', 'Peptides'); break;
            case 'wrinkleDeep': ingredients.push('Retinal', 'Growth Factors'); break;
            case 'hydration': ingredients.push('Hyaluronic Acid', 'Polyglutamic Acid'); break;
            case 'oiliness': ingredients.push('Niacinamide', 'Green Tea'); break;
            case 'poreSize': ingredients.push('BHA', 'Niacinamide'); break;
            case 'blackheads': ingredients.push('Salicylic Acid', 'Clay'); break;
            case 'texture': ingredients.push('Glycolic Acid', 'Urea'); break;
            case 'sagging': ingredients.push('Copper Peptides', 'Vitamin C'); break;
            case 'darkCircles': ingredients.push('Caffeine'); break;
        }
    });

    const prescribedActives = [...new Set(ingredients)].slice(0, 4);
    const avoid: string[] = [];
    if (metrics.redness < 65) avoid.push('Fragrance', 'Alcohol Denat', 'Essential Oils');
    if (metrics.hydration < 55) avoid.push('Clay Masks', 'SLS', 'High % Acids');
    if (metrics.acneActive < 65) avoid.push('Coconut Oil', 'Shea Butter');
    if (avoid.length === 0) avoid.push('Harsh Physical Scrubs');

    return { prescribedActives, avoid, topConcerns: topConcerns.map(c => c.id) };
};

export const auditProduct = (product: Product, userProfile: UserProfile) => {
    const metrics = userProfile.biometrics;
    const warnings: { reason: string; severity: 'HIGH' | 'MEDIUM' }[] = [];
    const ing = product.ingredients.map(i => i.toLowerCase()).join(' ');
    
    // Sensitivity Check
    if (metrics.redness < 60) {
        if (ing.includes('retinol') || ing.includes('glycolic')) warnings.push({ reason: "Potentially too harsh for sensitive skin.", severity: 'HIGH' });
        if (ing.includes('fragrance') || ing.includes('parfum')) warnings.push({ reason: "Contains fragrance which may irritate.", severity: 'MEDIUM' });
    }
    // Acne Check
    if (metrics.acneActive < 60 && (ing.includes('coconut oil') || ing.includes('shea butter'))) {
        warnings.push({ reason: "Potential pore-clogging ingredients.", severity: 'MEDIUM' });
    }

    let adjustedScore = product.suitabilityScore;
    if (warnings.length > 0) adjustedScore -= (warnings.length * 15);
    
    // Benefit Boost
    const prescription = getClinicalPrescription(userProfile);
    const matches = prescription.prescribedActives.filter(a => ing.includes(a.toLowerCase()));
    if (matches.length > 0) adjustedScore += 10;

    return { warnings, adjustedScore: Math.min(100, Math.max(10, adjustedScore)) };
};

// --- ADVANCED SHELF ANALYSIS ---

export const analyzeShelfHealth = (products: Product[], userProfile: UserProfile) => {
    const analysis = {
        riskyProducts: [] as { name: string, reason: string }[],
        conflicts: [] as string[],
        missing: [] as string[],
        redundancies: [] as string[],
        synergies: [] as string[],
        balance: {
            exfoliation: 0, 
            hydration: 0,
            protection: 0,
            treatment: 0
        },
        grade: 'C' as 'S' | 'A' | 'B' | 'C' | 'D',
        criticalInsight: ""
    };

    if (products.length === 0) return { score: 0, analysis: { ...analysis, grade: 'D', criticalInsight: "Shelf is empty." } };

    let cumulativeIrritationRisk = 0;
    products.forEach(p => {
        const audit = auditProduct(p, userProfile);
        if (audit.warnings.length > 0) {
            analysis.riskyProducts.push({ name: p.name, reason: audit.warnings[0].reason });
            cumulativeIrritationRisk += 1;
        }
    });

    const allIng = products.flatMap(p => p.ingredients.map(i => i.toLowerCase()));
    const textAllIng = allIng.join(' ');
    
    const countHas = (terms: string[]) => products.filter(p => terms.some(t => p.ingredients.join(' ').toLowerCase().includes(t.toLowerCase()))).length;

    const exfoliantCount = countHas(['glycolic', 'salicylic', 'lactic', 'retinol', 'tretinoin', 'adapalene', 'mandelic', 'bha', 'aha']);
    const hydrationCount = countHas(['ceramide', 'hyaluronic', 'glycerin', 'panthenol', 'squalane', 'centella']);
    const protectionCount = countHas(['zinc oxide', 'titanium', 'vitamin c', 'niacinamide', 'tocopherol', 'spf']);
    const treatmentCount = countHas(['benzoyl', 'azelaic', 'peptide', 'retinol', 'salicylic']);

    analysis.balance.exfoliation = Math.min(100, (exfoliantCount / 2) * 100); 
    analysis.balance.hydration = Math.min(100, (hydrationCount / 3) * 100);
    analysis.balance.protection = Math.min(100, (protectionCount / 2) * 100);
    analysis.balance.treatment = Math.min(100, (treatmentCount / 2) * 100);

    if (textAllIng.includes('retinol') && (textAllIng.includes('glycolic') || textAllIng.includes('salicylic'))) {
        analysis.conflicts.push("Retinol + Exfoliating Acids (High irritation risk)");
        cumulativeIrritationRisk += 2;
    }
    if (textAllIng.includes('benzoyl') && textAllIng.includes('retinol')) {
        analysis.conflicts.push("Benzoyl Peroxide + Retinol (May deactivate each other)");
    }
    if (textAllIng.includes('copper peptide') && textAllIng.includes('ascorbic')) {
        analysis.conflicts.push("Copper Peptides + Vitamin C (Can destabilize)");
    }
    
    if (textAllIng.includes('vitamin c') && (textAllIng.includes('zinc oxide') || textAllIng.includes('titanium') || textAllIng.includes('spf'))) {
        analysis.synergies.push("Vitamin C + SPF (Boosts sun protection)");
    }
    if (textAllIng.includes('retinol') && (textAllIng.includes('ceramide') || textAllIng.includes('hyaluronic'))) {
        analysis.synergies.push("Retinol + Barrier Repair (Reduces side effects)");
    }
    if (textAllIng.includes('salicylic') && textAllIng.includes('niacinamide')) {
        analysis.synergies.push("BHA + Niacinamide (Pore minimizing duo)");
    }

    const types = products.map(p => p.type);
    if (!types.includes('CLEANSER')) analysis.missing.push("Cleanser");
    if (!types.includes('MOISTURIZER')) analysis.missing.push("Moisturizer");
    if (!types.includes('SPF')) analysis.missing.push("Sunscreen");

    let score = 100;
    score -= analysis.riskyProducts.length * 15;
    score -= analysis.conflicts.length * 20;
    score -= analysis.missing.length * 10;
    
    if (userProfile.biometrics.redness < 60 && exfoliantCount > 1) {
        score -= 20;
        analysis.criticalInsight = "Routine is too aggressive for your sensitive skin.";
    } 
    else if (userProfile.biometrics.hydration < 50 && hydrationCount < 1) {
        score -= 20;
        analysis.criticalInsight = "Severe lack of hydration for dry skin type.";
    }
    else if (analysis.missing.length === 0 && analysis.conflicts.length === 0) {
        analysis.criticalInsight = "Excellent routine balance and coverage.";
    }
    else if (analysis.conflicts.length > 0) {
        analysis.criticalInsight = "Chemical conflicts detected. Separate actives to AM/PM.";
    } else if (analysis.missing.length > 0) {
        analysis.criticalInsight = `Incomplete routine. Missing core ${analysis.missing[0].toLowerCase()}.`;
    } else {
        analysis.criticalInsight = "Solid foundation, consider targeting specific concerns.";
    }

    score = Math.max(0, Math.min(100, score));

    if (score >= 90) analysis.grade = 'S';
    else if (score >= 80) analysis.grade = 'A';
    else if (score >= 70) analysis.grade = 'B';
    else if (score >= 50) analysis.grade = 'C';
    else analysis.grade = 'D';

    return { score, analysis };
};

export const analyzeProductContext = (product: Product, shelf: Product[]) => {
    const conflicts: string[] = [];
    const typeCount = shelf.filter(p => p.type === product.type).length;
    
    const pIng = product.ingredients.map(i => i.toLowerCase()).join(' ');
    const shelfIng = shelf.flatMap(p => p.ingredients.map(i => i.toLowerCase())).join(' ');

    if (pIng.includes('retinol') && shelfIng.includes('retinol')) conflicts.push("Redundant Retinol");
    if (pIng.includes('exfoliant') && shelfIng.includes('retinol')) conflicts.push("Exfoliant + Retinol Caution");

    return { conflicts, typeCount };
};

export const getBuyingDecision = (product: Product, shelf: Product[], user: UserProfile) => {
    const audit = auditProduct(product, user);
    const context = analyzeProductContext(product, shelf);
    
    const isRisky = audit.warnings.length > 0;
    const isRedundant = context.typeCount > 0;
    const shelfConflicts = context.conflicts;
    const existingSameType = shelf.filter(p => p.type === product.type);
    
    let comparison = { result: 'EQUAL', reason: '' };
    if (existingSameType.length > 0) {
        // Simple score comparison against the best existing product of same type
        const bestExisting = existingSameType.reduce((prev, current) => (prev.suitabilityScore > current.suitabilityScore) ? prev : current);
        if (audit.adjustedScore > bestExisting.suitabilityScore + 10) {
            comparison = { result: 'BETTER', reason: 'Higher suitability score.' };
        } else if (audit.adjustedScore < bestExisting.suitabilityScore - 10) {
            comparison = { result: 'WORSE', reason: 'Lower suitability score.' };
        }
    }

    let verdict = { 
        decision: 'BUY', 
        title: 'Great Addition', 
        description: 'This product fits your needs well.', 
        color: 'emerald' 
    };

    if (isRisky) {
        verdict = { 
            decision: 'AVOID', 
            title: 'Not Recommended', 
            description: 'Contains ingredients that may conflict with your skin profile.', 
            color: 'rose' 
        };
    } else if (shelfConflicts.length > 0) {
        verdict = { 
            decision: 'CAUTION', 
            title: 'Routine Conflict', 
            description: 'Safe to use, but conflicts with other products in your routine.', 
            color: 'amber' 
        };
    } else if (isRedundant) {
        if (comparison.result === 'BETTER') {
            verdict = { 
                decision: 'SWAP', 
                title: 'Upgrade Opportunity', 
                description: `Better match than your current ${product.type.toLowerCase()}.`, 
                color: 'emerald' 
            };
        } else if (comparison.result === 'WORSE') {
            verdict = { 
                decision: 'SKIP', 
                title: 'Downgrade', 
                description: `Your current ${product.type.toLowerCase()} works better for you.`, 
                color: 'zinc' 
            };
        } else {
             verdict = { 
                decision: 'COMPARE', 
                title: 'Similar Match', 
                description: `Performs similarly to your current products.`, 
                color: 'zinc' 
            };
        }
    }

    return { verdict, audit, shelfConflicts, existingSameType, comparison };
};
