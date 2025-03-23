class Ifloat {
    constructor(...vals) {
        if (vals.length === 0) {
            throw new Error('Ifloat must be initialized with at least one value');
        }
        this.min = Math.min(...vals);
        this.max = Math.max(...vals);
    }

    static min(a, b) {
        return new Ifloat(Math.min(a.min, b.min), Math.min(a.max, b.max));
    }

    static max(a, b) {
        return new Ifloat(Math.max(a.min, b.min), Math.max(a.max, b.max));
    }

    static clamp(a, min, max) {
        return Ifloat.max(min, Ifloat.min(a, max));
    }

    static mix(a, b, t) {
        return a.mul(new Ifloat(1).sub(t)).add(b.mul(t));
    }

    static step(edge, x) {
        // step(edge, x) = 0 if x < edge, 1 if x >= edge
        const canBeZero = x.min < edge.max;
        const canBeOne = x.max >= edge.min;
        return new Ifloat(canBeZero ? 0 : 1, canBeOne ? 1 : 0);
    }

    containsZero() {
        return this.min <= 0 && this.max >= 0;
    }

    add(other) {
        return new Ifloat(this.min + other.min, this.max + other.max);
    }

    sub(other) {
        return new Ifloat(this.min - other.max, this.max - other.min);
    }

    mul(other) {
        return new Ifloat(this.min * other.min, this.max * other.max, this.min * other.max, this.max * other.min);
    }

    sqr() {
        if (this.min < 0) {
            return new Ifloat(0, Math.max(this.min * this.min, this.max * this.max));
        }
        return new Ifloat(this.min * this.min, this.max * this.max);
    }

    div(other) {
        if (other.containsZero()) {
            throw new Error('Division by interval that contains zero: ' + other.min + ',' + other.max);
        }
        return new Ifloat(this.min / other.max, this.max / other.min, this.min / other.min, this.max / other.max);
    }

    mod(other) {
        if (other.containsZero()) {
            throw new Error('Modulo by interval that contains zero: ' + other.min + ',' + other.max);
        }

        const d1 = this.min - other.min * Math.floor(this.min / other.min);
        const d2 = this.max - other.min * Math.floor(this.max / other.min);
        const d3 = this.min - other.max * Math.floor(this.min / other.max);
        const d4 = this.max - other.max * Math.floor(this.max / other.max);
        return new Ifloat(d1, d2, d3, d4);
    }

    sqrt() {
        if (this.min < 0) {
            throw new Error('Square root of interval that contains negative numbers: ' + this.min + ',' + this.max);
        }
        return new Ifloat(Math.sqrt(this.min), Math.sqrt(this.max));
    }

    abs() {
        return new Ifloat(Math.abs(this.min), Math.abs(this.max));
    }

    sin() {
        // If interval spans a full period or more, return [-1, 1]
        if (this.max - this.min >= 2 * Math.PI) {
            return new Ifloat(-1, 1);
        }

        // Normalize start point to [0, 2π)
        const twoPI = 2 * Math.PI;
        let start = this.min % twoPI;
        if (start < 0) start += twoPI;
        
        // Calculate end point maintaining the same interval width
        let end = start + (this.max - this.min);

        // Calculate sine at endpoints
        const sinStart = Math.sin(start);
        const sinEnd = Math.sin(end);

        let minVal = Math.min(sinStart, sinEnd);
        let maxVal = Math.max(sinStart, sinEnd);

        // Check if we cross π/2 (maximum) or 3π/2 (minimum)
        const crossesMax = start <= Math.PI/2 && end >= Math.PI/2;
        const crossesMin = start <= 3*Math.PI/2 && end >= 3*Math.PI/2;

        if (crossesMax) maxVal = 1;
        if (crossesMin) minVal = -1;

        return new Ifloat(minVal, maxVal);
    }

    cos() {
        // For cosine, we can shift the interval by -π/2 and compute sine
        // cos(x) = sin(x + π/2)
        return this.add(new Ifloat(Math.PI/2)).sin();
    }
}

// Detect environment and export accordingly
(function() {
    const nodes = { Ifloat };
    
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