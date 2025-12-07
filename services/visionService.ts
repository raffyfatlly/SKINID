
import { SkinMetrics } from '../types';

/**
 * Checks video frame quality before analysis.
 */
export const validateFrame = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lastFacePos?: { cx: number, cy: number }
): { isGood: boolean; message: string; facePos?: { cx: number, cy: number }; instruction?: string; status: 'OK' | 'WARNING' | 'ERROR' } => {
  const { cx, cy, faceWidth, faceHeight } = detectFaceBounds(ctx, width, height);
  
  let status: 'OK' | 'WARNING' | 'ERROR' = 'OK';
  let isGood = true;
  let message = "Perfect";
  let instruction = "Hold steady...";

  if (faceWidth < width * 0.15) {
       return { isGood: false, message: "No Face", instruction: "Position face in circle", status: 'ERROR' };
  }

  if (faceWidth < width * 0.25) {
      status = 'WARNING';
      message = "Move Closer";
      instruction = "Move Closer";
  } else if (faceWidth > width * 0.85) {
      status = 'WARNING';
      message = "Too Close";
      instruction = "Back up slightly";
  }

  const p = ctx.getImageData(Math.floor(cx), Math.floor(cy), 1, 1).data;
  const luma = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];

  if (luma < 40) {
      status = 'WARNING';
      message = "Low Light";
      instruction = "Face light source";
  } else if (luma > 230) {
      status = 'WARNING';
      message = "Too Bright";
      instruction = "Reduce glare";
  }

  if (lastFacePos) {
      const dist = Math.sqrt(Math.pow(cx - lastFacePos.cx, 2) + Math.pow(cy - lastFacePos.cy, 2));
      if (dist > width * 0.1) { 
          status = 'WARNING';
          message = "Hold Still";
          instruction = "Hold Still";
      }
  }

  return { isGood: true, message, facePos: { cx, cy }, instruction, status };
};

const normalizeScore = (raw: number): number => {
    return Math.floor(Math.max(18, Math.min(98, raw)));
};

// --- COLOR SPACE CONVERSIONS ---

const rgbToLab = (r: number, g: number, b: number) => {
    let r1 = r / 255, g1 = g / 255, b1 = b / 255;
    r1 = (r1 > 0.04045) ? Math.pow((r1 + 0.055) / 1.055, 2.4) : r1 / 12.92;
    g1 = (g1 > 0.04045) ? Math.pow((g1 + 0.055) / 1.055, 2.4) : g1 / 12.92;
    b1 = (b1 > 0.04045) ? Math.pow((b1 + 0.055) / 1.055, 2.4) : b1 / 12.92;

    const x = (r1 * 0.4124 + g1 * 0.3576 + b1 * 0.1805) / 0.95047;
    const y = (r1 * 0.2126 + g1 * 0.7152 + b1 * 0.0722) / 1.00000;
    const z = (r1 * 0.0193 + g1 * 0.1192 + b1 * 0.9505) / 1.08883;

    const fx = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
    const fy = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
    const fz = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;

    return {
        L: (116 * fy) - 16,
        a: 500 * (fx - fy),
        b: 200 * (fy - fz)
    };
};

const labToRgb = (L: number, a: number, b: number) => {
    let y = (L + 16) / 116;
    let x = a / 500 + y;
    let z = y - b / 200;

    const x3 = x * x * x;
    const y3 = y * y * y;
    const z3 = z * z * z;

    x = (x3 > 0.008856) ? x3 : (x - 16/116) / 7.787;
    y = (y3 > 0.008856) ? y3 : (y - 16/116) / 7.787;
    z = (z3 > 0.008856) ? z3 : (z - 16/116) / 7.787;

    x = x * 0.95047;
    y = y * 1.00000;
    z = z * 1.08883;

    let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    let bl = x * 0.0557 + y * -0.2040 + z * 1.0570;

    r = (r > 0.0031308) ? (1.055 * Math.pow(r, 1/2.4) - 0.055) : 12.92 * r;
    g = (g > 0.0031308) ? (1.055 * Math.pow(g, 1/2.4) - 0.055) : 12.92 * g;
    bl = (bl > 0.0031308) ? (1.055 * Math.pow(bl, 1/2.4) - 0.055) : 12.92 * bl;

    return {
        r: Math.max(0, Math.min(255, Math.round(r * 255))),
        g: Math.max(0, Math.min(255, Math.round(g * 255))),
        b: Math.max(0, Math.min(255, Math.round(bl * 255)))
    };
};

// --- IMAGE ENHANCEMENT ---

/**
 * APPLIES SMART DERMATOLOGICAL ENHANCEMENT:
 * 1. Converts to Lab Space.
 * 2. Boosts 'a' channel (Red-Green) for inflammation detection WITHOUT affecting 'b' (Skin Tone).
 * 3. Enhances local contrast in 'L' channel for texture/spot detection.
 * 4. Normalizes brightness to ensure consistency across environments.
 */
export const applyMedicalProcessing = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const output = ctx.createImageData(width, height);
    const dst = output.data;

    // 1. First Pass: Calculate Average Luminance for Normalization
    let totalL = 0;
    const sampleRate = 10;
    let samples = 0;
    for (let i = 0; i < data.length; i += 4 * sampleRate) {
        // Fast approx luminance
        totalL += (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
        samples++;
    }
    const avgL = samples > 0 ? totalL / samples : 127;
    const targetL = 135; // Target slightly bright/clean look
    const exposureFactor = targetL / (avgL || 1); 

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            
            // Apply Exposure Correction
            let r = data[idx] * exposureFactor;
            let g = data[idx+1] * exposureFactor;
            let b = data[idx+2] * exposureFactor;

            // Convert to Lab for selective boosting
            const lab = rgbToLab(r, g, b);

            // 2. Selective Red Boost (Inflammation)
            // We boost 'a' channel. 
            // 'a' positive = red/magenta, negative = green.
            // We want to separate redness from skin tone.
            lab.a = lab.a * 1.35; // 35% boost to redness sensitivity

            // 3. Local Contrast / Texture Enhancement (Simulated Unsharp Mask)
            // S-curve contrast on L channel
            const normalizedL = lab.L / 100;
            const contrastL = normalizedL < 0.5 
                ? 2 * normalizedL * normalizedL 
                : -1 + (4 - 2 * normalizedL) * normalizedL;
            lab.L = (normalizedL * 0.7 + contrastL * 0.3) * 100; // Blend 30% contrast

            // 4. Convert back to RGB
            const finalRgb = labToRgb(lab.L, lab.a, lab.b);

            dst[idx] = finalRgb.r;
            dst[idx+1] = finalRgb.g;
            dst[idx+2] = finalRgb.b;
            dst[idx+3] = 255;
        }
    }

    ctx.putImageData(output, 0, 0);
};

export const applyClinicalOverlays = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
) => {
    // 1. Detection
    const { cx, cy, faceWidth, faceHeight } = detectFaceBounds(ctx, width, height);
    if (faceWidth === 0) return;

    // Apply the smart enhancement filter FIRST
    // This physically alters the canvas image to show the effect to the user/AI
    applyMedicalProcessing(ctx, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Recalculate stats on the ENHANCED image for overlay logic
    const stats = getSkinStats(imageData);

    ctx.lineWidth = 1; 
    const scanStep = 6; 
    
    for (let y = Math.floor(cy - faceHeight * 0.45); y < cy + faceHeight * 0.5; y += scanStep) {
        for (let x = Math.floor(cx - faceWidth * 0.45); x < cx + faceWidth * 0.45; x += scanStep) {
            
            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const dx_ = (x - cx) / (faceWidth * 0.5);
            const dy_ = (y - cy) / (faceHeight * 0.55);
            if (dx_*dx_ + dy_*dy_ > 1) continue;

            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];

            if (!isSkinPixel(r,g,b)) continue;

            const { L, a } = rgbToLab(r,g,b);

            // Inflammation / Acne (Red Crosshair)
            // Use relative threshold based on face average 'a'
            if (a > stats.meanA + 15) {
                const size = 3;
                ctx.strokeStyle = 'rgba(255, 40, 40, 0.6)'; // Red
                ctx.beginPath();
                ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
                ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
                ctx.stroke();
            }
            // Pores / Dark Spots (Cyan Dots)
            // Use relative threshold based on face average 'L'
            else if (L < stats.meanL - 25) {
                 ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'; 
                 ctx.fillRect(x, y, 1.5, 1.5);
            }
        }
    }
};

const isSkinPixel = (r: number, g: number, b: number): boolean => {
    return (r > 40 && g > 20 && b > 10 && r > g && r > b);
};

const detectFaceBounds = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let sumX = 0, sumY = 0, count = 0;
    const step = 20; 
    
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const i = (y * width + x) * 4;
            if (isSkinPixel(data[i], data[i+1], data[i+2])) {
                sumX += x; sumY += y; count++;
            }
        }
    }

    if (count < 50) return { cx: width/2, cy: height/2, faceWidth: 0, faceHeight: 0 }; 

    const cx = sumX / count;
    const cy = sumY / count;
    const faceWidth = Math.sqrt(count * step * step) * 1.5; 
    const faceHeight = faceWidth * 1.35; 

    return { cx, cy, faceWidth, faceHeight };
};

const getNormalizedROI = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    // Safety crop
    if (x < 0) x = 0; if (y < 0) y = 0;
    w = Math.min(w, ctx.canvas.width - x);
    h = Math.min(h, ctx.canvas.height - y);
    
    // Get Raw Data
    const imgData = ctx.getImageData(x, y, w, h);
    
    // NORMALIZE ROI LIGHTING
    // This ensures that 'Metric Calculation' is done on a balanced image
    let sumL = 0;
    for(let i=0; i<imgData.data.length; i+=4) {
        sumL += (0.299*imgData.data[i] + 0.587*imgData.data[i+1] + 0.114*imgData.data[i+2]);
    }
    const mean = sumL / (imgData.data.length/4);
    const target = 135;
    const factor = target / (mean || 1);

    for(let i=0; i<imgData.data.length; i+=4) {
        imgData.data[i] = Math.min(255, imgData.data[i] * factor);
        imgData.data[i+1] = Math.min(255, imgData.data[i+1] * factor);
        imgData.data[i+2] = Math.min(255, imgData.data[i+2] * factor);
    }

    return imgData; 
};

function getSkinStats(img: ImageData) {
    let sumL = 0, sumA = 0;
    let count = 0;
    const step = 16;
    for (let i = 0; i < img.data.length; i += step) {
         // Skip black pixels (mask)
         if (img.data[i+3] === 0) continue;
         const { L, a } = rgbToLab(img.data[i], img.data[i+1], img.data[i+2]);
         sumL += L; sumA += a; count++;
    }
    if (count === 0) return { meanL: 100, meanA: 0 };
    return { meanL: sumL / count, meanA: sumA / count };
}

// 1. Redness (Relative to self)
function calculateRedness(img: ImageData): number {
    const stats = getSkinStats(img);
    let rednessSeverity = 0;
    let count = 0;
    // We look for pixels that are significantly redder than the face's average
    const threshold = 10; 
    for (let i = 0; i < img.data.length; i += 16) {
         const { a } = rgbToLab(img.data[i], img.data[i+1], img.data[i+2]);
         if (a > stats.meanA + threshold) {
             rednessSeverity += (a - (stats.meanA + threshold));
         }
         count++;
    }
    const avgSeverity = count > 0 ? rednessSeverity / count : 0;
    // Lower score is worse. Severity 0 = Score 100. Severity 10 = Score ~50
    return Math.max(10, 100 - (avgSeverity * 4)); 
}

// 2. Blemishes (Relative to self)
function calculateBlemishes(img: ImageData): { active: number, scars: number } {
    const stats = getSkinStats(img);
    let activePixels = 0;
    let scarPixels = 0;
    let count = 0;
    
    // REDUCED SENSITIVITY: To distinguish peeling from acne, we require higher threshold for "Acne"
    // Peeling often creates high-frequency noise, so single pixels are less likely to be acne.
    // In a full CV system we'd use blob detection, here we use strict color thresholds.
    for (let i = 0; i < img.data.length; i += 16) {
        const { L, a } = rgbToLab(img.data[i], img.data[i+1], img.data[i+2]);
        // Active: High Redness. Increased threshold to 18 (from 15) to avoid catching minor inflammation/peeling
        if (a > stats.meanA + 18) activePixels++;
        // Scars: Darker than average. Increased threshold to -25 (from -20) to avoid catching shadows from peeling
        if (L < stats.meanL - 25) scarPixels++;
        count++;
    }
    const activeScore = count > 0 ? 100 - (activePixels / count) * 600 : 100;
    const scarScore = count > 0 ? 100 - (scarPixels / count) * 400 : 100;
    return {
        active: Math.max(10, activeScore),
        scars: Math.max(10, scarScore)
    };
}

// 4. Hydration (Gloss analysis)
function calculateHydration(img: ImageData): number {
    let glowPixels = 0;
    const total = img.data.length / 4;
    for (let i = 0; i < img.data.length; i += 16) {
        const r = img.data[i], g = img.data[i+1], b = img.data[i+2];
        const l = 0.299*r + 0.587*g + 0.114*b;
        const max = Math.max(r,g,b);
        const min = Math.min(r,g,b);
        const sat = max === 0 ? 0 : (max-min)/max;
        
        // Healthy glow: High Luma, Low-Mid Saturation
        if (l > 170 && l < 245 && sat < 0.4) glowPixels++;
    }
    const ratio = total > 0 ? glowPixels / total : 0;
    // Target ratio ~10-15% for healthy glow. Too high = Oily. Too low = Dry.
    return Math.max(10, 100 - Math.abs(ratio - 0.12) * 300); 
}

// 5. Oiliness
function calculateOiliness(img: ImageData): number {
    let shinePixels = 0;
    const total = img.data.length / 4;
    for (let i = 0; i < img.data.length; i += 16) {
        const r = img.data[i], g = img.data[i+1], b = img.data[i+2];
        const l = 0.299*r + 0.587*g + 0.114*b;
        const max = Math.max(r,g,b);
        const min = Math.min(r,g,b);
        const sat = max === 0 ? 0 : (max-min)/max;
        
        // Oil: Very High Luma, Very Low Saturation (Pure white reflection)
        if (l > 220 && sat < 0.15) shinePixels++;
    }
    const score = total > 0 ? 100 - (shinePixels / total) * 600 : 100;
    return Math.max(10, score); 
}

// 6. Wrinkles (Edge density)
function calculateWrinkles(img: ImageData): { fine: number, deep: number } {
    const w = img.width;
    const h = img.height;
    const data = img.data;
    let fineEdges = 0;
    let deepEdges = 0;
    // Simple edge detection
    for (let y = 1; y < h - 1; y += 2) {
        for (let x = 1; x < w - 1; x += 2) {
            const idx = ((y)*w+x)*4;
            const c = (data[idx] + data[idx+1] + data[idx+2])/3;
            const n = (data[((y-1)*w+x)*4] + data[((y-1)*w+x)*4+1] + data[((y-1)*w+x)*4+2])/3;
            
            const delta = Math.abs(c - n);
            if (delta > 15 && delta < 35) fineEdges++;
            if (delta >= 35) deepEdges++;
        }
    }
    const total = (w * h) / 4;
    return {
        fine: Math.max(10, 100 - (fineEdges / total) * 150),
        deep: Math.max(10, 100 - (deepEdges / total) * 100)
    };
}

// 8. Dark Circles (Contrast vs Cheek)
function calculateDarkCircles(eyeImg: ImageData, cheekImg: ImageData): number {
    const getLuma = (d: ImageData) => {
        let sum = 0;
        if (d.data.length === 0) return 128;
        for(let i=0; i<d.data.length; i+=4) sum += (0.299*d.data[i] + 0.587*d.data[i+1] + 0.114*d.data[i+2]);
        return sum / (d.data.length/4);
    }
    const eyeL = getLuma(eyeImg);
    const cheekL = getLuma(cheekImg);
    // Dark circles are darker than cheek. 
    const diff = Math.max(0, cheekL - eyeL);
    // Tolerance of 5 units. Penalty for everything else.
    return Math.max(20, 100 - (Math.max(0, diff - 5) * 2.5));
}

// 9. Sagging (Contrast at jawline)
function calculateSagging(jawImg: ImageData): number {
    const w = jawImg.width;
    const h = jawImg.height;
    let totalContrast = 0;
    // We want HIGH contrast at the jaw edge (sharp line). Low contrast = sagging/jowls.
    for (let x = 0; x < w; x+=4) {
        let colContrast = 0;
        for (let y = 1; y < h-1; y+=2) {
             const c = jawImg.data[(y*w+x)*4];
             const down = jawImg.data[((y+1)*w+x)*4];
             colContrast += Math.abs(c - down);
        }
        totalContrast += colContrast;
    }
    const avgContrast = (w*h > 0) ? totalContrast / (w * h) : 0;
    // Normalize: Contrast of 5 is bad, 20 is good.
    return Math.min(100, Math.max(20, avgContrast * 4 + 30));
}

// 10. Pores (Local Contrast in L channel)
function calculatePores(noseImg: ImageData): { pores: number, blackheads: number } {
    const stats = getSkinStats(noseImg);
    let largePores = 0;
    let blackheads = 0;
    let count = 0;
    for (let i = 0; i < noseImg.data.length; i += 16) {
        const { L } = rgbToLab(noseImg.data[i], noseImg.data[i+1], noseImg.data[i+2]);
        // Blackheads: Very dark spots relative to mean
        if (L < stats.meanL - 30) blackheads++;
        // Pores: Moderately dark spots
        else if (L < stats.meanL - 15) largePores++;
        count++;
    }
    return {
        pores: count > 0 ? Math.max(10, 100 - (largePores / count) * 300) : 100,
        blackheads: count > 0 ? Math.max(10, 100 - (blackheads / count) * 500) : 100
    };
}


export const analyzeSkinFrame = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): SkinMetrics => {
  const { cx, cy, faceWidth, faceHeight } = detectFaceBounds(ctx, width, height);
  const roiSize = Math.floor(faceWidth * 0.25); 

  const foreheadY = cy - faceHeight * 0.35;
  const cheekY = cy + faceHeight * 0.05;
  const eyeY = cy - faceHeight * 0.12;
  const noseY = cy + faceHeight * 0.1;
  const jawY = cy + faceHeight * 0.45;

  // IMPORTANT: These ROIs are NORMALIZED (lighting corrected) inside getNormalizedROI
  // This ensures scores are consistent regardless of environment
  const foreheadData = getNormalizedROI(ctx, cx - roiSize, foreheadY, roiSize*2, roiSize*0.6);
  const leftCheekData = getNormalizedROI(ctx, cx - faceWidth * 0.28, cheekY, roiSize, roiSize);
  const rightCheekData = getNormalizedROI(ctx, cx + faceWidth * 0.08, cheekY, roiSize, roiSize);
  const eyeData = getNormalizedROI(ctx, cx - roiSize, eyeY, roiSize * 2, roiSize * 0.4);
  const noseData = getNormalizedROI(ctx, cx - roiSize/2, noseY, roiSize, roiSize * 0.5);
  const jawData = getNormalizedROI(ctx, cx - roiSize, jawY, roiSize*2, roiSize * 0.4);

  const redness = calculateRedness(leftCheekData);
  const { active: acneActive, scars: acneScars } = calculateBlemishes(leftCheekData);
  const { fine: wrinkleFine, deep: wrinkleDeep } = calculateWrinkles(foreheadData);
  const hydration = calculateHydration(leftCheekData); 
  const oiliness = calculateOiliness(foreheadData); 
  const darkCircles = calculateDarkCircles(eyeData, leftCheekData);
  const sagging = calculateSagging(jawData);
  const { pores: poreSize, blackheads } = calculatePores(noseData);
  const pigmentation = calculateBlemishes(rightCheekData).scars; 
  const texture = (wrinkleFine + poreSize + acneScars) / 3;

  const weightedScore = (
      (acneActive * 1.5) +
      (redness * 1.5) +
      (texture * 1.5) +
      (pigmentation * 1.2) +
      (poreSize * 1.0) +
      (blackheads * 1.0) +
      (wrinkleFine * 0.8) +
      (wrinkleDeep * 0.8) +
      (sagging * 0.8) +
      (hydration * 0.8) +
      (oiliness * 0.8) +
      (darkCircles * 0.5) 
  ) / 11.4;

  // "Weakest Link" Penalty Logic:
  // If a critical area (Barrier or Acne) is severe, the Overall Score shouldn't be high 
  // just because other areas are perfect.
  const lowestMetric = Math.min(acneActive, redness, texture, hydration);
  let finalScore = weightedScore;
  
  if (lowestMetric < 50) {
      // If any critical metric is failing (<50), cap the max score and apply penalty
      // This prevents a score of 77 when redness is 30.
      const penalty = (50 - lowestMetric) * 0.5;
      finalScore = Math.min(weightedScore, 65) - penalty;
  }

  const overallScore = normalizeScore(finalScore);
  
  let estimatedAge = 25;
  if (wrinkleDeep < 90) estimatedAge += (90 - wrinkleDeep) * 0.5;
  if (wrinkleFine < 90) estimatedAge += (90 - wrinkleFine) * 0.2;
  if (sagging < 90) estimatedAge += (90 - sagging) * 0.4;
  if (pigmentation < 90) estimatedAge += (90 - pigmentation) * 0.2;
  
  if (texture > 90) estimatedAge -= 2;
  if (hydration > 90) estimatedAge -= 1;

  return {
    overallScore: overallScore,
    skinAge: Math.floor(Math.max(18, estimatedAge)), 
    acneActive: normalizeScore(acneActive),
    acneScars: normalizeScore(acneScars),
    poreSize: normalizeScore(poreSize),
    blackheads: normalizeScore(blackheads),
    wrinkleFine: normalizeScore(wrinkleFine),
    wrinkleDeep: normalizeScore(wrinkleDeep),
    pigmentation: normalizeScore(pigmentation),
    redness: normalizeScore(redness),
    hydration: normalizeScore(hydration),
    oiliness: normalizeScore(oiliness),
    darkCircles: normalizeScore(darkCircles),
    sagging: normalizeScore(sagging),
    texture: normalizeScore(texture),
    timestamp: Date.now(),
  };
};

export const drawBiometricOverlay = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  metrics: SkinMetrics
) => {
  const { cx, cy, faceWidth } = detectFaceBounds(ctx, width, height);
  // Dynamic color based on score
  const color = metrics.overallScore > 80 ? "16, 185, 129" : metrics.overallScore > 60 ? "245, 158, 11" : "244, 63, 94";
  
  ctx.strokeStyle = `rgba(${color}, 0.5)`; 
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, faceWidth * 0.6, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle Scan Lines
  ctx.fillStyle = `rgba(${color}, 0.1)`;
  ctx.fillRect(cx - faceWidth * 0.6, cy, faceWidth * 1.2, 2);
};
