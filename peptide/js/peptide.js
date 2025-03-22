class Peptide {
    constructor(op, type, value = null, left = null, right = null, third = null, ops = {}) {
        this.op = op;          // Operation name (e.g., 'const', 'vconst', 'vadd', etc.)
        this.type = type;      // 'float' or 'vec3'
        this.value = value;    // value for constant operations, name for variables
        this.left = left;      // left operand
        this.right = right;    // right operand
        this.third = third;    // third operand
        this.ops = ops;        // operation functions

        if (!this.ops.evaluate) {
            console.warn(`No operation function provided for ${op}`, this);
        }
        if (!this.ops.jsCode) {
            console.warn(`No SSA operation function provided for ${op}`, this);
        }
        if (!this.ops.glslCode) {
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
        return new Peptide('const', 'float', value, null, null, null, {
            evaluate: (_, vars) => value,
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${value};`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${value.toFixed(16)};`,
        });
    }

    static var(name) {
        return new Peptide('var', 'float', name, null, null, null, {
            evaluate: (_, vars) => {
                if (!(name in vars)) {
                    throw new Error(`Variable '${name}' not found`);
                }
                return vars[name];
            },
            jsCode: (_, ssaOp) => {
                return `if (!('${name}' in vars)) throw new Error("Variable '${name}' not found");\n`
                    + `  ${ssaOp.result} = vars['${name}'];`;
            },
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${name};`,
        });
    }

    // Vector operations
    static vconst(vec3) {
        if (!(vec3 instanceof Vec3)) {
            throw new Error(`vconst expected Vec3 but got ${vec3?.constructor?.name || typeof vec3}`);
        }
        const vec3Clone = new Vec3(vec3.x, vec3.y, vec3.z);
        // Deep clone the Vec3
        return new Peptide('vconst', 'vec3', vec3Clone, null, null, null, {
            evaluate: (_, vars) => new Vec3(vec3Clone.x, vec3Clone.y, vec3Clone.z),
            jsCode: (_, ssaOp) => `${ssaOp.result} = new Vec3(${vec3Clone.x}, ${vec3Clone.y}, ${vec3Clone.z});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${vec3Clone.glsl()};`,
        });
    }

    static vvar(name) {
        return new Peptide('vvar', 'vec3', name, null, null, null, {
            evaluate: (_, vars) => {
                if (!(name in vars)) {
                    throw new Error(`Vector variable '${name}' not found`);
                }
                return vars[name];
            },
            jsCode: (_, ssaOp) => {
                return `if (!('${name}' in vars)) throw new Error("Vector variable '${name}' not found");\n`
                    + `  ${ssaOp.result} = vars['${name}'];`;
            },
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${name};`,
        });
    }

    static mconst(mat3) {
        if (!(mat3 instanceof Mat3)) {
            throw new Error(`mconst expected Mat3 but got ${mat3?.constructor?.name || typeof mat3}`);
        }
        return new Peptide('mconst', 'mat3', mat3, null, null, null, {
            evaluate: (_, vars) => mat3,
            jsCode: (_, ssaOp) => `${ssaOp.result} = new Mat3(${mat3.m[0][0]}, ${mat3.m[0][1]}, ${mat3.m[0][2]}, ${mat3.m[1][0]}, ${mat3.m[1][1]}, ${mat3.m[1][2]}, ${mat3.m[2][0]}, ${mat3.m[2][1]}, ${mat3.m[2][2]});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${mat3.glsl()};`,
        });
    }

    static mvar(name) {
        return new Peptide('mvar', 'mat3', name, null, null, null, {
            evaluate: (_, vars) => {
                if (!(name in vars)) {
                    throw new Error(`Matrix variable '${name}' not found`);
                }
                return vars[name];
            },
            jsCode: (_, ssaOp) => {
                return `if (!('${name}' in vars)) throw new Error("Matrix variable '${name}' not found");\n`
                    + `  ${ssaOp.result} = vars['${name}'];`;
            },
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${name};`,
        });
    }

    static vadd(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vadd', 'vec3', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars).add(b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.add(${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} + ${ssaOp.right};`,
        });
    }

    static vsub(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vsub', 'vec3', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars).sub(b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.sub(${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} - ${ssaOp.right};`,
        });
    }

    static vmul(a, b) {
        a.assertType('vec3');
        b.assertType('float');
        return new Peptide('vmul', 'vec3', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars).mul(b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mul(${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
        });
    }

    static vdiv(a, b) {
        a.assertType('vec3');
        b.assertType('float');
        return new Peptide('vdiv', 'vec3', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars).div(b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.div(${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} / ${ssaOp.right};`,
        });
    }

    static vmod(a, b) {
        a.assertType('vec3');
        b.assertType('float');
        return new Peptide('vmod', 'vec3', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars).mod(b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mod(${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = mod(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static vlength(a) {
        a.assertType('vec3');
        return new Peptide('vlength', 'float', null, a, null, null, {
            evaluate: (_, vars) => a.evaluate(vars).length(),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.length();`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = length(${ssaOp.left});`,
        });
    }

    static vabs(a) {
        a.assertType('vec3');
        return new Peptide('vabs', 'vec3', null, a, null, null, {
            evaluate: (_, vars) => a.evaluate(vars).abs(),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.abs();`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = abs(${ssaOp.left});`,
        });
    }

    static vmin(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vmin', 'vec3', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars).min(b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.min(${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = min(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static vmax(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vmax', 'vec3', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars).max(b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.max(${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = max(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static vdot(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vdot', 'float', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars).dot(b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.dot(${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = dot(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static vcross(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vcross', 'vec3', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars).cross(b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.cross(${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = cross(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static vec3(a, b, c) {
        a.assertType('float');
        b.assertType('float');
        c.assertType('float');
        return new Peptide('vec3', 'vec3', null, a, b, c, {
            evaluate: (_, vars) => new Vec3(a.evaluate(vars), b.evaluate(vars), c.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = new Vec3(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = vec3(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
        });
    }

    static add(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('add', 'float', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars) + b.evaluate(vars),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} + ${ssaOp.right};`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} + ${ssaOp.right};`,
        });
    }

    static sub(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('sub', 'float', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars) - b.evaluate(vars),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} - ${ssaOp.right};`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} - ${ssaOp.right};`,
        });
    }

    static mul(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('mul', 'float', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars) * b.evaluate(vars),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
        });
    }

    static div(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('div', 'float', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars) / b.evaluate(vars),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} / ${ssaOp.right};`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} / ${ssaOp.right};`,
        });
    }

    static abs(a) {
        a.assertType('float');
        return new Peptide('abs', 'float', null, a, null, null, {
            evaluate: (_, vars) => Math.abs(a.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = Math.abs(${ssaOp.left});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = abs(${ssaOp.left});`,
        });
    }

    static min(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('min', 'float', null, a, b, null, {
            evaluate: (_, vars) => Math.min(a.evaluate(vars), b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = Math.min(${ssaOp.left}, ${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = min(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static max(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('max', 'float', null, a, b, null, {
            evaluate: (_, vars) => Math.max(a.evaluate(vars), b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = Math.max(${ssaOp.left}, ${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = max(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static clamp(a, min, max) {
        a.assertType('float');
        min.assertType('float');
        max.assertType('float');
        return new Peptide('clamp', 'float', null, a, min, max, {
            evaluate: (_, vars) => Math.max(min.evaluate(vars), Math.min(a.evaluate(vars), max.evaluate(vars))),
            jsCode: (_, ssaOp) => `${ssaOp.result} = Math.max(${ssaOp.right}, Math.min(${ssaOp.left}, ${ssaOp.third}));`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = clamp(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
        });
    }

    static mix(a, b, t) {
        a.assertType('float');
        b.assertType('float');
        t.assertType('float');
        return new Peptide('mix', 'float', null, a, b, t, {
            evaluate: (_, vars) => a.evaluate(vars) * (1 - t.evaluate(vars)) + b.evaluate(vars) * t.evaluate(vars),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} * (1 - ${ssaOp.third}) + ${ssaOp.right} * ${ssaOp.third};`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = mix(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
        });
    }

    static step(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('step', 'float', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars) <= b.evaluate(vars) ? 1.0 : 0.0,
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} <= ${ssaOp.right} ? 1.0 : 0.0;`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = step(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static smin(a, b, k) {
        a.assertType('float');
        b.assertType('float');
        k.assertType('float');
        const h = P.clamp(P.add(P.const(0.5), P.div(P.sub(b, a), P.mul(P.const(2), k))), P.const(0), P.const(1));
        return P.sub(P.mix(b, a, h), P.mul(k, P.mul(h, P.sub(P.const(1), h))));
    }

    static smax(a, b, k) {
        a.assertType('float');
        b.assertType('float');
        k.assertType('float');
        const h = P.clamp(P.sub(P.const(0.5), P.div(P.sub(b, a), P.mul(P.const(2), k))), P.const(0), P.const(1));
        return P.add(P.mix(b, a, h), P.mul(k, P.mul(h, P.sub(P.const(1), h))));
    }

    static chmin(a, b, k) {
        a.assertType('float');
        b.assertType('float');
        k.assertType('float');
        return P.min(P.min(a, b), P.mul(P.const(0.7071), P.sub(P.add(a, b), k)));
    }

    static chmax(a, b, k) {
        a.assertType('float');
        b.assertType('float');
        k.assertType('float');
        return P.max(P.max(a, b), P.mul(P.const(0.7071), P.add(P.add(a, b), k)));
    }

    static pow(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('pow', 'float', null, a, b, null, {
            evaluate: (_, vars) => Math.pow(a.evaluate(vars), b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = Math.pow(${ssaOp.left}, ${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = pow(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static sqrt(a) {
        a.assertType('float');
        return new Peptide('sqrt', 'float', null, a, null, null, {
            evaluate: (_, vars) => Math.sqrt(a.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = Math.sqrt(${ssaOp.left});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = sqrt(${ssaOp.left});`,
        });
    }

    static sin(a) {
        a.assertType('float');
        return new Peptide('sin', 'float', null, a, null, null, {
            evaluate: (_, vars) => Math.sin(a.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = Math.sin(${ssaOp.left});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = sin(${ssaOp.left});`,
        });
    }

    static cos(a) {
        a.assertType('float');
        return new Peptide('cos', 'float', null, a, null, null, {
            evaluate: (_, vars) => Math.cos(a.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = Math.cos(${ssaOp.left});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = cos(${ssaOp.left});`,
        });
    }

    static vecX(a) {
        a.assertType('vec3');
        return new Peptide('vecX', 'float', null, a, null, null, {
            evaluate: (_, vars) => a.evaluate(vars).x,
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.x;`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.x;`,
        });
    }
    
    static vecY(a) {
        a.assertType('vec3');
        return new Peptide('vecY', 'float', null, a, null, null, {
            evaluate: (_, vars) => a.evaluate(vars).y,
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.y;`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.y;`,
        });
    }
    
    static vecZ(a) {
        a.assertType('vec3');
        return new Peptide('vecZ', 'float', null, a, null, null, {
            evaluate: (_, vars) => a.evaluate(vars).z,
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.z;`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.z;`,
        });
    }

    static mtranspose(a) {
        a.assertType('mat3');
        return new Peptide('mtranspose', 'mat3', null, a, null, null, {
            evaluate: (_, vars) => a.evaluate(vars).transpose(),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.transpose();`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = transpose(${ssaOp.left});`,
        });
    }

    static mvmul(a, b) {
        a.assertType('mat3');
        b.assertType('vec3');
        return new Peptide('mvmul', 'vec3', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars).mulVec3(b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mulVec3(${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
        });
    }

    static mmul(a, b) {
        a.assertType('mat3');
        b.assertType('mat3');
        return new Peptide('mmul', 'mat3', null, a, b, null, {
            evaluate: (_, vars) => a.evaluate(vars).mul(b.evaluate(vars)),
            jsCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mul(${ssaOp.right});`,
            glslCode: (_, ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
        });
    }

    evaluate(vars = {}) {
        const evalFn = this.ops.evaluate;
        if (!evalFn) {
            throw new Error(`Operation '${this.op}' has no evaluation function`);
        }
        const result = evalFn(this, vars);
        if (this.type === 'float') {
            if (typeof result !== 'number') {
                throw new Error(`Operation '${this.op}' returned ${typeof result} but declared float type`);
            }
        } else if (this.type === 'vec3') {
            if (!(result instanceof Vec3)) {
                throw new Error(`Operation '${this.op}' returned ${typeof result} but declared vec3 type`);
            }
        } else if (this.type === 'mat3') {
            if (!(result instanceof Mat3)) {
                throw new Error(`Operation '${this.op}' returned ${typeof result} but declared mat3 type`);
            }
        }
        return result;
    }

    // turn the tree into a DAG by eliminating common subexpressions
    simplify() {
        // Use a cache to track unique expressions
        const cache = new Map();
        const seen = new Set();
        let nextId = 0;
        
        // Helper function to recursively simplify the tree
        const simplifyNode = (node) => {
            if (!node) return null;

            if (cache.has(node)) {
                return cache.get(node);
            }
            
            // First simplify children
            if (node.left) node.left = simplifyNode(node.left);
            if (node.right) node.right = simplifyNode(node.right);
            if (node.third) node.third = simplifyNode(node.third);
            
            // Create a key that uniquely identifies this node
            // Format: op|type|value|leftId|rightId|thirdId
            let valueStr;
            if (node.value instanceof Vec3) {
                valueStr = `v${node.value.x},${node.value.y},${node.value.z}`;
            } else if (node.value instanceof Mat3) {
                valueStr = 'm' + Array.from(node.value.m).flat().join(',');
            } else if (node.value === null) {
                valueStr = 'null';
            } else {
                valueStr = String(node.value);
            }
            
            const key = [
                node.op,
                node.type,
                valueStr,
                node.left ? node.left.id : 'n',
                node.right ? node.right.id : 'n',
                node.third ? node.third.id : 'n'
            ].join('|');
            
            // Check if we've seen this expression before
            if (cache.has(key)) {
                const canonical = cache.get(key);
                cache.set(node, canonical);
                return canonical;
            }
            
            // If not, add it to the cache
            node.id = nextId++; // Assign a unique ID to this node
            cache.set(key, node);
            cache.set(node, node);
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
