
import { SkinMetrics } from '../types';

/**
 * Checks video frame quality before analysis.
 */
export const validateFrame = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lastFacePos?: { cx: number, cy: number }
): { isGood: boolean; message: string; facePos?: { cx: number, cy: number } } => {
  const { cx, cy, faceWidth } = detectFaceBounds(ctx, width, height);
  
  if (faceWidth < width * 0.25) {
      return { isGood: false, message: "Move Closer" };
  }

  if (lastFacePos) {
      const dist = Math.sqrt(Math.pow(cx - lastFacePos.cx, 2) + Math.pow(cy - lastFacePos.cy, 2));
      if (dist > width * 0.03) {
          return { isGood: false, message: "Hold Still", facePos: { cx, cy } };
      }
  }

  const p = ctx.getImageData(Math.floor(cx), Math.floor(cy), 1, 1).data;
  const luma = 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];

  if (luma < 40) return { isGood: false, message: "Lighting Too Dark", facePos: { cx, cy } };
  if (luma > 240) return { isGood: false, message: "Lighting Too Bright", facePos: { cx, cy } };

  return { isGood: true, message: "Scanning...", facePos: { cx, cy } };
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
 * TEXTURE ENHANCEMENT ENGINE
 * Applies Unsharp Masking and Contrast Boosting to highlight imperfections.
 */
export const enhanceSkinTexture = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
): ImageData => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const w = width;
    const h = height;
    
    // Create a buffer for the output
    const output = new Uint8ClampedArray(data.length);

    // Sharpen Kernel (Unsharp Mask)
    //  0 -1  0
    // -1  5 -1
    //  0 -1  0
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    const kSum = 1; // Sum of kernel

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            
            let r = 0, g = 0, b = 0;

            // Apply Convolution
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const kidx = ((y + ky) * w + (x + kx)) * 4;
                    const weight = kernel[(ky + 1) * 3 + (kx + 1)];
                    
                    r += data[kidx] * weight;
                    g += data[kidx + 1] * weight;
                    b += data[kidx + 2] * weight;
                }
            }

            // Normalization & Contrast Boost
            // We increase contrast to make red spots redder and dark spots darker
            const boost = 1.1; // 10% Contrast boost
            
            output[idx] = Math.min(255, Math.max(0, ((r / kSum) - 128) * boost + 128));
            output[idx + 1] = Math.min(255, Math.max(0, ((g / kSum) - 128) * boost + 128));
            output[idx + 2] = Math.min(255, Math.max(0, ((b / kSum) - 128) * boost + 128));
            output[idx + 3] = 255; // Alpha
        }
    }
    
    return new ImageData(output, width, height);
};

/**
 * CLINICAL IMPERFECTION MAPPING
 * Visualizes defects directly on the skin texture using colorimetry.
 * Replaces the wireframe overlay on the final snapshot.
 */
export const drawImperfectionMap = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Calculate baseline stats for this specific image to be adaptive
    const stats = getSkinStats(imageData);

    // Thresholds (tuned for visibility on snapshot)
    const rednessThreshold = 10;
    const pigmentThreshold = 15;
    const poreThreshold = 15;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];

        // Strict skin check to avoid coloring hair/background
        if (!isSkinPixel(r, g, b)) continue;

        const { L, a } = rgbToLab(r, g, b);

        // 1. INFLAMMATION / ACNE (High a-channel)
        if (a > stats.meanA + rednessThreshold) {
             // Tint Soft Red/Pink
             // Increase Red, Decrease Green/Blue
             data[i] = Math.min(255, r + 40); 
             data[i+1] = Math.max(0, g - 20);
             data[i+2] = Math.max(0, b - 20);
        }
        
        // 2. PIGMENTATION / SCARS (Low L-channel)
        // Changed to VIOLET/PURPLE based on feedback (UV-style)
        else if (L < stats.meanL - pigmentThreshold) {
             // Tint Violet (Red + Blue)
             data[i] = Math.min(255, r + 20); 
             data[i+1] = Math.max(0, g - 40); // Remove Green
             data[i+2] = Math.min(255, b + 60); // Add Blue
        }

        // 3. PORES / TEXTURE (High Local Contrast + Dark)
        // We use a simplified check here: Very dark small points that aren't pigment
        else if (L < stats.meanL - poreThreshold && L > stats.meanL - 30) {
            // Tint slightly White/Cyan to show texture depth
             data[i] = Math.min(255, r + 30); 
             data[i+1] = Math.min(255, g + 30); 
             data[i+2] = Math.min(255, b + 30);
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
};

/**
 * Strict Skin Pixel Check
 */
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
            const r = data[i], g = data[i+1], b = data[i+2];
            if (isSkinPixel(r, g, b)) {
                sumX += x; sumY += y; count++;
            }
        }
    }

    if (count < 50) return { cx: width/2, cy: height/2, faceWidth: width * 0.5, faceHeight: height * 0.6 };

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

// --- ADAPTIVE ALGORITHMS ---

/**
 * Calculates average skin stats for the ROI to perform relative thresholding.
 */
function getSkinStats(img: ImageData) {
    let sumL = 0, sumA = 0;
    let count = 0;
    const step = 16;
    for (let i = 0; i < img.data.length; i += step) {
         const { L, a } = rgbToLab(img.data[i], img.data[i+1], img.data[i+2]);
         sumL += L; sumA += a; count++;
    }
    // Avoid division by zero
    if (count === 0) return { meanL: 100, meanA: 0 };
    return { meanL: sumL / count, meanA: sumA / count };
}

// 1. Redness (Inflammation) - Variance from Mean Skin Undertone
function calculateRedness(img: ImageData): number {
    const stats = getSkinStats(img);
    let rednessSeverity = 0;
    const step = 16;
    let count = 0;

    for (let i = 0; i < img.data.length; i += step) {
         const { a } = rgbToLab(img.data[i], img.data[i+1], img.data[i+2]);
         // If pixel is significantly redder than the user's average
         if (a > stats.meanA + 8) {
             rednessSeverity += (a - stats.meanA);
         }
         count++;
    }
    const avgSeverity = count > 0 ? rednessSeverity / count : 0;
    return 100 - (avgSeverity * 5); 
}

// 2. Acne Active (Bright Red Spots) vs 3. Scars (Dark/Brown Spots)
function calculateBlemishes(img: ImageData): { active: number, scars: number } {
    const stats = getSkinStats(img);
    let activePixels = 0;
    let scarPixels = 0;
    const step = 16;
    let count = 0;
    
    for (let i = 0; i < img.data.length; i += step) {
        const r = img.data[i], g = img.data[i+1], b = img.data[i+2];
        const { L, a } = rgbToLab(r, g, b);
        
        // Active Acne: Redness Spike relative to baseline
        if (a > stats.meanA + 12) activePixels++;
        
        // Scars/Pigmentation: Darker than baseline (Relative Dark Spot)
        // This ensures detection works even in bright light
        if (L < stats.meanL - 15) scarPixels++;
        
        count++;
    }
    
    return {
        active: count > 0 ? 100 - (activePixels / count) * 800 : 100,
        scars: count > 0 ? 100 - (scarPixels / count) * 500 : 100
    };
}

// 4. Hydration (Glow) - Specular Variance
function calculateHydration(img: ImageData): number {
    let glowPixels = 0;
    const total = img.data.length / 4;
    for (let i = 0; i < img.data.length; i += 16) {
        const r = img.data[i], g = img.data[i+1], b = img.data[i+2];
        const l = (0.299*r + 0.587*g + 0.114*b);
        // Soft Highlight zone
        if (l > 180 && l < 240) glowPixels++;
    }
    const ratio = total > 0 ? glowPixels / total : 0;
    const score = 100 - Math.abs(ratio - 0.15) * 400; 
    return score;
}

// 5. Oiliness (T-Zone Shine) - Sharp Specular Highlights
function calculateOiliness(img: ImageData): number {
    let shinePixels = 0;
    const total = img.data.length / 4;
    for (let i = 0; i < img.data.length; i += 16) {
        const r = img.data[i], g = img.data[i+1], b = img.data[i+2];
        const l = (Math.max(r,g,b) + Math.min(r,g,b)) / 2;
        const s = (Math.max(r,g,b) - Math.min(r,g,b)) / (255 - Math.abs(2*l - 255));
        
        // Oil = Very Bright + Low Saturation (White Shine)
        if (l > 210 && s < 0.2) shinePixels++;
    }
    return total > 0 ? 100 - (shinePixels / total) * 800 : 100; 
}

// 6. Wrinkles (Fine) vs 7. Deep Creases - Edge Detection Intensity
function calculateWrinkles(img: ImageData): { fine: number, deep: number } {
    const w = img.width;
    const h = img.height;
    const data = img.data;
    let fineEdges = 0;
    let deepEdges = 0;
    
    for (let y = 1; y < h - 1; y += 2) {
        for (let x = 1; x < w - 1; x += 2) {
            const idx = (y * w + x) * 4;
            const c = data[idx+1]; // Green channel
            // Laplacian
            const n = data[((y-1)*w+x)*4+1];
            const s = data[((y+1)*w+x)*4+1];
            const e = data[(y*w+(x+1))*4+1];
            const wPx = data[(y*w+(x-1))*4+1];
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

// 8. Dark Circles - Under Eye Luminance vs Cheek Luminance
function calculateDarkCircles(eyeImg: ImageData, cheekImg: ImageData): number {
    const getLuma = (d: ImageData) => {
        let sum = 0;
        if (d.data.length === 0) return 128;
        for(let i=0; i<d.data.length; i+=4) sum += (0.299*d.data[i] + 0.587*d.data[i+1] + 0.114*d.data[i+2]);
        return sum / (d.data.length/4);
    }
    const eyeL = getLuma(eyeImg);
    const cheekL = getLuma(cheekImg);
    
    // If eye is significantly darker than cheek
    const diff = cheekL - eyeL;
    return 100 - (Math.max(0, diff - 5) * 2);
}

// 9. Sagging - Jawline Contrast Definition
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

// 10. Pore Size vs Blackheads
function calculatePores(noseImg: ImageData): { pores: number, blackheads: number } {
    const stats = getSkinStats(noseImg);
    let largePores = 0;
    let blackheads = 0;
    const data = noseImg.data;
    const step = 16;
    let count = 0;

    for (let i = 0; i < data.length; i += step) {
        const r = data[i], g = data[i+1], b = data[i+2];
        const { L } = rgbToLab(r, g, b);
        
        // Pores: Local variance/shadows relative to mean skin brightness
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

  // Define ROIs
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

  // Run Analysis
  const redness = calculateRedness(leftCheekData);
  const { active: acneActive, scars: acneScars } = calculateBlemishes(leftCheekData);
  const { fine: wrinkleFine, deep: wrinkleDeep } = calculateWrinkles(foreheadData);
  const hydration = calculateHydration(leftCheekData); 
  const oiliness = calculateOiliness(foreheadData); 
  const darkCircles = calculateDarkCircles(eyeData, leftCheekData);
  const sagging = calculateSagging(jawData);
  const { pores: poreSize, blackheads } = calculatePores(noseData);
  const pigmentation = calculateBlemishes(rightCheekData).scars; // Use scar logic for pigmentation
  const texture = (wrinkleFine + poreSize + acneScars) / 3;

  // Weighted Score Calculation for Realism
  // Surface Appearance (Acne, Redness, Texture) has higher impact on perceived health
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
      (darkCircles * 0.5) // Genetic/Structural - lower weight
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

/**
 * Ray-Casting Edge Detection
 * Scans outwards from center to find exact face boundary
 */
const getFaceContour = (ctx: CanvasRenderingContext2D, cx: number, cy: number, maxR: number) => {
    const points: {x:number, y:number}[] = [];
    const angles = 16; // Number of boundary points
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    const data = imageData.data;
    const w = ctx.canvas.width;

    for (let i = 0; i < angles; i++) {
        const theta = (i / angles) * Math.PI * 2;
        let r = 0;
        let foundEdge = false;
        
        // Ray cast
        while (r < maxR) {
            const x = Math.floor(cx + r * Math.cos(theta));
            const y = Math.floor(cy + r * Math.sin(theta));
            
            if (x < 0 || x >= w || y < 0 || y >= ctx.canvas.height) break;
            
            const idx = (y * w + x) * 4;
            // Check if NOT skin
            if (!isSkinPixel(data[idx], data[idx+1], data[idx+2])) {
                // If we hit non-skin, back up slightly and stop
                points.push({ x: cx + (r-2) * Math.cos(theta), y: cy + (r-2) * Math.sin(theta) });
                foundEdge = true;
                break;
            }
            r += 5; // Scan step
        }
        if (!foundEdge) points.push({ x: cx + maxR * Math.cos(theta), y: cy + maxR * Math.sin(theta) });
    }
    return points;
};

/**
 * Draw Adaptive Mesh Overlay
 */
export const drawBiometricOverlay = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  metrics: SkinMetrics
) => {
  const { cx, cy, faceWidth } = detectFaceBounds(ctx, width, height);
  const maxRadius = faceWidth * 0.75; 

  // 1. Get Real Face Boundary Points
  const contour = getFaceContour(ctx, cx, cy, maxRadius);

  // 2. Draw Mesh (Connecting Center to Contour)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)"; 
  ctx.lineWidth = 0.5;
  
  // Center Node
  const centerNode = { x: cx, y: cy };

  contour.forEach((p, i) => {
      // Ray from center
      ctx.beginPath();
      ctx.moveTo(centerNode.x, centerNode.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // Connect to next point (Perimeter)
      const nextP = contour[(i + 1) % contour.length];
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nextP.x, nextP.y);
      ctx.stroke();
      
      // Add mid-point connections (The "Web" effect)
      const midP = { x: (centerNode.x + p.x)/2, y: (centerNode.y + p.y)/2 };
      const midNextP = { x: (centerNode.x + nextP.x)/2, y: (centerNode.y + nextP.y)/2 };
      ctx.beginPath();
      ctx.moveTo(midP.x, midP.y);
      ctx.lineTo(midNextP.x, midNextP.y);
      ctx.stroke();
  });

  // 3. Glowing Nodes at Key Vertices
  const drawNode = (x: number, y: number, size: number = 2) => {
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Glow
      const grd = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
      grd.addColorStop(0, "rgba(255, 255, 255, 0.6)");
      grd.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, size * 4, 0, Math.PI * 2);
      ctx.fill();
  };

  // Draw Center Node (Nose)
  drawNode(cx, cy, 3);
  
  // Draw Contour Nodes
  contour.forEach((p, i) => {
     // Only draw some nodes to avoid clutter
     if (i % 2 === 0) drawNode(p.x, p.y, 2);
  });

  // 4. AR Cards (Floating Metrics) - Anchored to real contour points
  const leftCheekIdx = Math.floor(contour.length * 0.75); // Approx left
  const rightCheekIdx = Math.floor(contour.length * 0.25); // Approx right
  const foreheadIdx = Math.floor(contour.length * 0.5); // Top

  const drawARCard = (anchor: {x:number, y:number}, label: string, value: number, align: 'left' | 'right') => {
      const offsetX = align === 'left' ? -40 : 40;
      const cardW = 80;
      const cardH = 32;
      const cardX = anchor.x + offsetX - (align === 'left' ? cardW : 0);
      const cardY = anchor.y;

      // Line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(cardX + (align === 'left' ? cardW : 0), cardY + cardH/2);
      ctx.stroke();

      // Card
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.stroke();

      // Content
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 10px 'Plus Jakarta Sans'";
      ctx.fillText(label, cardX + 10, cardY + 12);
      ctx.font = "bold 9px 'Plus Jakarta Sans'";
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillText(`${value}%`, cardX + 10, cardY + 24);
      
      // Mini Indicator
      ctx.beginPath();
      ctx.arc(cardX + cardW - 12, cardY + cardH/2, 6, 0, Math.PI*2);
      ctx.strokeStyle = value > 70 ? "#10B981" : "#F59E0B";
      ctx.lineWidth = 2;
      ctx.stroke();
  };

  // Dynamic Anchors based on Ray Cast results
  if (contour.length > foreheadIdx) drawARCard(contour[foreheadIdx], "Hydration", metrics.hydration, 'right');
  if (contour.length > rightCheekIdx) drawARCard(contour[rightCheekIdx], "Texture", metrics.texture, 'right');
  if (contour.length > leftCheekIdx) drawARCard(contour[leftCheekIdx], "Firmness", metrics.sagging, 'left');
};
