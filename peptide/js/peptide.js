class Peptide {
    constructor(op, value = null, left = null, right = null, opFn = null) {
        this.op = op;      // 'const', 'add', 'sub', 'mul', 'div'
        this.value = value;    // for constants
        this.left = left;      // left operand
        this.right = right;    // right operand
        this.opFn = opFn;      // operation function
    }

    // Static methods for expression construction
    static const(value) {
        return new Peptide('const', value, null, null, 
            (_, vars) => value);
    }

    static var(name) {
        return new Peptide('var', name, null, null, 
            (self, vars) => {
                if (!(self.value in vars)) {
                    throw new Error(`Variable '${self.value}' not found`);
                }
                return vars[self.value];
            });
    }

    static add(a, b) {
        return new Peptide('add', null, a, b, 
            (self, vars) => self.left.evaluate(vars) + self.right.evaluate(vars));
    }

    static sub(a, b) {
        return new Peptide('sub', null, a, b, 
            (self, vars) => self.left.evaluate(vars) - self.right.evaluate(vars));
    }

    static mul(a, b) {
        return new Peptide('mul', null, a, b, 
            (self, vars) => self.left.evaluate(vars) * self.right.evaluate(vars));
    }

    static div(a, b) {
        return new Peptide('div', null, a, b, 
            (self, vars) => self.left.evaluate(vars) / self.right.evaluate(vars));
    }

    static min(a, b) {
        return new Peptide('min', null, a, b, 
            (self, vars) => Math.min(self.left.evaluate(vars), self.right.evaluate(vars)));
    }

    static max(a, b) {
        return new Peptide('max', null, a, b, 
            (self, vars) => Math.max(self.left.evaluate(vars), self.right.evaluate(vars)));
    }

    static pow(a, b) {
        return new Peptide('pow', null, a, b, 
            (self, vars) => Math.pow(self.left.evaluate(vars), self.right.evaluate(vars)));
    }

    static sqrt(a) {
        return new Peptide('sqrt', null, a, null, 
            (self, vars) => Math.sqrt(self.left.evaluate(vars)));
    }

    evaluate(vars) {
        return this.opFn(this, vars);
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
