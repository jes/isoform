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
                this.imageData = ctx.getImageData(0, 0, this.width, this.height).data;
                
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

    /**
     * Extracts a specific channel from the image
     * @param {string} channel - The channel to extract ('r', 'g', 'b', 'a', 'grayscale')
     * @returns {Float32Array} - Array of channel values normalized to 0-1 range
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
                    channelData[i] = this.imageData[baseIndex] / 255;
                    break;
                case 'g':
                    channelData[i] = this.imageData[baseIndex + 1] / 255;
                    break;
                case 'b':
                    channelData[i] = this.imageData[baseIndex + 2] / 255;
                    break;
                case 'a':
                    channelData[i] = this.imageData[baseIndex + 3] / 255;
                    break;
                case 'grayscale':
                    channelData[i] = (
                        this.imageData[baseIndex] + 
                        this.imageData[baseIndex + 1] + 
                        this.imageData[baseIndex + 2]
                    ) / 765;
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
            
            rgbData[outIndex] = this.imageData[baseIndex] / 255;         // R
            rgbData[outIndex + 1] = this.imageData[baseIndex + 1] / 255; // G
            rgbData[outIndex + 2] = this.imageData[baseIndex + 2] / 255; // B
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
