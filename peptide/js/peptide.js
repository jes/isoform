class Peptide {
    constructor(op, type, value = null, left = null, right = null, third = null, opFn = null, ssaOpFn = null, glslOpFn = null) {
        this.op = op;          // Operation name (e.g., 'const', 'vconst', 'vadd', etc.)
        this.type = type;      // 'float' or 'vec3'
        this.value = value;    // value for constant operations, name for variables
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
            throw new Error(`Expected type '${expectedType}' but got '${this.type}' for result of '${this.op}'`);
        }
        return this;
    }

    // Scalar operations
    static const(value) {
        if (typeof value !== 'number') {
            throw new Error(`const expected number but got ${typeof value}`);
        }
        return new Peptide('const', 'float', value, null, null, null,
            (_, vars) => value,
            (_, ssaOp) => `${ssaOp.result} = ${value};`,
            (_, ssaOp) => `${ssaOp.result} = ${value.toFixed(16)};`,
        );
    }

    static var(name) {
        return new Peptide('var', 'float', name, null, null, null,
            (_, vars) => {
                if (!(name in vars)) {
                    throw new Error(`Variable '${name}' not found`);
                }
                return vars[name];
            },
            (_, ssaOp) => {
                return `if (!('${name}' in vars)) throw new Error("Variable '${name}' not found");\n`
                    + `  ${ssaOp.result} = vars['${name}'];`;
            },
            (_, ssaOp) => `${ssaOp.result} = ${name};`,
        );
    }

    // Vector operations
    static vconst(vec3) {
        if (!(vec3 instanceof Vec3)) {
            throw new Error(`vconst expected Vec3 but got ${vec3?.constructor?.name || typeof vec3}`);
        }
        const vec3Clone = new Vec3(vec3.x, vec3.y, vec3.z);
        // Deep clone the Vec3
        return new Peptide('vconst', 'vec3', vec3Clone, null, null, null,
            (_, vars) => new Vec3(vec3Clone.x, vec3Clone.y, vec3Clone.z),
            (_, ssaOp) => `${ssaOp.result} = new Vec3(${vec3Clone.x}, ${vec3Clone.y}, ${vec3Clone.z});`,
            (_, ssaOp) => `${ssaOp.result} = ${vec3Clone.glsl()};`,
        );
    }

    static vvar(name) {
        return new Peptide('vvar', 'vec3', name, null, null, null,
            (_, vars) => {
                if (!(name in vars)) {
                    throw new Error(`Vector variable '${name}' not found`);
                }
                return vars[name];
            },
            (_, ssaOp) => {
                return `if (!('${name}' in vars)) throw new Error("Vector variable '${name}' not found");\n`
                    + `  ${ssaOp.result} = vars['${name}'];`;
            },
            (_, ssaOp) => `${ssaOp.result} = ${name};`,
        );
    }
    static vadd(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vadd', 'vec3', null, a, b, null,
            (_, vars) => a.evaluate(vars).add(b.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.add(${ssaOp.right});`,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} + ${ssaOp.right};`,
        );
    }

    static vsub(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vsub', 'vec3', null, a, b, null,
            (_, vars) => a.evaluate(vars).sub(b.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.sub(${ssaOp.right});`,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} - ${ssaOp.right};`,
        );
    }

    static vmul(a, b) {
        a.assertType('vec3');
        b.assertType('float');
        return new Peptide('vmul', 'vec3', null, a, b, null,
            (_, vars) => a.evaluate(vars).mul(b.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mul(${ssaOp.right});`,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
        );
    }

    static vdiv(a, b) {
        a.assertType('vec3');
        b.assertType('float');
        return new Peptide('vdiv', 'vec3', null, a, b, null,
            (_, vars) => a.evaluate(vars).div(b.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.div(${ssaOp.right});`,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} / ${ssaOp.right};`,
        );
    }

    static vlength(a) {
        a.assertType('vec3');
        return new Peptide('vlength', 'float', null, a, null, null,
            (_, vars) => a.evaluate(vars).length(),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.length();`,
            (_, ssaOp) => `${ssaOp.result} = length(${ssaOp.left});`,
        );
    }

    static vabs(a) {
        a.assertType('vec3');
        return new Peptide('vabs', 'vec3', null, a, null, null,
            (_, vars) => a.evaluate(vars).abs(),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.abs();`,
            (_, ssaOp) => `${ssaOp.result} = abs(${ssaOp.left});`,
        );
    }

    static vmin(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vmin', 'vec3', null, a, b, null,
            (_, vars) => a.evaluate(vars).min(b.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.min(${ssaOp.right});`,
            (_, ssaOp) => `${ssaOp.result} = min(${ssaOp.left}, ${ssaOp.right});`,
        );
    }

    static vmax(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vmax', 'vec3', null, a, b, null,
            (_, vars) => a.evaluate(vars).max(b.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.max(${ssaOp.right});`,
            (_, ssaOp) => `${ssaOp.result} = max(${ssaOp.left}, ${ssaOp.right});`,
        );
    }

    static vdot(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vdot', 'float', null, a, b, null,
            (_, vars) => a.evaluate(vars).dot(b.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.dot(${ssaOp.right});`,
            (_, ssaOp) => `${ssaOp.result} = dot(${ssaOp.left}, ${ssaOp.right});`,
        );
    }

    static vcross(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vcross', 'vec3', null, a, b, null,
            (_, vars) => a.evaluate(vars).cross(b.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.cross(${ssaOp.right});`,
            (_, ssaOp) => `${ssaOp.result} = cross(${ssaOp.left}, ${ssaOp.right});`,
        );
    }

    static vec3(a, b, c) {
        a.assertType('float');
        b.assertType('float');
        c.assertType('float');
        return new Peptide('vec3', 'vec3', null, a, b, c,
            (_, vars) => new Vec3(a.evaluate(vars), b.evaluate(vars), c.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = new Vec3(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
            (_, ssaOp) => `${ssaOp.result} = vec3(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
        );
    }

    static add(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('add', 'float', null, a, b, null,
            (_, vars) => a.evaluate(vars) + b.evaluate(vars),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} + ${ssaOp.right};`,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} + ${ssaOp.right};`,
        );
    }

    static sub(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('sub', 'float', null, a, b, null,
            (_, vars) => a.evaluate(vars) - b.evaluate(vars),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} - ${ssaOp.right};`,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} - ${ssaOp.right};`,
        );
    }

    static mul(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('mul', 'float', null, a, b, null,
            (_, vars) => a.evaluate(vars) * b.evaluate(vars),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
        );
    }

    static div(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('div', 'float', null, a, b, null,
            (_, vars) => a.evaluate(vars) / b.evaluate(vars),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} / ${ssaOp.right};`,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} / ${ssaOp.right};`,
        );
    }

    static min(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('min', 'float', null, a, b, null,
            (_, vars) => Math.min(a.evaluate(vars), b.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = Math.min(${ssaOp.left}, ${ssaOp.right});`,
            (_, ssaOp) => `${ssaOp.result} = min(${ssaOp.left}, ${ssaOp.right});`,
        );
    }

    static max(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('max', 'float', null, a, b, null,
            (_, vars) => Math.max(a.evaluate(vars), b.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = Math.max(${ssaOp.left}, ${ssaOp.right});`,
            (_, ssaOp) => `${ssaOp.result} = max(${ssaOp.left}, ${ssaOp.right});`,
        );
    }

    static clamp(a, min, max) {
        a.assertType('float');
        min.assertType('float');
        max.assertType('float');
        return new Peptide('clamp', 'float', null, a, min, max,
            (_, vars) => Math.max(min.evaluate(vars), Math.min(a.evaluate(vars), max.evaluate(vars))),
            (_, ssaOp) => `${ssaOp.result} = Math.max(${ssaOp.right}, Math.min(${ssaOp.left}, ${ssaOp.third}));`,
            (_, ssaOp) => `${ssaOp.result} = clamp(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
        );
    }

    static mix(a, b, t) {
        a.assertType('float');
        b.assertType('float');
        t.assertType('float');
        return new Peptide('mix', 'float', null, a, b, t,
            (_, vars) => a.evaluate(vars) * (1 - t.evaluate(vars)) + b.evaluate(vars) * t.evaluate(vars),
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} * (1 - ${ssaOp.third}) + ${ssaOp.right} * ${ssaOp.third};`,
            (_, ssaOp) => `${ssaOp.result} = mix(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
        );
    }

    static pow(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('pow', 'float', null, a, b, null,
            (_, vars) => Math.pow(a.evaluate(vars), b.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = Math.pow(${ssaOp.left}, ${ssaOp.right});`,
            (_, ssaOp) => `${ssaOp.result} = pow(${ssaOp.left}, ${ssaOp.right});`,
        );
    }

    static sqrt(a) {
        a.assertType('float');
        return new Peptide('sqrt', 'float', null, a, null, null,
            (_, vars) => Math.sqrt(a.evaluate(vars)),
            (_, ssaOp) => `${ssaOp.result} = Math.sqrt(${ssaOp.left});`,
            (_, ssaOp) => `${ssaOp.result} = sqrt(${ssaOp.left});`,
        );
    }

    static vecX(a) {
        a.assertType('vec3');
        return new Peptide('vecX', 'float', null, a, null, null,
            (_, vars) => a.evaluate(vars).x,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.x;`,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.x;`,
        );
    }
    
    static vecY(a) {
        a.assertType('vec3');
        return new Peptide('vecY', 'float', null, a, null, null,
            (_, vars) => a.evaluate(vars).y,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.y;`,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.y;`,
        );
    }
    
    static vecZ(a) {
        a.assertType('vec3');
        return new Peptide('vecZ', 'float', null, a, null, null,
            (_, vars) => a.evaluate(vars).z,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.z;`,
            (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.z;`,
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

    // turn the tree into a DAG by eliminating common subexpressions
    simplify() {
        // Use a cache to track unique expressions
        const cache = new Map();
        
        // Helper function to recursively simplify the tree
        const simplifyNode = (node) => {
            if (!node) return null;
            
            // First simplify children
            if (node.left) node.left = simplifyNode(node.left);
            if (node.right) node.right = simplifyNode(node.right);
            if (node.third) node.third = simplifyNode(node.third);
            
            // Create a key that uniquely identifies this node
            const key = JSON.stringify({
                op: node.op,
                type: node.type,
                value: node.value,
                left: node.left ? node.left.id : null,
                right: node.right ? node.right.id : null,
                third: node.third ? node.third.id : null
            });
            
            // Check if we've seen this expression before
            if (cache.has(key)) {
                return cache.get(key);
            }
            
            // If not, add it to the cache
            node.id = cache.size; // Assign a unique ID to this node
            cache.set(key, node);
            return node;
        };
        
        // Start simplification from the root (this)
        return simplifyNode(this);
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
