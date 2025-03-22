class Peptide {
    constructor(op, type, value = null, left = null, right = null, third = null, ops = {}) {
        this.op = op;          // Operation name (e.g., 'const', 'vconst', 'vadd', etc.)
        this.type = type;      // 'float' or 'vec3'
        this.value = value;    // value for constant operations, name for variables
        this.left = left;      // left operand
        this.right = right;    // right operand
        this.third = third;    // third operand
        this.ops = ops;        // operation functions

        for (const fn of ['evaluate', 'evaluateInterval', 'jsCode', 'jsIntervalCode', 'glslCode']) {
            if (!this.ops[fn]) {
                console.warn(`No ${fn} operation function provided for ${op}`, this);
            }
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
            evaluate: (vars) => value,
            evaluateInterval: (vars) => new Ifloat(value),
            jsCode: (ssaOp) => `${ssaOp.result} = ${value};`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = new Ifloat(${value});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${value.toFixed(16)};`,
        });
    }

    static var(name) {
        return new Peptide('var', 'float', name, null, null, null, {
            evaluate: (vars) => {
                if (!(name in vars)) {
                    throw new Error(`Variable '${name}' not found`);
                }
                return vars[name];
            },
            evaluateInterval: (vars) => {
                if (vars[name] instanceof Ifloat) {
                    return new Ifloat(vars[name].min, vars[name].max);
                } else if (typeof vars[name] === 'number') {
                    return new Ifloat(vars[name]);
                } else {
                    throw new Error(`Variable '${name}' is not an Ifloat or a number`);
                }
            },
            jsCode: (ssaOp) => {
                return `if (!('${name}' in vars)) throw new Error("Variable '${name}' not found");\n`
                    + `  ${ssaOp.result} = vars['${name}'];`;
            },
            jsIntervalCode: (ssaOp) => {
                return `if (!('${name}' in vars)) throw new Error("Variable '${name}' not found");\n`
                    + `  ${ssaOp.result} = vars['${name}'] instanceof Ifloat ? vars['${name}'] : new Ifloat(vars['${name}']);`;
            },
            glslCode: (ssaOp) => `${ssaOp.result} = ${name};`,
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
            evaluate: (vars) => new Vec3(vec3Clone.x, vec3Clone.y, vec3Clone.z),
            evaluateInterval: (vars) => new Ivec3(
                new Ifloat(vec3Clone.x),
                new Ifloat(vec3Clone.y),
                new Ifloat(vec3Clone.z)
            ),
            jsCode: (ssaOp) => `${ssaOp.result} = new Vec3(${vec3Clone.x}, ${vec3Clone.y}, ${vec3Clone.z});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = new Ivec3(${vec3Clone.x}, ${vec3Clone.y}, ${vec3Clone.z});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${vec3Clone.glsl()};`,
        });
    }

    static vvar(name) {
        return new Peptide('vvar', 'vec3', name, null, null, null, {
            evaluate: (vars) => {
                if (!(name in vars)) {
                    throw new Error(`Vector variable '${name}' not found`);
                }
                return vars[name];
            },
            evaluateInterval: (vars) => {
                if (!(name in vars)) {
                    throw new Error(`Vector variable '${name}' not found`);
                }
                if (vars[name] instanceof Ivec3) {
                    return vars[name];
                } else if (vars[name] instanceof Vec3) {
                    return new Ivec3(
                        new Ifloat(vars[name].x),
                        new Ifloat(vars[name].y),
                        new Ifloat(vars[name].z)
                    );
                } else {
                    throw new Error(`Variable '${name}' is not an Ivec3 or a Vec3`);
                }
            },
            jsCode: (ssaOp) => {
                return `if (!('${name}' in vars)) throw new Error("Vector variable '${name}' not found");\n`
                    + `  ${ssaOp.result} = vars['${name}'];`;
            },
            jsIntervalCode: (ssaOp) => {
                return `if (!('${name}' in vars)) throw new Error("Vector variable '${name}' not found");\n`
                    + `  ${ssaOp.result} = vars['${name}'] instanceof Ivec3 ? vars['${name}'] : vars['${name}'] instanceof Vec3 ? new Ivec3(vars['${name}'].x, vars['${name}'].y, vars['${name}'].z) : new Ivec3(vars['${name}']);`;
            },
            glslCode: (ssaOp) => `${ssaOp.result} = ${name};`,
        });
    }

    static mconst(mat3) {
        if (!(mat3 instanceof Mat3)) {
            throw new Error(`mconst expected Mat3 but got ${mat3?.constructor?.name || typeof mat3}`);
        }
        return new Peptide('mconst', 'mat3', mat3, null, null, null, {
            evaluate: (vars) => mat3,
            evaluateInterval: (vars) => mat3,
            jsCode: (ssaOp) => `${ssaOp.result} = new Mat3(${mat3.m[0][0]}, ${mat3.m[0][1]}, ${mat3.m[0][2]}, ${mat3.m[1][0]}, ${mat3.m[1][1]}, ${mat3.m[1][2]}, ${mat3.m[2][0]}, ${mat3.m[2][1]}, ${mat3.m[2][2]});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = new Mat3(${mat3.m[0][0]}, ${mat3.m[0][1]}, ${mat3.m[0][2]}, ${mat3.m[1][0]}, ${mat3.m[1][1]}, ${mat3.m[1][2]}, ${mat3.m[2][0]}, ${mat3.m[2][1]}, ${mat3.m[2][2]});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${mat3.glsl()};`,
        });
    }

    static mvar(name) {
        return new Peptide('mvar', 'mat3', name, null, null, null, {
            evaluate: (vars) => {
                if (!(name in vars)) {
                    throw new Error(`Matrix variable '${name}' not found`);
                }
                return vars[name];
            },
            evaluateInterval: (vars) => {
                if (!(name in vars)) {
                    throw new Error(`Matrix variable '${name}' not found`);
                }
                return vars[name];
            },
            jsCode: (ssaOp) => {
                return `if (!('${name}' in vars)) throw new Error("Matrix variable '${name}' not found");\n`
                    + `  ${ssaOp.result} = vars['${name}'];`;
            },
            jsIntervalCode: (ssaOp) => {
                return `if (!('${name}' in vars)) throw new Error("Matrix variable '${name}' not found");\n`
                    + `  ${ssaOp.result} = vars['${name}'];`;
            },
            glslCode: (ssaOp) => `${ssaOp.result} = ${name};`,
        });
    }

    static vadd(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vadd', 'vec3', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars).add(b.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).add(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.add(${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.add(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} + ${ssaOp.right};`,
        });
    }

    static vsub(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vsub', 'vec3', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars).sub(b.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).sub(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.sub(${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.sub(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} - ${ssaOp.right};`,
        });
    }

    static vmul(a, b) {
        a.assertType('vec3');
        b.assertType('float');
        return new Peptide('vmul', 'vec3', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars).mul(b.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).mul(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mul(${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mul(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
        });
    }

    static vdiv(a, b) {
        a.assertType('vec3');
        b.assertType('float');
        return new Peptide('vdiv', 'vec3', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars).div(b.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).div(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.div(${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.div(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} / ${ssaOp.right};`,
        });
    }

    static vmod(a, b) {
        a.assertType('vec3');
        b.assertType('float');
        return new Peptide('vmod', 'vec3', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars).mod(b.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).mod(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mod(${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mod(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = mod(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static vlength(a) {
        a.assertType('vec3');
        return new Peptide('vlength', 'float', null, a, null, null, {
            evaluate: (vars) => a.evaluate(vars).length(),
            evaluateInterval: (vars) => a.evaluateInterval(vars).length(),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.length();`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.length();`,
            glslCode: (ssaOp) => `${ssaOp.result} = length(${ssaOp.left});`,
        });
    }

    static vabs(a) {
        a.assertType('vec3');
        return new Peptide('vabs', 'vec3', null, a, null, null, {
            evaluate: (vars) => a.evaluate(vars).abs(),
            evaluateInterval: (vars) => a.evaluateInterval(vars).abs(),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.abs();`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.abs();`,
            glslCode: (ssaOp) => `${ssaOp.result} = abs(${ssaOp.left});`,
        });
    }

    static vmin(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vmin', 'vec3', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars).min(b.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).min(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.min(${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.min(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = min(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static vmax(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vmax', 'vec3', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars).max(b.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).max(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.max(${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.max(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = max(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static vdot(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vdot', 'float', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars).dot(b.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).dot(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.dot(${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.dot(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = dot(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static vcross(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return new Peptide('vcross', 'vec3', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars).cross(b.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).cross(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.cross(${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.cross(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = cross(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static vec3(a, b, c) {
        a.assertType('float');
        b.assertType('float');
        c.assertType('float');
        return new Peptide('vec3', 'vec3', null, a, b, c, {
            evaluate: (vars) => new Vec3(a.evaluate(vars), b.evaluate(vars), c.evaluate(vars)),
            evaluateInterval: (vars) => new Ivec3(
                a.evaluateInterval(vars),
                b.evaluateInterval(vars),
                c.evaluateInterval(vars)
            ),
            jsCode: (ssaOp) => `${ssaOp.result} = new Vec3(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = new Ivec3(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
            glslCode: (ssaOp) => `${ssaOp.result} = vec3(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
        });
    }

    static add(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('add', 'float', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars) + b.evaluate(vars),
            evaluateInterval: (vars) => a.evaluateInterval(vars).add(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} + ${ssaOp.right};`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.add(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} + ${ssaOp.right};`,
        });
    }

    static sub(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('sub', 'float', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars) - b.evaluate(vars),
            evaluateInterval: (vars) => a.evaluateInterval(vars).sub(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} - ${ssaOp.right};`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.sub(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} - ${ssaOp.right};`,
        });
    }

    static mul(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('mul', 'float', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars) * b.evaluate(vars),
            evaluateInterval: (vars) => a.evaluateInterval(vars).mul(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mul(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
        });
    }

    static div(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('div', 'float', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars) / b.evaluate(vars),
            evaluateInterval: (vars) => a.evaluateInterval(vars).div(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} / ${ssaOp.right};`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.div(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} / ${ssaOp.right};`,
        });
    }

    static abs(a) {
        a.assertType('float');
        return new Peptide('abs', 'float', null, a, null, null, {
            evaluate: (vars) => Math.abs(a.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).abs(),
            jsCode: (ssaOp) => `${ssaOp.result} = Math.abs(${ssaOp.left});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.abs();`,
            glslCode: (ssaOp) => `${ssaOp.result} = abs(${ssaOp.left});`,
        });
    }

    static min(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('min', 'float', null, a, b, null, {
            evaluate: (vars) => Math.min(a.evaluate(vars), b.evaluate(vars)),
            evaluateInterval: (vars) => Ifloat.min(a.evaluateInterval(vars), b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = Math.min(${ssaOp.left}, ${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = Ifloat.min(${ssaOp.left}, ${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = min(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static max(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('max', 'float', null, a, b, null, {
            evaluate: (vars) => Math.max(a.evaluate(vars), b.evaluate(vars)),
            evaluateInterval: (vars) => Ifloat.max(a.evaluateInterval(vars), b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = Math.max(${ssaOp.left}, ${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = Ifloat.max(${ssaOp.left}, ${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = max(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static clamp(a, min, max) {
        a.assertType('float');
        min.assertType('float');
        max.assertType('float');
        return new Peptide('clamp', 'float', null, a, min, max, {
            evaluate: (vars) => Math.max(min.evaluate(vars), Math.min(a.evaluate(vars), max.evaluate(vars))),
            evaluateInterval: (vars) => Ifloat.clamp(a.evaluateInterval(vars), min.evaluateInterval(vars), max.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = Math.max(${ssaOp.right}, Math.min(${ssaOp.left}, ${ssaOp.third}));`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = Ifloat.clamp(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
            glslCode: (ssaOp) => `${ssaOp.result} = clamp(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
        });
    }

    static mix(a, b, t) {
        a.assertType('float');
        b.assertType('float');
        t.assertType('float');
        return new Peptide('mix', 'float', null, a, b, t, {
            evaluate: (vars) => a.evaluate(vars) * (1 - t.evaluate(vars)) + b.evaluate(vars) * t.evaluate(vars),
            evaluateInterval: (vars) => Ifloat.mix(a.evaluateInterval(vars), b.evaluateInterval(vars), t.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} * (1 - ${ssaOp.third}) + ${ssaOp.right} * ${ssaOp.third};`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = Ifloat.mix(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
            glslCode: (ssaOp) => `${ssaOp.result} = mix(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
        });
    }

    static step(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('step', 'float', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars) <= b.evaluate(vars) ? 1.0 : 0.0,
            evaluateInterval: (vars) => Ifloat.step(a.evaluateInterval(vars), b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} <= ${ssaOp.right} ? 1.0 : 0.0;`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = Ifloat.step(${ssaOp.left}, ${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = step(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static smin(a, b, k) {
        a.assertType('float');
        b.assertType('float');
        k.assertType('float');
        // Add a small epsilon to k to avoid division by zero
        const safeK = P.max(k, P.const(1e-10));
        const h = P.clamp(P.add(P.const(0.5), P.div(P.sub(b, a), P.mul(P.const(2), safeK))), P.const(0), P.const(1));
        return P.sub(P.mix(b, a, h), P.mul(safeK, P.mul(h, P.sub(P.const(1), h))));
    }

    static smax(a, b, k) {
        a.assertType('float');
        b.assertType('float');
        k.assertType('float');
        // Add a small epsilon to k to avoid division by zero
        const safeK = P.max(k, P.const(1e-10));
        const h = P.clamp(P.sub(P.const(0.5), P.div(P.sub(b, a), P.mul(P.const(2), safeK))), P.const(0), P.const(1));
        return P.add(P.mix(b, a, h), P.mul(safeK, P.mul(h, P.sub(P.const(1), h))));
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
            evaluate: (vars) => Math.pow(a.evaluate(vars), b.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).pow(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = Math.pow(${ssaOp.left}, ${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.pow(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = pow(${ssaOp.left}, ${ssaOp.right});`,
        });
    }

    static sqrt(a) {
        a.assertType('float');
        return new Peptide('sqrt', 'float', null, a, null, null, {
            evaluate: (vars) => Math.sqrt(a.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).sqrt(),
            jsCode: (ssaOp) => `${ssaOp.result} = Math.sqrt(${ssaOp.left});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.sqrt();`,
            glslCode: (ssaOp) => `${ssaOp.result} = sqrt(${ssaOp.left});`,
        });
    }

    static sin(a) {
        a.assertType('float');
        return new Peptide('sin', 'float', null, a, null, null, {
            evaluate: (vars) => Math.sin(a.evaluate(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = Math.sin(${ssaOp.left});`,
            glslCode: (ssaOp) => `${ssaOp.result} = sin(${ssaOp.left});`,
        });
    }

    static cos(a) {
        a.assertType('float');
        return new Peptide('cos', 'float', null, a, null, null, {
            evaluate: (vars) => Math.cos(a.evaluate(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = Math.cos(${ssaOp.left});`,
            glslCode: (ssaOp) => `${ssaOp.result} = cos(${ssaOp.left});`,
        });
    }

    static vecX(a) {
        a.assertType('vec3');
        return new Peptide('vecX', 'float', null, a, null, null, {
            evaluate: (vars) => a.evaluate(vars).x,
            evaluateInterval: (vars) => a.evaluateInterval(vars).x,
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.x;`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.x;`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.x;`,
        });
    }
    
    static vecY(a) {
        a.assertType('vec3');
        return new Peptide('vecY', 'float', null, a, null, null, {
            evaluate: (vars) => a.evaluate(vars).y,
            evaluateInterval: (vars) => a.evaluateInterval(vars).y,
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.y;`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.y;`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.y;`,
        });
    }
    
    static vecZ(a) {
        a.assertType('vec3');
        return new Peptide('vecZ', 'float', null, a, null, null, {
            evaluate: (vars) => a.evaluate(vars).z,
            evaluateInterval: (vars) => a.evaluateInterval(vars).z,
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.z;`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.z;`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.z;`,
        });
    }

    static mtranspose(a) {
        a.assertType('mat3');
        return new Peptide('mtranspose', 'mat3', null, a, null, null, {
            evaluate: (vars) => a.evaluate(vars).transpose(),
            evaluateInterval: (vars) => a.evaluateInterval(vars).transpose(),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.transpose();`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.transpose();`,
            glslCode: (ssaOp) => `${ssaOp.result} = transpose(${ssaOp.left});`,
        });
    }

    static mvmul(a, b) {
        a.assertType('mat3');
        b.assertType('vec3');

        const matmulInterval = (a, b) => {
            const xResult = new Ifloat(0)
                .add(new Ifloat(a.m[0][0]).mul(b.x))
                .add(new Ifloat(a.m[0][1]).mul(b.y))
                .add(new Ifloat(a.m[0][2]).mul(b.z));

            const yResult = new Ifloat(0)
                .add(new Ifloat(a.m[1][0]).mul(b.x))
                .add(new Ifloat(a.m[1][1]).mul(b.y))
                .add(new Ifloat(a.m[1][2]).mul(b.z));

            const zResult = new Ifloat(0)
                .add(new Ifloat(a.m[2][0]).mul(b.x))
                .add(new Ifloat(a.m[2][1]).mul(b.y))
                .add(new Ifloat(a.m[2][2]).mul(b.z));

            return new Ivec3(xResult, yResult, zResult);
        }

        return new Peptide('mvmul', 'vec3', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars).mulVec3(b.evaluate(vars)),
            evaluateInterval: (vars) => {
                const aVal = a.evaluate(vars); // We'll still use the concrete matrix for simplicity
                const bInterval = b.evaluateInterval(vars);

                return matmulInterval(aVal, bInterval);
            },
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mulVec3(${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = new Ivec3(new Ifloat(0).add(new Ifloat(${ssaOp.left}.m[0][0]).mul(${ssaOp.right}.x)).add(new Ifloat(${ssaOp.left}.m[0][1]).mul(${ssaOp.right}.y)).add(new Ifloat(${ssaOp.left}.m[0][2]).mul(${ssaOp.right}.z)), new Ifloat(0).add(new Ifloat(${ssaOp.left}.m[1][0]).mul(${ssaOp.right}.x)).add(new Ifloat(${ssaOp.left}.m[1][1]).mul(${ssaOp.right}.y)).add(new Ifloat(${ssaOp.left}.m[1][2]).mul(${ssaOp.right}.z)), new Ifloat(0).add(new Ifloat(${ssaOp.left}.m[2][0]).mul(${ssaOp.right}.x)).add(new Ifloat(${ssaOp.left}.m[2][1]).mul(${ssaOp.right}.y)).add(new Ifloat(${ssaOp.left}.m[2][2]).mul(${ssaOp.right}.z)));`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
        });
    }

    static mmul(a, b) {
        a.assertType('mat3');
        b.assertType('mat3');
        return new Peptide('mmul', 'mat3', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars).mul(b.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).mul(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mul(${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mul(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
        });
    }

    evaluate(vars = {}) {
        const evalFn = this.ops.evaluate;
        if (!evalFn) {
            throw new Error(`Operation '${this.op}' has no evaluation function`);
        }
        const result = evalFn(vars);
        if (this.type === 'float' && typeof result !== 'number') {
            throw new Error(`Operation '${this.op}' returned ${typeof result} but declared float type`);
        } else if (this.type === 'vec3' && !(result instanceof Vec3)) {
            throw new Error(`Operation '${this.op}' returned ${typeof result} but declared vec3 type`);
        } else if (this.type === 'mat3' && !(result instanceof Mat3)) {
            throw new Error(`Operation '${this.op}' returned ${typeof result} but declared mat3 type`);
        }
        return result;
    }

    evaluateInterval(vars = {}) {
        const evalFn = this.ops.evaluateInterval;
        if (!evalFn) {
            throw new Error(`Operation '${this.op}' has no interval evaluation function`);
        }
        const result = evalFn(vars);
        if (this.type === 'float' && !(result instanceof Ifloat)) {
            throw new Error(`Operation '${this.op}' returned ${typeof result} but declared float type`);
        } else if (this.type === 'vec3' && !(result instanceof Ivec3)) {
            throw new Error(`Operation '${this.op}' returned ${typeof result} but declared vec3 type`);
        }
        return result;
    }

    // turn the tree into a DAG by eliminating common subexpressions
    simplify() {
        // Use a cache to track unique expressions
        const cache = new Map();
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
            } else if (node.value instanceof Ifloat) {
                valueStr = `i${node.value.min},${node.value.max}`;
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
