class ImageProcessor {
    constructor() {
        this.width = 0;
        this.height = 0;
        this.imageData = null;
    }

    /**
     * Loads an image from a File, URL, or base64 string
     * @param {File|string} source - The image source (File object, URL, or base64 data URI)
     * @returns {Promise} - Resolves when the image is loaded
     */
    load(source) {
        return new Promise((resolve, reject) => {
            const imageElement = new window.Image();
            
            imageElement.onload = () => {
                this.width = imageElement.width;
                this.height = imageElement.height;
                
                // Create a canvas to extract pixel data
                const canvas = document.createElement('canvas');
                canvas.width = this.width;
                canvas.height = this.height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(imageElement, 0, 0);
                
                // Get the image data (RGBA values for each pixel)
                this.imageData = this.normalizeImageData(ctx.getImageData(0, 0, this.width, this.height).data);
                
                resolve(this);
            };
            
            imageElement.onerror = () => {
                reject(new Error('Failed to load image'));
            };
            
            // Handle different source types
            if (source instanceof File) {
                // Handle File object from file picker
                const reader = new FileReader();
                reader.onload = (e) => {
                    imageElement.src = e.target.result;
                };
                reader.onerror = () => {
                    reject(new Error('Failed to read file'));
                };
                reader.readAsDataURL(source);
            } else if (typeof source === 'string') {
                // Handle URL or base64 string
                imageElement.src = source;
            } else {
                reject(new Error('Unsupported source type'));
            }
        });
    }

    normalizeImageData(imageData) {
        return imageData.map(value => value / 255);
    }

    /**
     * Extracts a specific channel from the image
     * @param {string} channel - The channel to extract ('r', 'g', 'b', 'a', 'grayscale')
     * @returns {Float32Array|Uint8Array} - Array of channel values
     */
    extractChannel(channel) {
        if (!this.imageData) {
            throw new Error('No image data available. Load an image first.');
        }
        
        const pixelCount = this.width * this.height;
        const channelData = new Float32Array(pixelCount);
        
        for (let i = 0; i < pixelCount; i++) {
            const baseIndex = i * 4; // RGBA = 4 channels
            
            switch (channel.toLowerCase()) {
                case 'r':
                    channelData[i] = this.imageData[baseIndex];
                    break;
                case 'g':
                    channelData[i] = this.imageData[baseIndex + 1];
                    break;
                case 'b':
                    channelData[i] = this.imageData[baseIndex + 2];
                    break;
                case 'a':
                    channelData[i] = this.imageData[baseIndex + 3];
                    break;
                case 'grayscale':
                    const grayValue = (
                        this.imageData[baseIndex] + 
                        this.imageData[baseIndex + 1] + 
                        this.imageData[baseIndex + 2]
                    ) / 3;
                    channelData[i] = grayValue;
                    break;
                default:
                    throw new Error(`Unknown channel: ${channel}`);
            }
        }
        
        return channelData;
    }

    /**
     * Extracts RGB channels as a Vec3 array
     * @returns {Float32Array} - Array of RGB values (3 values per pixel)
     */
    extractRGB() {
        if (!this.imageData) {
            throw new Error('No image data available. Load an image first.');
        }
        
        const pixelCount = this.width * this.height;
        const rgbData = new Float32Array(pixelCount * 3);
        
        for (let i = 0; i < pixelCount; i++) {
            const baseIndex = i * 4; // RGBA = 4 channels
            const outIndex = i * 3; // RGB = 3 channels
            
            rgbData[outIndex] = this.imageData[baseIndex];         // R
            rgbData[outIndex + 1] = this.imageData[baseIndex + 1]; // G
            rgbData[outIndex + 2] = this.imageData[baseIndex + 2]; // B
        }
        
        return rgbData;
    }

    /**
     * Creates a Texture2D from a specific channel
     * @param {string} channel - The channel to extract ('r', 'g', 'b', 'a', 'grayscale')
     * @param {string} interpolation - Interpolation method ('linear' or 'nearest')
     * @returns {Texture2D} - A Texture2D object with the extracted channel data
     */
    toTexture2D(channel, interpolation = 'linear') {
        const channelData = this.extractChannel(channel);
        return new Texture2D(channelData, [this.width, this.height], interpolation);
    }

    /**
     * Creates a Texture2D with RGB vector data
     * @param {string} interpolation - Interpolation method ('linear' or 'nearest')
     * @returns {Texture2D} - A Texture2D object with RGB vector data
     */
    toRGBTexture2D(interpolation = 'linear') {
        const rgbData = this.extractRGB();
        return new Texture2D(rgbData, [this.width, this.height], interpolation);
    }

    /**
     * Creates a new ImageProcessor containing a signed distance field (SDF) of the original image
     * Negative values are inside, positive values are outside
     * A pixel is considered "inside" if its grayscale value is < 0.5, "outside" otherwise
     * @param {number} [upscale=1.0] - Upscale factor for the SDF
     * @param {number} [maxDistance=Infinity] - Maximum distance to compute (for performance)
     * @returns {ImageProcessor} - A new ImageProcessor with the SDF data
     */
    toSDF(upscale = 1.0, maxDistance = Infinity) {
        if (!this.imageData) {
            throw new Error('No image data available. Load an image first.');
        }
        
        // Calculate new dimensions based on upscale factor
        const newWidth = Math.floor(this.width * upscale);
        const newHeight = Math.floor(this.height * upscale);
        const newPixelCount = newWidth * newHeight;
        
        const sdfProcessor = new ImageProcessor();
        sdfProcessor.width = newWidth;
        sdfProcessor.height = newHeight;
        
        // Create binary mask: true for inside (dark), false for outside (light)
        const mask = new Array(newPixelCount);
        
        // Fill the mask with upscaled image data
        for (let ny = 0; ny < newHeight; ny++) {
            for (let nx = 0; nx < newWidth; nx++) {
                // Map new coordinates back to original image
                const x = Math.min(Math.floor(nx / upscale), this.width - 1);
                const y = Math.min(Math.floor(ny / upscale), this.height - 1);
                const origIndex = y * this.width + x;
                const newIndex = ny * newWidth + nx;
                
                const baseIndex = origIndex * 4; // RGBA = 4 channels
                const grayscale = (
                    this.imageData[baseIndex] + 
                    this.imageData[baseIndex + 1] + 
                    this.imageData[baseIndex + 2]
                ) / 3;
                mask[newIndex] = grayscale < 0.5;
            }
        }
        
        // Compute the SDF
        const sdfData = new Float32Array(newPixelCount * 4); // RGBA format
        
        // For each pixel, find the distance to the nearest pixel of opposite type
        for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
                const index = y * newWidth + x;
                const isInside = mask[index];
                
                // Find minimum distance to a pixel of opposite type
                let minDist = maxDistance;
                
                // Search in a growing square until we find a pixel of opposite type
                // or reach the maximum distance
                for (let d = 0; d < maxDistance && minDist === maxDistance; d++) {
                    for (let dy = -d; dy <= d; dy++) {
                        for (let dx = -d; dx <= d; dx++) {
                            // Skip pixels that are further than d from the center
                            if (dx*dx + dy*dy > d*d) continue;
                            
                            const nx = x + dx;
                            const ny = y + dy;
                            
                            // Skip if out of bounds
                            if (nx < 0 || nx >= newWidth || ny < 0 || ny >= newHeight) continue;
                            
                            const nIndex = ny * newWidth + nx;
                            
                            // If we found a pixel of opposite type
                            if (mask[nIndex] !== isInside) {
                                // Calculate Euclidean distance
                                const dx2 = dx / newWidth;
                                const dy2 = dy / newHeight;
                                const dist = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                                minDist = Math.min(minDist, dist);
                            }
                        }
                    }
                }
                
                // Apply sign: negative if inside, positive if outside
                const signedDist = isInside ? -minDist : minDist;
                
                // Store the SDF value in all channels (R, G, B) and set alpha to 1
                const outIndex = index * 4;
                
                sdfData[outIndex] = signedDist;     // R
                sdfData[outIndex + 1] = signedDist; // G
                sdfData[outIndex + 2] = signedDist; // B
                sdfData[outIndex + 3] = 1;          // A (fully opaque)
            }
        }
        
        // Set up the new ImageProcessor with the SDF data
        sdfProcessor.imageData = sdfData;
        
        return sdfProcessor;
    }

    /**
     * Gets the dimensions of the image
     * @returns {Array} - [width, height]
     */
    getDimensions() {
        return [this.width, this.height];
    }
}

// Detect environment and export accordingly
(function() {
    const nodes = { ImageProcessor };
    
    // Check if we're in a module environment
    if (typeof exports !== 'undefined') {
        // Node.js or ES modules environment
        if (typeof module !== 'undefined' && module.exports) {
            // CommonJS (Node.js)
            Object.assign(module.exports, nodes);
        } else {
            // ES modules
            Object.keys(nodes).forEach(key => {
                exports[key] = nodes[key];
            });
        }
    } else if (typeof window !== 'undefined') {
        // Browser environment with script tags
        Object.keys(nodes).forEach(key => {
            window[key] = nodes[key];
        });
    }
})();
