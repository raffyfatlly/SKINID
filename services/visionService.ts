

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

  if (faceWidth < width * 0.1) {
       return { isGood: false, message: "No Face", instruction: "Position face in circle", status: 'ERROR' };
  }

  if (faceWidth < width * 0.2) {
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

  if (luma < 30) {
      status = 'WARNING';
      message = "Low Light";
      instruction = "Face light source";
  } else if (luma > 240) {
      status = 'WARNING';
      message = "Too Bright";
      instruction = "Reduce glare";
  }

  if (lastFacePos) {
      const dist = Math.sqrt(Math.pow(cx - lastFacePos.cx, 2) + Math.pow(cy - lastFacePos.cy, 2));
      if (dist > width * 0.15) { 
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

/**
 * TEXTURE ENHANCEMENT & CLINICAL OVERLAY ENGINE
 * HD Tech Look: No drawn lines, only precise pinpointing.
 */
export const applyClinicalOverlays = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
) => {
    // 1. Detection
    const { cx, cy, faceWidth, faceHeight } = detectFaceBounds(ctx, width, height);
    if (faceWidth === 0) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const stats = getSkinStats(imageData);

    // 2. HD Enhancement (Selective Contrast Boost)
    // We boost contrast slightly on skin areas to make imperfections visible without blurring.
    // AND we tint red areas slightly redder to make them pop for the user to see.
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        
        // Simple skin check to avoid background enhancement
        if (r > 60 && g > 40 && b > 20 && r > g) {
            // Contrast Boost
            // (value - 128) * factor + 128
            const factor = 1.1; // 10% boost
            data[i] = Math.min(255, Math.max(0, (r - 128) * factor + 128));
            data[i+1] = Math.min(255, Math.max(0, (g - 128) * factor + 128));
            data[i+2] = Math.min(255, Math.max(0, (b - 128) * factor + 128));

            // Enhancement: If significantly red, boost red channel to make it obvious
            const { a } = rgbToLab(r, g, b);
            if (a > stats.meanA + 10) {
                 data[i] = Math.min(255, data[i] + 20); // Boost Red
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);

    // 3. Technical Pinpointing (Crosshairs)
    // No drawn facial zones (no Bezier curves).
    // Just crisp pixel markers.
    
    ctx.lineWidth = 1; // hairline
    const scanStep = 6; 
    
    for (let y = Math.floor(cy - faceHeight * 0.45); y < cy + faceHeight * 0.5; y += scanStep) {
        for (let x = Math.floor(cx - faceWidth * 0.45); x < cx + faceWidth * 0.45; x += scanStep) {
            
            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            // Elliptical mask
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
            if (a > stats.meanA + 15) {
                const size = 3;
                ctx.strokeStyle = 'rgba(255, 60, 60, 0.6)'; // Crisp Red
                ctx.beginPath();
                ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
                ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
                ctx.stroke();
            }
            // Pores / Dark Spots (Cyan Crosshair - Technical Look)
            else if (L < stats.meanL - 25) {
                 const size = 2;
                 ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'; // Tech Cyan dot
                 ctx.fillRect(x, y, 1.5, 1.5);
            }
        }
    }
};

export const enhanceSkinTexture = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
): ImageData => {
    return ctx.getImageData(0, 0, width, height);
};

export const drawImperfectionMap = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => {
    // Legacy mapping - kept if needed for other views, but main flow uses applyClinicalOverlays
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const stats = getSkinStats(imageData);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];

        if (!isSkinPixel(r, g, b)) continue;

        const { L, a } = rgbToLab(r, g, b);

        if (a > stats.meanA + 10) { 
             data[i] = Math.min(255, r + 40); 
             data[i+1] = Math.max(0, g - 20);
        } else if (L < stats.meanL - 15) { 
             data[i+2] = Math.min(255, b + 60); 
        }
    }
    ctx.putImageData(imageData, 0, 0);
};

const isSkinPixel = (r: number, g: number, b: number): boolean => {
    return (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 10);
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
    if (x < 0) x = 0; if (y < 0) y = 0;
    w = Math.min(w, ctx.canvas.width - x);
    h = Math.min(h, ctx.canvas.height - y);
    return ctx.getImageData(x, y, w, h); 
};

function getSkinStats(img: ImageData) {
    let sumL = 0, sumA = 0;
    let count = 0;
    const step = 16;
    for (let i = 0; i < img.data.length; i += step) {
         const { L, a } = rgbToLab(img.data[i], img.data[i+1], img.data[i+2]);
         sumL += L; sumA += a; count++;
    }
    if (count === 0) return { meanL: 100, meanA: 0 };
    return { meanL: sumL / count, meanA: sumA / count };
}

// ... (Rest of algorithms kept as is) ...
// 1. Redness
function calculateRedness(img: ImageData): number {
    const stats = getSkinStats(img);
    let rednessSeverity = 0;
    let count = 0;
    for (let i = 0; i < img.data.length; i += 16) {
         const { a } = rgbToLab(img.data[i], img.data[i+1], img.data[i+2]);
         if (a > stats.meanA + 8) rednessSeverity += (a - stats.meanA);
         count++;
    }
    const avgSeverity = count > 0 ? rednessSeverity / count : 0;
    return 100 - (avgSeverity * 5); 
}

// 2. Blemishes
function calculateBlemishes(img: ImageData): { active: number, scars: number } {
    const stats = getSkinStats(img);
    let activePixels = 0;
    let scarPixels = 0;
    let count = 0;
    for (let i = 0; i < img.data.length; i += 16) {
        const { L, a } = rgbToLab(img.data[i], img.data[i+1], img.data[i+2]);
        if (a > stats.meanA + 12) activePixels++;
        if (L < stats.meanL - 15) scarPixels++;
        count++;
    }
    return {
        active: count > 0 ? 100 - (activePixels / count) * 800 : 100,
        scars: count > 0 ? 100 - (scarPixels / count) * 500 : 100
    };
}

// 4. Hydration
function calculateHydration(img: ImageData): number {
    let glowPixels = 0;
    const total = img.data.length / 4;
    for (let i = 0; i < img.data.length; i += 16) {
        const l = (0.299*img.data[i] + 0.587*img.data[i+1] + 0.114*img.data[i+2]);
        if (l > 180 && l < 240) glowPixels++;
    }
    const ratio = total > 0 ? glowPixels / total : 0;
    return 100 - Math.abs(ratio - 0.15) * 400; 
}

// 5. Oiliness
function calculateOiliness(img: ImageData): number {
    let shinePixels = 0;
    const total = img.data.length / 4;
    for (let i = 0; i < img.data.length; i += 16) {
        const r = img.data[i], g = img.data[i+1], b = img.data[i+2];
        const l = (Math.max(r,g,b) + Math.min(r,g,b)) / 2;
        const s = (Math.max(r,g,b) - Math.min(r,g,b)) / (255 - Math.abs(2*l - 255));
        if (l > 210 && s < 0.2) shinePixels++;
    }
    return total > 0 ? 100 - (shinePixels / total) * 800 : 100; 
}

// 6. Wrinkles
function calculateWrinkles(img: ImageData): { fine: number, deep: number } {
    const w = img.width;
    const h = img.height;
    const data = img.data;
    let fineEdges = 0;
    let deepEdges = 0;
    for (let y = 1; y < h - 1; y += 2) {
        for (let x = 1; x < w - 1; x += 2) {
            const c = data[((y)*w+x)*4+1];
            const n = data[((y-1)*w+x)*4+1];
            const s = data[((y+1)*w+x)*4+1];
            const e = data[((y)*w+(x+1))*4+1];
            const wPx = data[((y)*w+(x-1))*4+1];
            const delta = Math.abs(4*c - n - s - e - wPx);
            if (delta > 10 && delta < 25) fineEdges++;
            if (delta >= 25) deepEdges++;
        }
    }
    const total = (w * h) / 4;
    return {
        fine: 100 - (fineEdges / total) * 200,
        deep: 100 - (deepEdges / total) * 100
    };
}

// 8. Dark Circles
function calculateDarkCircles(eyeImg: ImageData, cheekImg: ImageData): number {
    const getLuma = (d: ImageData) => {
        let sum = 0;
        if (d.data.length === 0) return 128;
        for(let i=0; i<d.data.length; i+=4) sum += (0.299*d.data[i] + 0.587*d.data[i+1] + 0.114*d.data[i+2]);
        return sum / (d.data.length/4);
    }
    return 100 - (Math.max(0, getLuma(cheekImg) - getLuma(eyeImg) - 5) * 2);
}

// 9. Sagging
function calculateSagging(jawImg: ImageData): number {
    const w = jawImg.width;
    const h = jawImg.height;
    let totalContrast = 0;
    for (let x = 0; x < w; x+=4) {
        let colContrast = 0;
        for (let y = 1; y < h-1; y+=2) {
             const c = jawImg.data[(y*w+x)*4];
             const down = jawImg.data[((y+1)*w+x)*4];
             colContrast += Math.abs(c - down);
        }
        totalContrast += colContrast;
    }
    const score = (w*h > 0) ? (totalContrast / (w * h)) * 10 : 50;
    return Math.min(100, Math.max(20, score));
}

// 10. Pores
function calculatePores(noseImg: ImageData): { pores: number, blackheads: number } {
    const stats = getSkinStats(noseImg);
    let largePores = 0;
    let blackheads = 0;
    let count = 0;
    for (let i = 0; i < noseImg.data.length; i += 16) {
        const { L } = rgbToLab(noseImg.data[i], noseImg.data[i+1], noseImg.data[i+2]);
        if (L < stats.meanL - 20) blackheads++;
        else if (L < stats.meanL - 10) largePores++;
        count++;
    }
    return {
        pores: count > 0 ? 100 - (largePores / count) * 400 : 100,
        blackheads: count > 0 ? 100 - (blackheads / count) * 600 : 100
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

  const overallScore = normalizeScore(weightedScore);

  return {
    overallScore: overallScore,
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
  ctx.strokeStyle = "rgba(16, 185, 129, 0.4)"; 
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, faceWidth * 0.6, 0, Math.PI * 2);
  ctx.stroke();
};
