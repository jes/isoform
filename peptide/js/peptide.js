class Peptide {
    constructor(op, value = null, left = null, right = null) {
        this.op = op;      // 'const', 'add', 'sub', 'mul', 'div'
        this.value = value;    // for constants
        this.left = left;      // left operand
        this.right = right;    // right operand
    }

    // Static methods for expression construction
    static const(value) {
        return new Peptide('const', value);
    }

    static var(name) {
        return new Peptide('var', name);
    }

    static add(a, b) {
        return new Peptide('add', null, a, b);
    }

    static sub(a, b) {
        return new Peptide('sub', null, a, b);
    }

    static mul(a, b) {
        return new Peptide('mul', null, a, b);
    }

    static div(a, b) {
        return new Peptide('div', null, a, b);
    }

    evaluate(vars) {
        if (this.op === 'const') {
            return this.value;
        } else if (this.op === 'var') {
            if (!(this.value in vars)) {
                throw new Error(`Variable '${this.value}' not found`);
            }
            return vars[this.value];
        } else if (this.op === 'add') {
            return this.left.evaluate(vars) + this.right.evaluate(vars);
        } else if (this.op === 'sub') {
            return this.left.evaluate(vars) - this.right.evaluate(vars);
        } else if (this.op === 'mul') {
            return this.left.evaluate(vars) * this.right.evaluate(vars);
        } else if (this.op === 'div') {
            return this.left.evaluate(vars) / this.right.evaluate(vars);
        }
    }
}

// Create global P variable
const P = Peptide;

// Detect environment and export accordingly
(function() {
    const nodes = { Peptide, P };
    
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
