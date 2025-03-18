class Peptide {
    constructor(op, type, value = null, left = null, right = null, third = null, opFn = null) {
        this.op = op;          // Operation name (e.g., 'const', 'vconst', 'vadd', etc.)
        this.type = type;      // 'float' or 'vec3'
        this.value = value;    // for constants
        this.left = left;      // left operand
        this.right = right;    // right operand
        this.third = third;    // third operand
        this.opFn = opFn;      // operation function
    }

    assertType(expectedType) {
        if (this.type !== expectedType) {
            throw new Error(`Expected type '${expectedType}' but got '${this.type}' for operation '${this.op}'`);
        }
        return this;
    }

    // Scalar operations
    static const(value) {
        return new Peptide('const', 'float', value, null, null, null,
            (_, vars) => value);
    }

    static var(name) {
        return new Peptide('var', 'float', name, null, null, null,
            (self, vars) => {
                if (!(self.value in vars)) {
                    throw new Error(`Variable '${self.value}' not found`);
                }
                return vars[self.value];
            });
    }

    // Vector operations
    static vconst(vec3) {
        return new Peptide('vconst', 'vec3', vec3, null, null, null,
            (_, vars) => vec3);
    }

    static vvar(name) {
        return new Peptide('vvar', 'vec3', name, null, null, null,
            (self, vars) => {
                if (!(self.value in vars)) {
                    throw new Error(`Vector variable '${self.value}' not found`);
                }
                return vars[self.value];
            });
    }

    static vadd(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vadd', 'vec3', null, a, b, null,
            (self, vars) => self.left.evaluate(vars).add(self.right.evaluate(vars)));
    }

    static vsub(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vsub', 'vec3', null, a, b, null,
            (self, vars) => self.left.evaluate(vars).sub(self.right.evaluate(vars)));
    }

    static vmul(a, b) {
        a.assertType('vec3');
        b.assertType('float');
        return new Peptide('vmul', 'vec3', null, a, b, null,
            (self, vars) => self.left.evaluate(vars).mul(self.right.evaluate(vars)));
    }

    static vdiv(a, b) {
        a.assertType('vec3');
        b.assertType('float');
        return new Peptide('vdiv', 'vec3', null, a, b, null,
            (self, vars) => self.left.evaluate(vars).div(self.right.evaluate(vars)));
    }

    static vlength(a) {
        a.assertType('vec3');
        return new Peptide('vlength', 'float', null, a, null, null,
            (self, vars) => self.left.evaluate(vars).length());
    }

    static vdot(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vdot', 'float', null, a, b, null,
            (self, vars) => self.left.evaluate(vars).dot(self.right.evaluate(vars)));
    }

    static vcross(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vcross', 'vec3', null, a, b, null,
            (self, vars) => self.left.evaluate(vars).cross(self.right.evaluate(vars)));
    }

    static vec3(a, b, c) {
        a.assertType('float');
        b.assertType('float');
        c.assertType('float');
        return new Peptide('vec3', 'vec3', null, a, b, c,
            (self, vars) => new Vec3(self.left.evaluate(vars), self.right.evaluate(vars), self.third.evaluate(vars)));
    }

    static add(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('add', 'float', null, a, b, null,
            (self, vars) => self.left.evaluate(vars) + self.right.evaluate(vars));
    }

    static sub(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('sub', 'float', null, a, b, null,
            (self, vars) => self.left.evaluate(vars) - self.right.evaluate(vars));
    }

    static mul(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('mul', 'float', null, a, b, null,
            (self, vars) => self.left.evaluate(vars) * self.right.evaluate(vars));
    }

    static div(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('div', 'float', null, a, b, null,
            (self, vars) => self.left.evaluate(vars) / self.right.evaluate(vars));
    }

    static min(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('min', 'float', null, a, b, null,
            (self, vars) => Math.min(self.left.evaluate(vars), self.right.evaluate(vars)));
    }

    static max(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('max', 'float', null, a, b, null,
            (self, vars) => Math.max(self.left.evaluate(vars), self.right.evaluate(vars)));
    }

    static pow(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('pow', 'float', null, a, b, null,
            (self, vars) => Math.pow(self.left.evaluate(vars), self.right.evaluate(vars)));
    }

    static sqrt(a) {
        a.assertType('float');
        return new Peptide('sqrt', 'float', null, a, null, null,
            (self, vars) => Math.sqrt(self.left.evaluate(vars)));
    }

    evaluate(vars) {
        const result = this.opFn(this, vars);
        if (this.type === 'float') {
            if (typeof result !== 'number') {
                throw new Error(`Operation '${this.op}' returned ${typeof result} but declared float type`);
            }
        } else if (this.type === 'vec3') {
            if (!(result instanceof Vec3)) {
                throw new Error(`Operation '${this.op}' returned ${typeof result} but declared vec3 type`);
            }
        }
        return result;
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
