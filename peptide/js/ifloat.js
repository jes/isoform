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

    div(other) {
        if (other.containsZero()) {
            throw new Error('Division by interval that contains zero');
        }
        return new Ifloat(this.min / other.max, this.max / other.min, this.min / other.min, this.max / other.max);
    }

    mod(other) {
        if (other.containsZero()) {
            throw new Error('Modulo by interval that contains zero');
        }
        return new Ifloat(this.min % other.max, this.max % other.min, this.min % other.min, this.max % other.max);
    }

    pow(other) {
        return new Ifloat(Math.pow(this.min, other.min), Math.pow(this.max, other.max), Math.pow(this.min, other.max), Math.pow(this.max, other.min));
    }

    sqrt() {
        if (this.min < 0) {
            throw new Error('Square root of interval that contains negative numbers');
        }
        return new Ifloat(Math.sqrt(this.min), Math.sqrt(this.max));
    }

    abs() {
        return new Ifloat(Math.abs(this.min), Math.abs(this.max));
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