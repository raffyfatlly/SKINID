
import { GoogleGenAI, Type, Chat } from "@google/genai";
import { Product, SkinMetrics, UserProfile } from "../types";

// Initialize the Google GenAI client
// SECURITY: Supports VITE_API_KEY (Standard) and API_KEY (Legacy/Injected)
const getAI = () => {
  let apiKey = '';

  // 1. Try standard Vite env var (Best practice for Vercel)
  try {
      // @ts-ignore
      if (typeof import.meta !== 'undefined' && import.meta.env) {
          // @ts-ignore
          apiKey = import.meta.env.VITE_API_KEY || '';
      }
  } catch (e) {
      // Ignore env access errors
  }

  // 2. Try process.env injection (Fallback from vite.config.ts define or Node env)
  if (!apiKey) {
      try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env) {
            // @ts-ignore
            apiKey = process.env.API_KEY || process.env.VITE_API_KEY || '';
        }
      } catch (e) {
          // Ignore process access errors
      }
  }
  
  // 3. Last resort check for string replacement in build
  if (!apiKey && typeof process !== 'undefined' && process.env) {
      // @ts-ignore
      apiKey = process.env.API_KEY || '';
  }

  return new GoogleGenAI({ apiKey: apiKey || 'dummy_key_to_prevent_crash' });
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

const getFallbackSkinMetrics = (localMetrics?: SkinMetrics): SkinMetrics => {
    if (localMetrics) return {
        ...localMetrics,
        analysisSummary: "Offline Analysis: Based on computer vision metrics only.",
        observations: { redness: "Visible markers detected.", hydration: "Requires monitoring." }
    };
    
    return {
        overallScore: 78,
        acneActive: 85, acneScars: 80, poreSize: 72, blackheads: 75,
        wrinkleFine: 88, wrinkleDeep: 95, sagging: 90, pigmentation: 70,
        redness: 65, texture: 75, hydration: 60, oiliness: 55, darkCircles: 68,
        analysisSummary: "Offline Analysis: Skin appears generally healthy with mild sensitivity markers.",
        observations: { redness: "Mild redness detected.", hydration: "Skin appears slightly dehydrated." },
        timestamp: Date.now(),
    }
};

const getFallbackProduct = (userMetrics?: SkinMetrics): Product => ({
    id: "fallback-" + Date.now(),
    name: "Scanned Product (Offline)",
    brand: "Unknown Brand",
    ingredients: ["Water", "Glycerin", "Dimethicone"],
    risks: [],
    benefits: [],
    suitabilityScore: 60,
    estimatedPrice: 45, // RM
    type: 'MOISTURIZER',
    dateScanned: Date.now()
});

// --- AI FUNCTIONS ---

export const analyzeFaceSkin = async (imageBase64: string, localMetrics?: SkinMetrics): Promise<SkinMetrics> => {
    return runWithRetry(async (ai) => {
        // Construct a context string with the local deterministic data
        let promptContext = "Analyze this face for dermatological metrics (0-100). 100 is PERFECT health (no issues).";
        if (localMetrics) {
            promptContext += `
            
            PRELIMINARY COMPUTER VISION DATA (Use as baseline):
            - Acne/Blemishes: ${localMetrics.acneActive}
            - Redness/Sensitivity: ${localMetrics.redness}
            - Wrinkles/Aging: ${localMetrics.wrinkleFine}
            - Texture: ${localMetrics.texture}
            
            CRITICAL SCORING RULES:
            1. DISTINGUISH PEELING VS ACNE: If you see peeling skin, flakes, or raw skin (dermatitis) but NO distinct pustules/cysts, your "Acne Score" must be HIGH (Good condition, e.g., 85+). Do NOT mark peeling as acne.
            2. TEXTURE PENALTY: If you see peeling or roughness, the "Texture Score" must be LOW (Bad condition, e.g., < 50).
            3. BARRIER HEALTH: If you see significant redness or peeling, the "Overall Score" MUST be penalized (e.g., < 65). Do not give a high Overall Score to damaged skin even if there are no wrinkles.
            4. CONSISTENCY: Use the provided CV data as an anchor, but if the visual evidence clearly contradicts it (e.g. CV says Acne is 30 but it's actually peeling), OVERRIDE the CV score heavily.
            
            OUTPUT:
            - Provide a professional clinical summary explaining the PRIMARY issue (e.g. "Barrier compromise with peeling").
            - Ensure numeric scores strictly match your visual diagnosis.
            `;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] } },
                    { text: promptContext }
                ]
            },
            config: {
                temperature: 0, // CRITICAL: Force deterministic output
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
        
        const aiData = JSON.parse(response.text || "{}");
        if (!aiData.overallScore) throw new Error("Invalid AI Response");

        const blend = (local: number, ai: number) => Math.round((local * 0.20) + (ai * 0.80));
        
        const finalMetrics: SkinMetrics = localMetrics ? {
            ...aiData,
            overallScore: blend(localMetrics.overallScore, aiData.overallScore),
            acneActive: blend(localMetrics.acneActive, aiData.acneActive),
            acneScars: blend(localMetrics.acneScars, aiData.acneScars),
            poreSize: blend(localMetrics.poreSize, aiData.poreSize),
            blackheads: blend(localMetrics.blackheads, aiData.blackheads),
            wrinkleFine: blend(localMetrics.wrinkleFine, aiData.wrinkleFine),
            wrinkleDeep: blend(localMetrics.wrinkleDeep, aiData.wrinkleDeep),
            sagging: blend(localMetrics.sagging, aiData.sagging),
            pigmentation: blend(localMetrics.pigmentation, aiData.pigmentation),
            redness: blend(localMetrics.redness, aiData.redness),
            texture: blend(localMetrics.texture, aiData.texture),
            hydration: blend(localMetrics.hydration, aiData.hydration),
            oiliness: blend(localMetrics.oiliness, aiData.oiliness),
            darkCircles: blend(localMetrics.darkCircles, aiData.darkCircles),
            skinAge: aiData.skinAge || localMetrics.skinAge,
            timestamp: Date.now()
        } : { ...aiData, timestamp: Date.now() };

        return finalMetrics;

    }, getFallbackSkinMetrics(localMetrics));
};

export const analyzeProductImage = async (imageBase64: string, userMetrics?: SkinMetrics): Promise<Product> => {
    return runWithRetry(async (ai) => {
        let promptText = "Extract product name, brand, type (CLEANSER, TONER, SERUM, MOISTURIZER, SPF, TREATMENT, FOUNDATION, CONCEALER, POWDER, PRIMER, SETTING_SPRAY, BLUSH, BRONZER), ingredients, and Estimated Retail Price in MYR (Malaysian Ringgit). Analyze suitability (0-100). Return JSON.";
        
        if (userMetrics) {
            promptText = `
            Analyze this product image for a user with the following skin profile:
            - Hydration: ${userMetrics.hydration} (0-40 is DRY, 40-60 is NORMAL, 60+ is HYDRATED)
            - Oiliness: ${userMetrics.oiliness} (0-40 is OILY, 40-60 is NORMAL, 60+ is DRY)
            - Acne Score: ${userMetrics.acneActive} (Lower is worse)
            - Sensitivity/Redness: ${userMetrics.redness} (Lower is sensitive)
            
            STRICT SCORING RUBRIC (Consistency is Key):
            1. TYPE CLASSIFICATION: Infer the type (CLEANSER, ETC) based on keywords. "Face Wash" = CLEANSER. "Lotion" = MOISTURIZER. "Sunblock" = SPF.
            2. DRY SKIN CONTRADICTION: If User Hydration < 45 AND product is "Matte", "Oil-Free", "Clay", "Foaming", or contains Alcohol Denat/Salicylic Acid -> Suitability Score MUST be < 50. Even if it helps acne, it is BAD for dry skin.
            3. SENSITIVE SKIN CONTRADICTION: If User Redness < 50 AND product contains Fragrance, Essential Oils, or High % Acids -> Suitability Score MUST be < 55.
            4. PERFECT MATCH: High score (>85) requires the product to specifically target the user's Weakest Metric without harming others.
            
            TASKS:
            1. Extract Name, Brand, Type.
            2. Estimate "estimatedPrice" in MYR (Malaysian Ringgit) based on retailers like Watsons, Sephora Malaysia, or Guardian.
            3. Calculate 'suitabilityScore' (0-100) using the RUBRIC above.
            4. List Risks and Benefits for THIS user.
            
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
                temperature: 0,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        type: { type: Type.STRING },
                        ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                        suitabilityScore: { type: Type.NUMBER },
                        estimatedPrice: { type: Type.NUMBER },
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
        
        const validTypes = ['CLEANSER','TONER','SERUM','MOISTURIZER','SPF','TREATMENT','FOUNDATION','CONCEALER','POWDER','PRIMER','SETTING_SPRAY','BLUSH','BRONZER'];
        // Strict type sanitation
        let detectedType = (data.type || 'UNKNOWN').toUpperCase();
        if (!validTypes.includes(detectedType)) {
             // Heuristic fix for "Face Wash" -> "CLEANSER" etc.
             if (detectedType.includes('WASH') || detectedType.includes('SOAP') || detectedType.includes('CLEANS') || detectedType.includes('BALM')) detectedType = 'CLEANSER';
             else if (detectedType.includes('CREAM') || detectedType.includes('LOTION') || detectedType.includes('MOISTUR') || detectedType.includes('HYDRAT')) detectedType = 'MOISTURIZER';
             else if (detectedType.includes('SCREEN') || detectedType.includes('BLOCK') || detectedType.includes('SUN') || detectedType.includes('SPF')) detectedType = 'SPF';
             else detectedType = 'UNKNOWN';
        }

        return {
            id: Math.random().toString(36).substr(2, 9),
            name: data.name || "Unknown Product",
            brand: data.brand || "Unknown Brand",
            type: (validTypes.includes(detectedType) ? detectedType : 'UNKNOWN') as any,
            ingredients: data.ingredients || [],
            risks: data.risks || [],
            benefits: data.benefits || [],
            suitabilityScore: finalScore,
            estimatedPrice: data.estimatedPrice || 45,
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
    
    TRENDING TREATMENTS (2025 Context):
    - Polynucleotides (Salmon sperm DNA) for under-eye brightening.
    - Exosomes for post-procedure healing.
    - Sofwave (Ultrasound) for lifting without downtime.
    - Moxie Laser for "pre-juvenation".
    - Bio-remodeling injectables (Profhilo).
    
    ROLE: SkinOS AI Dermatologist. Concise, professional, empathetic. Short answers. 
    If asking about clinical treatments, mention trending options if relevant to their biometrics.
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
    const isMakeup = ['FOUNDATION', 'CONCEALER', 'POWDER', 'PRIMER', 'BLUSH', 'BRONZER'].includes(product.type);
    const pName = product.name.toLowerCase();

    // 1. Dry Skin Logic (The logic user specifically asked for)
    if (metrics.hydration < 50) {
        if (ing.includes('alcohol denat')) {
            warnings.push({ reason: "High alcohol content will worsen dryness.", severity: 'HIGH' });
        }
        if (ing.includes('clay') || pName.includes('clay') || pName.includes('matte') || pName.includes('oil-free')) {
            // Contextual check: Is it actually an oil-free moisturizer? 
            if (product.type === 'MOISTURIZER' && (pName.includes('gel') || pName.includes('matte'))) {
                warnings.push({ reason: "Gel/Matte formulas are often too light for your dry skin.", severity: 'MEDIUM' });
            } else if (pName.includes('clay')) {
                warnings.push({ reason: "Clay products deplete moisture from dry skin.", severity: 'HIGH' });
            }
        }
        if (product.type === 'CLEANSER' && (pName.includes('foam') || ing.includes('sodium lauryl sulfate'))) {
             warnings.push({ reason: "Foaming cleansers can strip dry skin barriers.", severity: 'MEDIUM' });
        }
    }

    // 2. Sensitivity Check
    if (metrics.redness < 60) {
        if (ing.includes('retinol') || ing.includes('glycolic')) warnings.push({ reason: "Potentially too harsh for sensitive skin.", severity: 'HIGH' });
        if (ing.includes('fragrance') || ing.includes('parfum')) warnings.push({ reason: "Contains fragrance which may irritate.", severity: 'MEDIUM' });
        if (isMakeup && (ing.includes('bismuth oxychloride') || ing.includes('alcohol denat'))) {
             warnings.push({ reason: "Contains common makeup irritants for sensitive skin.", severity: 'MEDIUM' });
        }
    }

    // 3. Acne Check
    if (metrics.acneActive < 60) {
        if (ing.includes('coconut oil') || ing.includes('shea butter') || ing.includes('isopropyl myristate') || ing.includes('ethylhexyl palmitate')) {
             warnings.push({ reason: "Potential pore-clogging ingredients detected.", severity: 'MEDIUM' });
        }
        if (isMakeup && (ing.includes('algae extract') || ing.includes('acetylated lanolin'))) {
             warnings.push({ reason: "High comedogenic risk in this cosmetic.", severity: 'HIGH' });
        }
    }

    let adjustedScore = product.suitabilityScore;
    
    // HEAVY DETERMINISTIC PENALTY
    if (warnings.length > 0) {
        // Force score down significantly if warnings exist
        const highRisks = warnings.filter(w => w.severity === 'HIGH').length;
        const mediumRisks = warnings.filter(w => w.severity === 'MEDIUM').length;
        
        const penalty = (highRisks * 30) + (mediumRisks * 15);
        adjustedScore = Math.min(adjustedScore, 100 - penalty);
        
        // Cap max score for risky products
        if (highRisks > 0) adjustedScore = Math.min(adjustedScore, 45);
        else if (mediumRisks > 0) adjustedScore = Math.min(adjustedScore, 65);
    }
    
    // NEW: Analysis Reason Logic (Explains low scores even without warnings)
    let analysisReason = "";
    
    // Find the single lowest metric to use as the primary "reason"
    const displayNames: Record<string, string> = {
        'acneActive': 'Active Acne',
        'hydration': 'Hydration',
        'redness': 'Sensitivity',
        'wrinkleFine': 'Aging Signs',
        'pigmentation': 'Pigmentation',
        'oiliness': 'Oil Control',
        'poreSize': 'Pore Care'
    };

    const lowestMetricEntry = Object.entries(userProfile.biometrics)
        .filter(([k, v]) => typeof v === 'number' && displayNames[k])
        .sort((a, b) => (a[1] as number) - (b[1] as number))[0];

    const metricKey = lowestMetricEntry ? lowestMetricEntry[0] : 'overallScore';
    const metricName = displayNames[metricKey] || 'Skin Health';
    const metricScore = lowestMetricEntry ? lowestMetricEntry[1] : 70;

    // INGREDIENT CHECKER: Does the product actually contain help for the lowest metric?
    const helpfulIngredientsMap: Record<string, string[]> = {
        'hydration': ['glycerin', 'hyaluronic', 'ceramide', 'panthenol', 'squalane', 'aloe', 'urea', 'lactic'],
        'acneActive': ['salicylic', 'benzoyl', 'tea tree', 'niacinamide', 'sulfur', 'clay', 'willow bark'],
        'redness': ['centella', 'panthenol', 'aloe', 'chamomile', 'green tea', 'allantoin', 'bisabolol', 'oat'],
        'wrinkleFine': ['retinol', 'peptide', 'vitamin c', 'glycolic', 'hyaluronic', 'bakuchiol'],
        'oiliness': ['niacinamide', 'clay', 'salicylic', 'zinc', 'dimethicone', 'charcoal'],
        'pigmentation': ['vitamin c', 'niacinamide', 'tranexamic', 'azelaic', 'licorice', 'alpha arbutin', 'kojic']
    };

    const targetIngredients = helpfulIngredientsMap[metricKey] || [];
    const matchedIngredients = product.ingredients.filter(ing => 
        targetIngredients.some(target => ing.toLowerCase().includes(target))
    );
    const hasTargetIngredient = matchedIngredients.length > 0;

    // Benefit Boost (Only if safe)
    if (warnings.length === 0) {
        const prescription = getClinicalPrescription(userProfile);
        const matches = prescription.prescribedActives.filter(a => ing.includes(a.toLowerCase()));
        
        // Boost if matches prescription OR if it has supportive ingredients for lowest metric
        if (matches.length > 0) adjustedScore += 10;
        else if (hasTargetIngredient) adjustedScore += 15; // Supportive boost (e.g. Glycerin for Dry Skin)
    }

    if (warnings.length > 0) {
        analysisReason = warnings[0].reason;
    } else if (adjustedScore < 60) {
        if (hasTargetIngredient) {
            const ingredientName = matchedIngredients[0].charAt(0).toUpperCase() + matchedIngredients[0].slice(1);
            // Educational override for wash-off products
            if (product.type === 'CLEANSER' && ['hydration', 'wrinkleFine', 'pigmentation', 'wrinkleDeep', 'sagging'].includes(metricKey)) {
                analysisReason = `Contains ${ingredientName}, but cleansers are wash-off. You need a leave-on product to effectively treat ${metricName}.`;
            } else {
                analysisReason = `Contains ${ingredientName}, but the overall concentration or formulation appears weak for your ${metricName} needs.`;
            }
        } else {
            // Safe but useless
            analysisReason = `Your priority is ${metricName} (Score ${metricScore}), but this formula lacks specific actives to improve it.`;
        }
    } else if (adjustedScore < 75) {
        // Safe but average
        if (hasTargetIngredient) {
            analysisReason = `Contains ${matchedIngredients[0]}, helpful for your ${metricName}. Good for maintenance.`;
        } else {
            analysisReason = `Suitable for maintenance, but not potent enough to significantly treat your ${metricName}.`;
        }
    } else {
        analysisReason = "Formula composition aligns well with your skin profile.";
    }

    return { warnings, adjustedScore: Math.min(100, Math.max(10, adjustedScore)), analysisReason };
};

// --- ADVANCED SHELF ANALYSIS ---

export const analyzeShelfHealth = (products: Product[], userProfile: UserProfile) => {
    const analysis = {
        riskyProducts: [] as { name: string, reason: string }[],
        conflicts: [] as string[],
        missing: [] as string[],
        upgrades: [] as string[], // New category for existing but low-quality items
        redundancies: [] as string[],
        synergies: [] as string[],
        balance: {
            exfoliation: 0, 
            hydration: 0,
            protection: 0,
            treatment: 0
        },
        grade: 'C' as 'S' | 'A' | 'B' | 'C' | 'D',
        criticalInsight: "",
        hasMakeup: false
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
    
    // Check if user has makeup
    const makeupItems = products.filter(p => ['FOUNDATION', 'CONCEALER', 'POWDER', 'PRIMER', 'BLUSH', 'BRONZER'].includes(p.type));
    const cleanserCount = products.filter(p => p.type === 'CLEANSER').length;
    
    if (makeupItems.length > 0) {
        analysis.hasMakeup = true;
        // Check for double cleanse necessity
        if (cleanserCount < 2 && !products.some(p => p.name.toLowerCase().includes('oil') || p.name.toLowerCase().includes('balm') || p.name.toLowerCase().includes('micellar'))) {
            analysis.missing.push("Double Cleanse (Oil/Balm) to remove makeup");
        }
        
        // Check for SPF reliance warning
        const makeupWithSPF = makeupItems.some(p => p.ingredients.some(i => i.toLowerCase().includes('titanium') || i.toLowerCase().includes('zinc') || i.toLowerCase().includes('octinoxate')));
        const hasDedicatedSPF = products.some(p => p.type === 'SPF');
        
        if (makeupWithSPF && !hasDedicatedSPF) {
            analysis.riskyProducts.push({ name: "Makeup SPF Only", reason: "SPF in makeup is insufficient for full protection." });
        }
    }

    // CHECK ESSENTIALS: Missing vs Upgrade vs Redundant
    const checkStep = (type: string, name: string) => {
        const items = products.filter(p => p.type === type);
        
        if (items.length === 0) {
            analysis.missing.push(name);
        } else {
            // Check quality of existing
            // CHANGE: Lowered threshold to 50 to avoid nagging about decent products
            // CHANGE: Updated threshold to 60 based on feedback to be more proactive with "Change"
            const lowQuality = items.filter(p => auditProduct(p, userProfile).adjustedScore < 60);
            if (lowQuality.length === items.length) {
                // All items of this type are low score
                analysis.upgrades.push(name);
            }

            // Check redundancies
            if (items.length > 1) {
                if (type === 'CLEANSER') {
                    // Double Cleanse Logic
                    const oils = items.filter(p => {
                         const n = p.name.toLowerCase();
                         return n.includes('oil') || n.includes('balm') || n.includes('micellar') || n.includes('melting') || p.ingredients.some(i => i.toLowerCase().includes('oil'));
                    });
                    const waters = items.filter(p => !oils.includes(p));

                    // Valid Double Cleanse: 1 Oil-based + 1 Water-based (Total 2)
                    const isDoubleCleanse = (oils.length === 1 && waters.length === 1 && items.length === 2);
                    
                    if (!isDoubleCleanse) {
                         if (items.length > 2) analysis.redundancies.push(`${items.length} Cleansers (Keep 1 or 2 for Double Cleanse)`);
                         else if (oils.length > 1) analysis.redundancies.push("Multiple Oil Cleansers");
                         else if (waters.length > 1) analysis.redundancies.push("Multiple Water Cleansers");
                         else analysis.redundancies.push("Duplicate Cleanser");
                    }
                } else if (type === 'MOISTURIZER' && items.length > 1) {
                    analysis.redundancies.push("Multiple Moisturizers");
                } else if (type === 'SPF' && items.length > 2) {
                     if (items.length > 2) analysis.redundancies.push("Multiple Sunscreens");
                }
            }
        }
    };

    checkStep('CLEANSER', 'Cleanser');
    checkStep('MOISTURIZER', 'Moisturizer');
    checkStep('SPF', 'Sunscreen');

    let score = 100;
    score -= analysis.riskyProducts.length * 15;
    score -= analysis.conflicts.length * 20;
    score -= analysis.missing.length * 10;
    score -= analysis.upgrades.length * 5; // Penalty for low quality essentials
    
    if (userProfile.biometrics.redness < 60 && exfoliantCount > 1) {
        score -= 20;
        analysis.criticalInsight = "Routine is too aggressive for your sensitive skin.";
    } 
    else if (userProfile.biometrics.hydration < 50 && hydrationCount < 1) {
        score -= 20;
        analysis.criticalInsight = "Severe lack of hydration for dry skin type.";
    }
    else if (analysis.missing.length === 0 && analysis.conflicts.length === 0 && analysis.upgrades.length === 0) {
        analysis.criticalInsight = "Excellent routine balance and coverage.";
    }
    else if (analysis.conflicts.length > 0) {
        analysis.criticalInsight = "Chemical conflicts detected. Separate actives to AM/PM.";
    } else if (analysis.missing.length > 0) {
        analysis.criticalInsight = `Incomplete routine. Missing ${analysis.missing[0]}.`;
    } else if (analysis.upgrades.length > 0) {
        analysis.criticalInsight = `Routine complete, but your ${analysis.upgrades[0].toLowerCase()} is low quality.`;
    } else {
        analysis.criticalInsight = "Solid foundation, consider targeting specific concerns.";
    }

    score = Math.max(0, Math.min(100, score));

    // Cap score if essential items are missing (cannot be A or S)
    if (analysis.missing.length > 0 && score > 79) {
        score = 79;
    }

    if (score >= 95 && analysis.missing.length === 0 && analysis.riskyProducts.length === 0 && analysis.upgrades.length === 0) analysis.grade = 'S';
    else if (score >= 80 && analysis.missing.length === 0) analysis.grade = 'A';
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
    
    // Primer/Foundation compatibility
    if (product.type === 'FOUNDATION') {
        const primers = shelf.filter(p => p.type === 'PRIMER');
        if (primers.length > 0) {
             const primerSilicone = primers.some(p => p.ingredients.join(' ').toLowerCase().includes('dimethicone'));
             const foundationWater = !pIng.includes('dimethicone') && pIng.includes('water');
             if (primerSilicone && foundationWater) conflicts.push("Silicone Primer + Water Foundation (May pill)");
        }
    }

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

    // STRICT VERDICT LOGIC
    let verdict = { 
        decision: 'BUY', 
        title: 'Great Match', 
        description: 'Excellent fit for your skin metrics.', 
        color: 'emerald' 
    };

    if (audit.adjustedScore < 50) {
        verdict = { 
            decision: 'AVOID', 
            title: 'Mismatch', 
            description: audit.analysisReason, 
            color: 'rose' 
        };
    } else if (audit.adjustedScore < 70) {
         verdict = { 
            decision: 'SKIP', 
            title: 'Low Efficiency', 
            description: audit.analysisReason, 
            color: 'zinc' 
        };
    } else if (isRisky) {
        verdict = { 
            decision: 'AVOID', 
            title: 'Ingredient Risk', 
            description: 'Contains ingredients that may irritate your skin.', 
            color: 'rose' 
        };
    } else if (shelfConflicts.length > 0) {
        verdict = { 
            decision: 'CAUTION', 
            title: 'Routine Conflict', 
            description: 'Conflicts with items already on your shelf.', 
            color: 'amber' 
        };
    } else if (isRedundant) {
        if (comparison.result === 'BETTER') {
            verdict = { 
                decision: 'SWAP', 
                title: 'Upgrade', 
                description: `Better match than your current ${product.type.toLowerCase()}.`, 
                color: 'emerald' 
            };
        } else if (comparison.result === 'WORSE') {
            verdict = { 
                decision: 'SKIP', 
                title: 'Downgrade', 
                description: `Your current ${product.type.toLowerCase()} works better.`, 
                color: 'zinc' 
            };
        } else {
             verdict = { 
                decision: 'COMPARE', 
                title: 'Duplicate', 
                description: `Performs similarly to your current products.`, 
                color: 'zinc' 
            };
        }
    }

    return { verdict, audit, shelfConflicts, existingSameType, comparison };
};

// --- CLINICAL TREATMENTS ---

export interface ClinicalTreatment {
    name: string;
    type: string;
    benefit: string;
    downtime: string;
    matchScore: number;
}

export const getClinicalTreatmentSuggestions = (userProfile: UserProfile): ClinicalTreatment[] => {
    const { biometrics } = userProfile;
    const treatments: ClinicalTreatment[] = [];

    // CRITICAL PRIORITY: Severe Dehydration / Barrier Damage
    if (biometrics.hydration < 55 || biometrics.redness < 55) {
        treatments.push({
            name: "Skin Barrier Repair Facial",
            type: "RECOVERY",
            benefit: "Intensive lipid restoration and hydration infusion.",
            downtime: "None",
            matchScore: 99 // Top priority
        });
        treatments.push({
            name: "Mesotherapy (Hyaluronic)",
            type: "INJECTABLE",
            benefit: "Direct delivery of hydration to deep skin layers.",
            downtime: "Low (1-2 days)",
            matchScore: 98
        });
    }

    // HIGH PRIORITY: Active Acne (Score < 60)
    if (biometrics.acneActive < 60) {
        const severity = 60 - biometrics.acneActive;
        treatments.push({
            name: "Chemical Peel (Salicylic)",
            type: "TREATMENT",
            benefit: "Deep pore exfoliation to clear active congestion.",
            downtime: "Moderate (Peeling)",
            matchScore: 95 + (severity * 0.1) // 95-97 range
        });
        treatments.push({
            name: "Blue LED Therapy",
            type: "MAINTENANCE",
            benefit: "Non-invasive bacteria elimination.",
            downtime: "None",
            matchScore: 90
        });
    }

    // MODERATE PRIORITY: Pigmentation / Scarring (Score < 70)
    if (biometrics.pigmentation < 70 || biometrics.acneScars < 70) {
        treatments.push({
            name: "IPL Photofacial",
            type: "CORRECTION",
            benefit: "Targets sun damage and vascular redness.",
            downtime: "Low (Redness)",
            matchScore: 92
        });
        treatments.push({
            name: "Microneedling",
            type: "RESTRUCTURING",
            benefit: "Induces collagen to smooth texture and scars.",
            downtime: "Moderate (3-4 days)",
            matchScore: 88
        });
    }

    // MODERATE PRIORITY: Aging / Sagging (Score < 70)
    if (biometrics.sagging < 70 || biometrics.wrinkleDeep < 70) {
        treatments.push({
            name: "Radiofrequency Lifting",
            type: "LIFTING",
            benefit: "Tightens loose skin via deep heat stimulation.",
            downtime: "None",
            matchScore: 94
        });
         treatments.push({
            name: "Bio-Remodeling (Profhilo)",
            type: "INJECTABLE",
            benefit: "Stimulates elastin for overall firmness.",
            downtime: "Low (1 day)",
            matchScore: 91
        });
    }

    // ENHANCEMENT: General Texture / Glow (Fallback or Goal based)
    // Only suggest if not dealing with severe acne/barrier issues
    if (treatments.length < 2 && (biometrics.texture < 80 || biometrics.hydration >= 55)) {
        treatments.push({
            name: "HydraFacial",
            type: "FACIAL",
            benefit: "Deep clean and glow enhancement.",
            downtime: "None",
            matchScore: 85
        });
    }
    
    // ENHANCEMENT: Goal-specific
    const goals = userProfile.preferences?.goals || [];
    if (goals.includes('Look Younger & Firm') && treatments.length < 2) {
         treatments.push({
            name: "Laser Genesis",
            type: "ENHANCEMENT",
            benefit: "Collagen building for fine line prevention.",
            downtime: "None",
            matchScore: 80
        });
    }

    // Sort by match score and return top 2
    return treatments.sort((a,b) => b.matchScore - a.matchScore).slice(0, 2);
};
