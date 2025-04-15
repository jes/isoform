class ImageProcessor {
    constructor() {
        this.imageElement = null;
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
            this.imageElement = new window.Image();
            
            this.imageElement.onload = () => {
                this.width = this.imageElement.width;
                this.height = this.imageElement.height;
                
                // Create a canvas to extract pixel data
                const canvas = document.createElement('canvas');
                canvas.width = this.width;
                canvas.height = this.height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(this.imageElement, 0, 0);
                
                // Get the image data (RGBA values for each pixel)
                this.imageData = this.normalizeImageData(ctx.getImageData(0, 0, this.width, this.height).data);
                
                resolve(this);
            };
            
            this.imageElement.onerror = () => {
                reject(new Error('Failed to load image'));
            };
            
            // Handle different source types
            if (source instanceof File) {
                // Handle File object from file picker
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.imageElement.src = e.target.result;
                };
                reader.onerror = () => {
                    reject(new Error('Failed to read file'));
                };
                reader.readAsDataURL(source);
            } else if (typeof source === 'string') {
                // Handle URL or base64 string
                this.imageElement.src = source;
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
     * @returns {ImageProcessor} - A new ImageProcessor with the SDF data
     */
    toSDF() {
        if (!this.imageData) {
            throw new Error('No image data available. Load an image first.');
        }
        
        const pixelCount = this.width * this.height;
        const sdfProcessor = new ImageProcessor();
        sdfProcessor.width = this.width;
        sdfProcessor.height = this.height;
        
        // Create binary mask: true for inside (dark), false for outside (light)
        const mask = new Array(pixelCount);
        for (let i = 0; i < pixelCount; i++) {
            const baseIndex = i * 4; // RGBA = 4 channels
            const grayscale = (
                this.imageData[baseIndex] + 
                this.imageData[baseIndex + 1] + 
                this.imageData[baseIndex + 2]
            ) / 3;
            mask[i] = grayscale < 0.5;
        }
        
        // Initialize "nearest" arrays - each pixel is the location of the nearest boundary pixel
        const nearestX = new Float32Array(pixelCount).fill(Infinity);
        const nearestY = new Float32Array(pixelCount).fill(Infinity);
        
        // Initialize boundary pixels
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const index = y * this.width + x;
                const isInside = mask[index];
                
                // Check 4-neighborhood
                const neighbors = [
                    [x-1, y], [x+1, y], [x, y-1], [x, y+1]
                ];
                
                for (const [nx, ny] of neighbors) {
                    if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                        const nIndex = ny * this.width + nx;
                        if (mask[nIndex] !== isInside) {
                            nearestX[index] = nx;
                            nearestY[index] = ny;
                            break;
                        }
                    }
                }
            }
        }

        const squaredDistance = (x1, y1, x2, y2) => {
            const dx = x1 - x2;
            const dy = y1 - y2;
            return dx * dx + dy * dy;
        }

        const danielsson = (x, y) => {
            const index = y * this.width + x;
            const isInside = mask[index];
            
            // Skip if it's already a boundary pixel
            if (nearestX[index] === x && nearestY[index] === y) return;
            
            // Consider 4-neighborhood
            const neighbors = [
                [x-1, y], [x+1, y], [x, y-1], [x, y+1]
            ];

            let sqDist = squaredDistance(x, y, nearestX[index], nearestY[index]);
            
            for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const nIndex = ny * this.width + nx;

                    const targetX = nearestX[nIndex];
                    const targetY = nearestY[nIndex];
                    const targetIndex = targetY * this.width + targetX;
                    
                    // Only propagate from pixels of same type
                    if (mask[targetIndex] === isInside) {
                        const targetSqDist = squaredDistance(x, y, targetX, targetY);
                        
                        if (targetSqDist < sqDist) {
                            sqDist = targetSqDist;
                            nearestX[index] = targetX;
                            nearestY[index] = targetY;
                        }
                    }
                }
            }
        }

        // Danielsson's algorithm - Forward pass
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                danielsson(x, y);
            }
        }
        
        // Backward pass
        for (let y = this.height - 1; y >= 0; y--) {
            for (let x = this.width - 1; x >= 0; x--) {
                danielsson(x, y);
            }
        }
        
        // Normalize distances and create signed distance field
        const sdfData = new Float32Array(pixelCount * 4); // RGBA format
        
        // Normalization factor to keep distances in a reasonable range
        const maxDim = Math.max(this.width, this.height);
        const normFactor = 1.0 / maxDim;
        
        for (let i = 0; i < pixelCount; i++) {
            const isInside = mask[i];
            // Apply sign: negative if inside, positive if outside
            // and use the appropriate distance map
            let signedDist;

            const x = i % this.width;
            const y = Math.floor(i / this.width);

            // distance +1 because we marked a pixel on the boundary both inside and outside (is this right?)
            const dist = Math.sqrt(squaredDistance(x, y, nearestX[i], nearestY[i])) + 1.0;
            
            if (isInside) signedDist = -dist * normFactor;
            else signedDist = dist * normFactor;
            
            // Store the SDF value in all channels (R, G, B) and set alpha to 1
            const outIndex = i * 4;
            sdfData[outIndex] = signedDist;     // R
            sdfData[outIndex + 1] = signedDist; // G
            sdfData[outIndex + 2] = signedDist; // B
            sdfData[outIndex + 3] = 1;          // A (fully opaque)
        }
        
        // Create a canvas to store the SDF data
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(this.width, this.height);
        imageData.data.set(sdfData);
        ctx.putImageData(imageData, 0, 0);
        
        // Set up the new ImageProcessor with the SDF data
        sdfProcessor.imageData = sdfData;
        sdfProcessor.imageElement = new window.Image();
        sdfProcessor.imageElement.src = canvas.toDataURL();
        
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
