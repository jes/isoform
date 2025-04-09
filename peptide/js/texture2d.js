class Texture2D {
    constructor(data, dimensions, interpolation = 'linear') {
        this.data = data;
        this.dimensions = dimensions; // [width, height]
        this.interpolation = interpolation;
    }
    
    getIndex(x, y) {
        const [width, height] = this.dimensions;
        
        // Convert from 0..1 range to texture dimensions
        const ix = Math.floor(x * width);
        const iy = Math.floor(y * height);
        
        // Clamp coordinates to valid range
        const clampedX = Math.max(0, Math.min(width - 1, ix));
        const clampedY = Math.max(0, Math.min(height - 1, iy));
        
        return (clampedY * width) + clampedX;
    }
    
    getValue(x, y) {
        const index = this.getIndex(x, y);
        return this.data[index];
    }
    
    sample(position) {
        const [width, height] = this.dimensions;
        
        // Extract coordinates from Vec2 or Vec3
        const x = position.x;
        const y = position.y;
        
        // Ensure coordinates are in 0..1 range
        const clampedX = Math.max(0, Math.min(1, x));
        const clampedY = Math.max(0, Math.min(1, y));
        
        if (this.interpolation === 'nearest') {
            // Nearest neighbor interpolation
            return this.getValue(clampedX, clampedY);
        } else {
            // Linear (bilinear) interpolation
            const fx = clampedX * width - 0.5;
            const fy = clampedY * height - 0.5;
            
            const x0 = Math.floor(fx);
            const y0 = Math.floor(fy);
            
            const x1 = Math.min(x0 + 1, width - 1);
            const y1 = Math.min(y0 + 1, height - 1);
            
            const wx = fx - x0;
            const wy = fy - y0;
            
            // Convert back to 0..1 range for getValue
            const v00 = this.getValue(x0/width, y0/height);
            const v01 = this.getValue(x0/width, y1/height);
            const v10 = this.getValue(x1/width, y0/height);
            const v11 = this.getValue(x1/width, y1/height);
            
            // Interpolate along x
            const v0 = v00 * (1 - wx) + v10 * wx;
            const v1 = v01 * (1 - wx) + v11 * wx;
            
            // Interpolate along y
            return v0 * (1 - wy) + v1 * wy;
        }
    }
    
    sampleInterval(positionInterval) {
        const [width, height] = this.dimensions;
        const [xInterval, yInterval] = positionInterval;
        
        // Clamp intervals to 0..1 range
        const clampedXInterval = new Ifloat(
            Math.max(0, xInterval.min),
            Math.min(1, xInterval.max)
        );
        const clampedYInterval = new Ifloat(
            Math.max(0, yInterval.min),
            Math.min(1, yInterval.max)
        );
        
        // Convert to texture space
        const xMin = Math.max(0, Math.floor(clampedXInterval.min * width));
        const xMax = Math.min(width - 1, Math.ceil(clampedXInterval.max * width));
        const yMin = Math.max(0, Math.floor(clampedYInterval.min * height));
        const yMax = Math.min(height - 1, Math.ceil(clampedYInterval.max * height));
        
        // Find min and max values in the covered region
        let minValue = Infinity;
        let maxValue = -Infinity;
        
        for (let y = yMin; y <= yMax; y++) {
            for (let x = xMin; x <= xMax; x++) {
                // Convert back to 0..1 range for getValue
                const value = this.getValue(x/width, y/height);
                minValue = Math.min(minValue, value);
                maxValue = Math.max(maxValue, value);
            }
        }
        
        return new Ifloat(minValue, maxValue);
    }
    
    sampleVec(position) {
        const [width, height] = this.dimensions;

        const x = position.x;
        const y = position.y;
        
        // Ensure coordinates are in 0..1 range
        const clampedX = Math.max(0, Math.min(1, x));
        const clampedY = Math.max(0, Math.min(1, y));
        
        if (this.interpolation === 'nearest') {
            // Nearest neighbor interpolation
            const index = this.getIndex(clampedX, clampedY);
            return new Vec3(
                this.data[index * 3],
                this.data[index * 3 + 1],
                this.data[index * 3 + 2]
            );
        } else {
            // Linear (bilinear) interpolation
            const fx = clampedX * width - 0.5;
            const fy = clampedY * height - 0.5;
            
            const x0 = Math.floor(fx);
            const y0 = Math.floor(fy);
            
            const x1 = Math.min(x0 + 1, width - 1);
            const y1 = Math.min(y0 + 1, height - 1);
            
            const wx = fx - x0;
            const wy = fy - y0;
            
            // Get vector values at each corner
            const getVec = (x, y) => {
                const index = this.getIndex(x/width, y/height);
                return new Vec3(
                    this.data[index * 3],
                    this.data[index * 3 + 1],
                    this.data[index * 3 + 2]
                );
            };
            
            const v00 = getVec(x0, y0);
            const v01 = getVec(x0, y1);
            const v10 = getVec(x1, y0);
            const v11 = getVec(x1, y1);
            
            // Interpolate along x
            const v0 = v00.mul(1 - wx).add(v10.mul(wx));
            const v1 = v01.mul(1 - wx).add(v11.mul(wx));
            
            // Interpolate along y
            return v0.mul(1 - wy).add(v1.mul(wy));
        }
    }
    
    sampleVecInterval(positionInterval) {
        const [width, height] = this.dimensions;
        const [xInterval, yInterval] = positionInterval;
        
        // Clamp intervals to 0..1 range
        const clampedXInterval = new Ifloat(
            Math.max(0, xInterval.min),
            Math.min(1, xInterval.max)
        );
        const clampedYInterval = new Ifloat(
            Math.max(0, yInterval.min),
            Math.min(1, yInterval.max)
        );
        
        // Convert to texture space
        const xMin = Math.max(0, Math.floor(clampedXInterval.min * width));
        const xMax = Math.min(width - 1, Math.ceil(clampedXInterval.max * width));
        const yMin = Math.max(0, Math.floor(clampedYInterval.min * height));
        const yMax = Math.min(height - 1, Math.ceil(clampedYInterval.max * height));
        
        // Find min and max values for each component
        let xMinValue = Infinity, xMaxValue = -Infinity;
        let yMinValue = Infinity, yMaxValue = -Infinity;
        let zMinValue = Infinity, zMaxValue = -Infinity;
        
        for (let y = yMin; y <= yMax; y++) {
            for (let x = xMin; x <= xMax; x++) {
                const index = this.getIndex(x/width, y/height);
                
                // X component
                const xValue = this.data[index * 3];
                xMinValue = Math.min(xMinValue, xValue);
                xMaxValue = Math.max(xMaxValue, xValue);
                
                // Y component
                const yValue = this.data[index * 3 + 1];
                yMinValue = Math.min(yMinValue, yValue);
                yMaxValue = Math.max(yMaxValue, yValue);
                
                // Z component
                const zValue = this.data[index * 3 + 2];
                zMinValue = Math.min(zMinValue, zValue);
                zMaxValue = Math.max(zMaxValue, zValue);
            }
        }
        
        return new Ivec3(
            new Ifloat(xMinValue, xMaxValue),
            new Ifloat(yMinValue, yMaxValue),
            new Ifloat(zMinValue, zMaxValue)
        );
    }
}

// Detect environment and export accordingly
(function() {
    const nodes = { Texture2D };
    
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
