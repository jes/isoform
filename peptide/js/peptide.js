class Peptide {
    constructor(op, type, value = null, left = null, right = null, third = null, opFn = null, ssaOpFn = null, glslOpFn = null) {
        this.op = op;          // Operation name (e.g., 'const', 'vconst', 'vadd', etc.)
        this.type = type;      // 'float' or 'vec3'
        this.value = value;    // for constants
        this.left = left;      // left operand
        this.right = right;    // right operand
        this.third = third;    // third operand
        this.opFn = opFn;      // operation function
        this.ssaOpFn = ssaOpFn;    // SSA operation function
        this.glslOpFn = glslOpFn;    // GLSL operation function

        if (!opFn) {
            console.warn(`No operation function provided for ${op}`, this);
        }
        if (!ssaOpFn) {
            console.warn(`No SSA operation function provided for ${op}`, this);
        }
        if (!glslOpFn) {
            console.warn(`No GLSL operation function provided for ${op}`, this);
        }
    }

    assertType(expectedType) {
        if (this.type !== expectedType) {
            throw new Error(`Expected type '${expectedType}' but got '${this.type}' for operation '${this.op}'`);
        }
        return this;
    }

    // Scalar operations
    static const(value) {
        if (typeof value !== 'number') {
            throw new Error(`Const expected number but got ${typeof value}`);
        }
        return new Peptide('const', 'float', value, null, null, null,
            (_, vars) => value,
            (self, ssaOp) => `${ssaOp.result} = ${self.value};`,
            (self, glslOp) => `${glslOp.result} = ${self.value.toFixed(16)};`,
        );
    }

    static var(name) {
        return new Peptide('var', 'float', name, null, null, null,
            (self, vars) => {
                if (!(self.value in vars)) {
                    throw new Error(`Variable '${self.value}' not found`);
                }
                return vars[self.value];
            },
            (self, ssaOp) => {
                return `if (!('${self.value}' in vars)) throw new Error("Variable '${self.value}' not found");\n`
                    + `  ${ssaOp.result} = vars['${self.value}'];`;
            },
            (self, glslOp) => `${glslOp.result} = ${self.value};`,
        );
    }

    // Vector operations
    static vconst(vec3) {
        if (!(vec3 instanceof Vec3)) {
            throw new Error(`Vconst expected Vec3 but got ${vec3?.constructor?.name || typeof vec3}`);
        }
        // Deep clone the Vec3
        return new Peptide('vconst', 'vec3', new Vec3(vec3.x, vec3.y, vec3.z), null, null, null,
            (self, vars) => new Vec3(self.value.x, self.value.y, self.value.z),
            (self, ssaOp) => `${ssaOp.result} = new Vec3(${self.value.x}, ${self.value.y}, ${self.value.z});`,
            (self, glslOp) => `${glslOp.result} = vec3(${self.value.x.toFixed(16)}, ${self.value.y.toFixed(16)}, ${self.value.z.toFixed(16)});`,
        );
    }

    static vvar(name) {
        return new Peptide('vvar', 'vec3', name, null, null, null,
            (self, vars) => {
                if (!(self.value in vars)) {
                    throw new Error(`Vector variable '${self.value}' not found`);
                }
                return vars[self.value];
            },
            (self, ssaOp) => {
                return `if (!('${self.value}' in vars)) throw new Error("Vector variable '${self.value}' not found");\n`
                    + `  ${ssaOp.result} = vars['${self.value}'];`;
            },
            (self, glslOp) => `${glslOp.result} = ${self.value};`,
        );
    }
    static vadd(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vadd', 'vec3', null, a, b, null,
            (self, vars) => self.left.evaluate(vars).add(self.right.evaluate(vars)),
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.add(${ssaOp.right});`,
            (self, glslOp) => `${glslOp.result} = ${glslOp.left} + ${glslOp.right};`,
        );
    }

    static vsub(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vsub', 'vec3', null, a, b, null,
            (self, vars) => self.left.evaluate(vars).sub(self.right.evaluate(vars)),
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.sub(${ssaOp.right});`,
            (self, glslOp) => `${glslOp.result} = ${glslOp.left} - ${glslOp.right};`,
        );
    }

    static vmul(a, b) {
        a.assertType('vec3');
        b.assertType('float');
        return new Peptide('vmul', 'vec3', null, a, b, null,
            (self, vars) => self.left.evaluate(vars).mul(self.right.evaluate(vars)),
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mul(${ssaOp.right});`,
            (self, glslOp) => `${glslOp.result} = ${glslOp.left} * ${glslOp.right};`,
        );
    }

    static vdiv(a, b) {
        a.assertType('vec3');
        b.assertType('float');
        return new Peptide('vdiv', 'vec3', null, a, b, null,
            (self, vars) => self.left.evaluate(vars).div(self.right.evaluate(vars)),
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.div(${ssaOp.right});`,
            (self, glslOp) => `${glslOp.result} = ${glslOp.left} / ${glslOp.right};`,
        );
    }

    static vlength(a) {
        a.assertType('vec3');
        return new Peptide('vlength', 'float', null, a, null, null,
            (self, vars) => self.left.evaluate(vars).length(),
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.length();`,
            (self, glslOp) => `${glslOp.result} = length(${glslOp.left});`,
        );
    }

    static vdot(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vdot', 'float', null, a, b, null,
            (self, vars) => self.left.evaluate(vars).dot(self.right.evaluate(vars)),
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.dot(${ssaOp.right});`,
            (self, glslOp) => `${glslOp.result} = dot(${glslOp.left}, ${glslOp.right});`,
        );
    }

    static vcross(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vcross', 'vec3', null, a, b, null,
            (self, vars) => self.left.evaluate(vars).cross(self.right.evaluate(vars)),
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.cross(${ssaOp.right});`,
            (self, glslOp) => `${glslOp.result} = cross(${glslOp.left}, ${glslOp.right});`,
        );
    }

    static vec3(a, b, c) {
        a.assertType('float');
        b.assertType('float');
        c.assertType('float');
        return new Peptide('vec3', 'vec3', null, a, b, c,
            (self, vars) => new Vec3(self.left.evaluate(vars), self.right.evaluate(vars), self.third.evaluate(vars)),
            (self, ssaOp) => `${ssaOp.result} = new Vec3(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
            (self, glslOp) => `${glslOp.result} = vec3(${glslOp.left}, ${glslOp.right}, ${glslOp.third});`,
        );
    }

    static add(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('add', 'float', null, a, b, null,
            (self, vars) => self.left.evaluate(vars) + self.right.evaluate(vars),
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left} + ${ssaOp.right};`,
            (self, glslOp) => `${glslOp.result} = ${glslOp.left} + ${glslOp.right};`,
        );
    }

    static sub(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('sub', 'float', null, a, b, null,
            (self, vars) => self.left.evaluate(vars) - self.right.evaluate(vars),
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left} - ${ssaOp.right};`,
            (self, glslOp) => `${glslOp.result} = ${glslOp.left} - ${glslOp.right};`,
        );
    }

    static mul(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('mul', 'float', null, a, b, null,
            (self, vars) => self.left.evaluate(vars) * self.right.evaluate(vars),
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
            (self, glslOp) => `${glslOp.result} = ${glslOp.left} * ${glslOp.right};`,
        );
    }

    static div(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('div', 'float', null, a, b, null,
            (self, vars) => self.left.evaluate(vars) / self.right.evaluate(vars),
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left} / ${ssaOp.right};`,
            (self, glslOp) => `${glslOp.result} = ${glslOp.left} / ${glslOp.right};`,
        );
    }

    static min(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('min', 'float', null, a, b, null,
            (self, vars) => Math.min(self.left.evaluate(vars), self.right.evaluate(vars)),
            (self, ssaOp) => `${ssaOp.result} = Math.min(${ssaOp.left}, ${ssaOp.right});`,
            (self, glslOp) => `${glslOp.result} = min(${glslOp.left}, ${glslOp.right});`,
        );
    }

    static max(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('max', 'float', null, a, b, null,
            (self, vars) => Math.max(self.left.evaluate(vars), self.right.evaluate(vars)),
            (self, ssaOp) => `${ssaOp.result} = Math.max(${ssaOp.left}, ${ssaOp.right});`,
            (self, glslOp) => `${glslOp.result} = max(${glslOp.left}, ${glslOp.right});`,
        );
    }

    static pow(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('pow', 'float', null, a, b, null,
            (self, vars) => Math.pow(self.left.evaluate(vars), self.right.evaluate(vars)),
            (self, ssaOp) => `${ssaOp.result} = Math.pow(${ssaOp.left}, ${ssaOp.right});`,
            (self, glslOp) => `${glslOp.result} = pow(${glslOp.left}, ${glslOp.right});`,
        );
    }

    static sqrt(a) {
        a.assertType('float');
        return new Peptide('sqrt', 'float', null, a, null, null,
            (self, vars) => Math.sqrt(self.left.evaluate(vars)),
            (self, ssaOp) => `${ssaOp.result} = Math.sqrt(${ssaOp.left});`,
            (self, glslOp) => `${glslOp.result} = sqrt(${glslOp.left});`,
        );
    }

    static vecX(a) {
        a.assertType('vec3');
        return new Peptide('vecX', 'float', null, a, null, null,
            (self, vars) => self.left.evaluate(vars).x,
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.x;`,
            (self, glslOp) => `${glslOp.result} = ${glslOp.left}.x;`,
        );
    }
    
    static vecY(a) {
        a.assertType('vec3');
        return new Peptide('vecY', 'float', null, a, null, null,
            (self, vars) => self.left.evaluate(vars).y,
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.y;`,
            (self, glslOp) => `${glslOp.result} = ${glslOp.left}.y;`,
        );
    }
    
    static vecZ(a) {
        a.assertType('vec3');
        return new Peptide('vecZ', 'float', null, a, null, null,
            (self, vars) => self.left.evaluate(vars).z,
            (self, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.z;`,
            (self, glslOp) => `${glslOp.result} = ${glslOp.left}.z;`,
        );
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
