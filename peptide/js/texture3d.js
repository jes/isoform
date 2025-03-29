class Texture3D {
    constructor(data, dimensions, interpolation = 'linear') {
        this.data = data;
        this.dimensions = dimensions; // [width, height, depth]
        this.interpolation = interpolation;
    }
    
    getIndex(x, y, z) {
        const [width, height, depth] = this.dimensions;
        
        // Convert from 0..1 range to texture dimensions
        const ix = Math.floor(x * width);
        const iy = Math.floor(y * height);
        const iz = Math.floor(z * depth);
        
        // Clamp coordinates to valid range
        const clampedX = Math.max(0, Math.min(width - 1, ix));
        const clampedY = Math.max(0, Math.min(height - 1, iy));
        const clampedZ = Math.max(0, Math.min(depth - 1, iz));
        
        return (clampedZ * width * height) + (clampedY * width) + clampedX;
    }
    
    getValue(x, y, z) {
        const index = this.getIndex(x, y, z);
        return this.data[index];
    }
    
    sample(position) {
        const [width, height, depth] = this.dimensions;
        
        // Extract coordinates from Vec3
        const x = position.x;
        const y = position.y;
        const z = position.z;
        
        // Ensure coordinates are in 0..1 range
        const clampedX = Math.max(0, Math.min(1, x));
        const clampedY = Math.max(0, Math.min(1, y));
        const clampedZ = Math.max(0, Math.min(1, z));
        
        if (this.interpolation === 'nearest') {
            // Nearest neighbor interpolation
            return this.getValue(clampedX, clampedY, clampedZ);
        } else {
            // Linear (trilinear) interpolation
            const fx = clampedX * width - 0.5;
            const fy = clampedY * height - 0.5;
            const fz = clampedZ * depth - 0.5;
            
            const x0 = Math.floor(fx);
            const y0 = Math.floor(fy);
            const z0 = Math.floor(fz);
            
            const x1 = Math.min(x0 + 1, width - 1);
            const y1 = Math.min(y0 + 1, height - 1);
            const z1 = Math.min(z0 + 1, depth - 1);
            
            const wx = fx - x0;
            const wy = fy - y0;
            const wz = fz - z0;
            
            // Convert back to 0..1 range for getValue
            const v000 = this.getValue(x0/width, y0/height, z0/depth);
            const v001 = this.getValue(x0/width, y0/height, z1/depth);
            const v010 = this.getValue(x0/width, y1/height, z0/depth);
            const v011 = this.getValue(x0/width, y1/height, z1/depth);
            const v100 = this.getValue(x1/width, y0/height, z0/depth);
            const v101 = this.getValue(x1/width, y0/height, z1/depth);
            const v110 = this.getValue(x1/width, y1/height, z0/depth);
            const v111 = this.getValue(x1/width, y1/height, z1/depth);
            
            // Interpolate along x
            const v00 = v000 * (1 - wx) + v100 * wx;
            const v01 = v001 * (1 - wx) + v101 * wx;
            const v10 = v010 * (1 - wx) + v110 * wx;
            const v11 = v011 * (1 - wx) + v111 * wx;
            
            // Interpolate along y
            const v0 = v00 * (1 - wy) + v10 * wy;
            const v1 = v01 * (1 - wy) + v11 * wy;
            
            // Interpolate along z
            return v0 * (1 - wz) + v1 * wz;
        }
    }
    
    sampleInterval(positionInterval) {
        const [width, height, depth] = this.dimensions;
        const [xInterval, yInterval, zInterval] = positionInterval;
        
        // Clamp intervals to 0..1 range
        const clampedXInterval = new Ifloat(
            Math.max(0, xInterval.min),
            Math.min(1, xInterval.max)
        );
        const clampedYInterval = new Ifloat(
            Math.max(0, yInterval.min),
            Math.min(1, yInterval.max)
        );
        const clampedZInterval = new Ifloat(
            Math.max(0, zInterval.min),
            Math.min(1, zInterval.max)
        );
        
        // Convert to texture space
        const xMin = Math.max(0, Math.floor(clampedXInterval.min * width));
        const xMax = Math.min(width - 1, Math.ceil(clampedXInterval.max * width));
        const yMin = Math.max(0, Math.floor(clampedYInterval.min * height));
        const yMax = Math.min(height - 1, Math.ceil(clampedYInterval.max * height));
        const zMin = Math.max(0, Math.floor(clampedZInterval.min * depth));
        const zMax = Math.min(depth - 1, Math.ceil(clampedZInterval.max * depth));
        
        // Find min and max values in the covered region
        let minValue = Infinity;
        let maxValue = -Infinity;
        
        for (let z = zMin; z <= zMax; z++) {
            for (let y = yMin; y <= yMax; y++) {
                for (let x = xMin; x <= xMax; x++) {
                    // Convert back to 0..1 range for getValue
                    const value = this.getValue(x/width, y/height, z/depth);
                    minValue = Math.min(minValue, value);
                    maxValue = Math.max(maxValue, value);
                }
            }
        }
        
        return new Ifloat(minValue, maxValue);
    }
    
    sampleVec(position) {
        const [width, height, depth] = this.dimensions;

        const x = position.x;
        const y = position.y;
        const z = position.z;
        
        // Ensure coordinates are in 0..1 range
        const clampedX = Math.max(0, Math.min(1, x));
        const clampedY = Math.max(0, Math.min(1, y));
        const clampedZ = Math.max(0, Math.min(1, z));
        
        if (this.interpolation === 'nearest') {
            // Nearest neighbor interpolation
            const index = this.getIndex(clampedX, clampedY, clampedZ);
            return new Vec3(
                this.data[index * 3],
                this.data[index * 3 + 1],
                this.data[index * 3 + 2]
            );
        } else {
            // Linear (trilinear) interpolation
            const fx = clampedX * width - 0.5;
            const fy = clampedY * height - 0.5;
            const fz = clampedZ * depth - 0.5;
            
            const x0 = Math.floor(fx);
            const y0 = Math.floor(fy);
            const z0 = Math.floor(fz);
            
            const x1 = Math.min(x0 + 1, width - 1);
            const y1 = Math.min(y0 + 1, height - 1);
            const z1 = Math.min(z0 + 1, depth - 1);
            
            const wx = fx - x0;
            const wy = fy - y0;
            const wz = fz - z0;
            
            // Get vector values at each corner
            const getVec = (x, y, z) => {
                const index = this.getIndex(x/width, y/height, z/depth);
                return new Vec3(
                    this.data[index * 3],
                    this.data[index * 3 + 1],
                    this.data[index * 3 + 2]
                );
            };
            
            const v000 = getVec(x0, y0, z0);
            const v001 = getVec(x0, y0, z1);
            const v010 = getVec(x0, y1, z0);
            const v011 = getVec(x0, y1, z1);
            const v100 = getVec(x1, y0, z0);
            const v101 = getVec(x1, y0, z1);
            const v110 = getVec(x1, y1, z0);
            const v111 = getVec(x1, y1, z1);
            
            // Interpolate along x
            const v00 = v000.mul(1 - wx).add(v100.mul(wx));
            const v01 = v001.mul(1 - wx).add(v101.mul(wx));
            const v10 = v010.mul(1 - wx).add(v110.mul(wx));
            const v11 = v011.mul(1 - wx).add(v111.mul(wx));
            
            // Interpolate along y
            const v0 = v00.mul(1 - wy).add(v10.mul(wy));
            const v1 = v01.mul(1 - wy).add(v11.mul(wy));
            
            // Interpolate along z
            return v0.mul(1 - wz).add(v1.mul(wz));
        }
    }
    
    sampleVecInterval(positionInterval) {
        const [width, height, depth] = this.dimensions;
        const [xInterval, yInterval, zInterval] = positionInterval;
        
        // Clamp intervals to 0..1 range
        const clampedXInterval = new Ifloat(
            Math.max(0, xInterval.min),
            Math.min(1, xInterval.max)
        );
        const clampedYInterval = new Ifloat(
            Math.max(0, yInterval.min),
            Math.min(1, yInterval.max)
        );
        const clampedZInterval = new Ifloat(
            Math.max(0, zInterval.min),
            Math.min(1, zInterval.max)
        );
        
        // Convert to texture space
        const xMin = Math.max(0, Math.floor(clampedXInterval.min * width));
        const xMax = Math.min(width - 1, Math.ceil(clampedXInterval.max * width));
        const yMin = Math.max(0, Math.floor(clampedYInterval.min * height));
        const yMax = Math.min(height - 1, Math.ceil(clampedYInterval.max * height));
        const zMin = Math.max(0, Math.floor(clampedZInterval.min * depth));
        const zMax = Math.min(depth - 1, Math.ceil(clampedZInterval.max * depth));
        
        // Find min and max values for each component
        let xMinValue = Infinity, xMaxValue = -Infinity;
        let yMinValue = Infinity, yMaxValue = -Infinity;
        let zMinValue = Infinity, zMaxValue = -Infinity;
        
        for (let z = zMin; z <= zMax; z++) {
            for (let y = yMin; y <= yMax; y++) {
                for (let x = xMin; x <= xMax; x++) {
                    const index = this.getIndex(x/width, y/height, z/depth);
                    
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
    const nodes = { Texture3D };
    
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
