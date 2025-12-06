
export interface SkinMetrics {
  overallScore: number; // 0-100 (Higher is Better)
  
  // 1. Acne & Blemishes
  acneActive: number; // Higher = Clearer (No active breakouts)
  acneScars: number; // Higher = Clearer (No scarring)
  
  // 2. Pore Health
  poreSize: number; // Higher = Smaller/Invisible Pores
  blackheads: number; // Higher = Clearer (No blackheads)
  
  // 3. Aging Signs
  wrinkleFine: number; // Higher = Smoother (No fine lines)
  wrinkleDeep: number; // Higher = Smoother (No deep creases)
  sagging: number; // Higher = Firmer/Tighter Jawline
  
  // 4. Tone & Texture
  pigmentation: number; // Higher = Even Tone (No dark spots)
  redness: number; // Higher = Calm Skin (No inflammation)
  texture: number; // Higher = Glass Skin (Smooth)
  
  // 5. Hydration & Glow
  hydration: number; // Higher = Hydrated/Plump
  oiliness: number; // Higher = Balanced (Not too oily, not too dry)
  darkCircles: number; // Higher = Bright Under-eyes
  
  analysisSummary?: string; // New: Specific location-based summary from AI
  observations?: Record<string, string>; // New: Specific per-metric observation (e.g. "Redness on cheeks")
  timestamp: number;
}

export enum SkinType {
  OILY = 'OILY',
  DRY = 'DRY',
  COMBINATION = 'COMBINATION',
  SENSITIVE = 'SENSITIVE',
  NORMAL = 'NORMAL',
  UNKNOWN = 'UNKNOWN'
}

export interface UserPreferences {
  goals: string[];
  sensitivity: 'NOT_SENSITIVE' | 'MILD' | 'VERY_SENSITIVE';
  complexity: 'SIMPLE' | 'MODERATE' | 'ADVANCED';
  sunscreenFrequency: 'DAILY' | 'SUNNY' | 'RARELY';
  lifestyle: string[];
  buyingPriority: string;
}

export interface UserProfile {
  name: string;
  age: number;
  skinType: SkinType;
  hasScannedFace: boolean;
  biometrics: SkinMetrics;
  faceImage?: string; // Base64 Data URL
  isAnonymous?: boolean; // For lazy signup detection
  preferences?: UserPreferences;
}

export interface IngredientRisk {
  ingredient: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
}

export interface Benefit {
  ingredient: string;
  target: keyof SkinMetrics;
  description: string;
  relevance: 'HIGH' | 'MAINTENANCE'; // High if user has low score in this metric
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  ingredients: string[];
  dateScanned: number;
  risks: IngredientRisk[];
  benefits: Benefit[];
  suitabilityScore: number; // 0-100
  type: 'CLEANSER' | 'TONER' | 'SERUM' | 'MOISTURIZER' | 'SPF' | 'TREATMENT' | 'UNKNOWN';
}

export interface ShelfConflict {
  productA: string;
  productB: string;
  conflictReason: string;
  severity: 'CAUTION' | 'DANGER';
}

export enum AppView {
  ONBOARDING = 'ONBOARDING',
  DASHBOARD = 'DASHBOARD',
  FACE_SCANNER = 'FACE_SCANNER',
  PRODUCT_SCANNER = 'PRODUCT_SCANNER',
  SMART_SHELF = 'SMART_SHELF',
  PROFILE_SETUP = 'PROFILE_SETUP',
}
