export const processLogo = (imageUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(imageUrl); return; }

      // Set canvas size to image size
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image to read data
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // 1. Detect Background Color (Sample corners)
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];
      const bgA = data[3];

      const hasAlpha = bgA === 0;
      
      // Temporary storage for quantization analysis
      const colorAccumulator: Record<string, { r: number, g: number, b: number, count: number }> = {};
      
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
      let hasContent = false;

      // 2. Process Pixels: Remove Background
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        let isBackground = false;

        // Check background
        if (!hasAlpha) {
            const dist = Math.sqrt(
                Math.pow(r - bgR, 2) + 
                Math.pow(g - bgG, 2) + 
                Math.pow(b - bgB, 2)
            );
            if (dist < 40) isBackground = true; // Slightly increased tolerance
        } else {
            if (a < 20) isBackground = true;
        }

        if (isBackground) {
            data[i + 3] = 0; // Make transparent
        } else {
            hasContent = true;
            
            // Collect bounds
            const x = (i / 4) % canvas.width;
            const y = Math.floor((i / 4) / canvas.width);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;

            // Collect Color Data for Quantization
            // We group similar colors to find dominant themes
            // Rounding to nearest 24 gives us rough buckets
            const bucketSize = 24;
            const keyR = Math.round(r / bucketSize) * bucketSize;
            const keyG = Math.round(g / bucketSize) * bucketSize;
            const keyB = Math.round(b / bucketSize) * bucketSize;
            const key = `${keyR},${keyG},${keyB}`;

            if (!colorAccumulator[key]) {
                colorAccumulator[key] = { r: 0, g: 0, b: 0, count: 0 };
            }
            colorAccumulator[key].r += r;
            colorAccumulator[key].g += g;
            colorAccumulator[key].b += b;
            colorAccumulator[key].count++;
        }
      }
      
      if (!hasContent) {
         resolve(imageUrl); 
         return;
      }

      // 3. Determine Palette (Top 4 Colors)
      const sortedBuckets = Object.values(colorAccumulator).sort((a, b) => b.count - a.count);
      
      // Calculate true average color of each bucket to get the "Main" colors
      const candidates = sortedBuckets.map(b => ({
          r: Math.round(b.r / b.count),
          g: Math.round(b.g / b.count),
          b: Math.round(b.b / b.count)
      }));

      // Filter to get 4 distinct colors (simple distance check to avoid 4 shades of same color)
      const palette: {r: number, g: number, b: number}[] = [];
      
      for (const cand of candidates) {
          if (palette.length >= 4) break;
          
          // Check distance to existing palette colors
          let isDistinct = true;
          for (const p of palette) {
              const dist = Math.sqrt(Math.pow(cand.r - p.r, 2) + Math.pow(cand.g - p.g, 2) + Math.pow(cand.b - p.b, 2));
              if (dist < 45) { // Minimum difference threshold
                  isDistinct = false;
                  break;
              }
          }
          if (isDistinct) palette.push(cand);
      }
      
      // If we somehow didn't find enough distinct ones, just fill with the top ones regardless of distance
      if (palette.length < 4 && candidates.length > 0) {
          let i = 0;
          while (palette.length < 4 && i < candidates.length) {
              if (!palette.includes(candidates[i])) palette.push(candidates[i]);
              i++;
          }
      }

      // 4. Quantize Image (Flatten gradients to 4 colors)
      if (palette.length > 0) {
          for (let i = 0; i < data.length; i += 4) {
             if (data[i+3] === 0) continue; // Skip transparent

             const r = data[i];
             const g = data[i+1];
             const b = data[i+2];

             // Find closest palette color
             let minDist = Infinity;
             let bestColor = palette[0];

             for (const p of palette) {
                 const dist = Math.sqrt(Math.pow(r - p.r, 2) + Math.pow(g - p.g, 2) + Math.pow(b - p.b, 2));
                 if (dist < minDist) {
                     minDist = dist;
                     bestColor = p;
                 }
             }

             // Snap pixel to palette color
             data[i] = bestColor.r;
             data[i+1] = bestColor.g;
             data[i+2] = bestColor.b;
             data[i+3] = 255; // Ensure full opacity for print areas
          }
      }

      // Apply changes to context
      ctx.putImageData(imageData, 0, 0);

      // 5. Crop and Center
      const contentWidth = maxX - minX + 1;
      const contentHeight = maxY - minY + 1;
      
      const size = Math.max(contentWidth, contentHeight) * 1.2; 
      
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = size;
      finalCanvas.height = size;
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) { resolve(imageUrl); return; }

      const destX = (size - contentWidth) / 2;
      const destY = (size - contentHeight) / 2;
      
      finalCtx.drawImage(
        canvas, 
        minX, minY, contentWidth, contentHeight, 
        destX, destY, contentWidth, contentHeight
      );

      resolve(finalCanvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageUrl);
    img.src = imageUrl;
  });
};