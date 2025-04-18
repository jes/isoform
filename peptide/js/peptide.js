class Peptide {
    constructor(op, type, value = null, left = null, right = null, third = null, ops = {}) {
        this.op = op;          // Operation name (e.g., 'const', 'vconst', 'vadd', etc.)
        this.type = type;      // 'float' or 'vec3'
        this.value = value;    // value for constant operations, name for variables
        this.left = left;      // left operand
        this.right = right;    // right operand
        this.third = third;    // third operand
        this.ops = ops;        // operation functions

        this.cachedDerivative = {};

        for (const fn of ['evaluate', 'evaluateInterval', 'jsCode', 'jsIntervalCode', 'glslCode', 'glslIntervalCode']) {
            if (!this.ops[fn]) {
                console.warn(`No ${fn} operation function provided for ${op}`, this);
            }
        }

        // constant folding
        let obj;
        if (value == null &&
                (left == null || left.op == 'const' || left.op == 'vconst') &&
                (right == null || right.op == 'const' || right.op == 'vconst') &&
                (third == null || third.op == 'const' || third.op == 'vconst')) {
            // all args constant: evaluate the node
            if (type == 'float') obj = P.const(this.evaluate({}));
            if (type == 'vec3') obj = P.vconst(this.evaluate({}));
            if (obj) {
                this.op = obj.op;
                this.type = obj.type;
                this.value = obj.value;
                this.left = obj.left;
                this.right = obj.right;
                this.third = obj.third;
                this.ops = obj.ops;
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = ifloat(${value.toFixed(16)});`,
            derivative: (varName) => [P.zero(), P.zero(), P.zero()],
        });
    }

    static zero() {
        return P.const(0);
    }

    static vzero() {
        return P.vconst(new Vec3(0, 0, 0));
    }

    static mzero() {
        return P.mconst(new Mat3(0, 0, 0, 0, 0, 0, 0, 0, 0));
    }

    static one() {
        return P.const(1);
    }

    static vone() {
        return P.vconst(new Vec3(1, 1, 1));
    }

    static mone() {
        return P.mconst(new Mat3(1, 0, 0, 0, 1, 0, 0, 0, 1));
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = ifloat(${name});`,
            derivative: (varName) => varName === name ? [P.one(), P.one(), P.one()] : [P.zero(), P.zero(), P.zero()],
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = itov3(${vec3Clone.glsl()});`,
            derivative: (varName) => [P.vzero(), P.vzero(), P.vzero()],
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = ${name};`,
            derivative: (varName) => varName === name ?
                [P.vconst(new Vec3(1, 0, 0)), P.vconst(new Vec3(0, 1, 0)), P.vconst(new Vec3(0, 0, 1))]
              : [P.vzero(), P.vzero(), P.vzero()],
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = ${mat3.glsl()};`,
            derivative: (varName) => [P.mzero(), P.mzero(), P.mzero()],
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = ${name};`,
            derivative: (varName) => [P.mzero(), P.mzero(), P.mzero()],
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = iadd3(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                return [
                    P.vadd(aDerivative[0], bDerivative[0]),
                    P.vadd(aDerivative[1], bDerivative[1]),
                    P.vadd(aDerivative[2], bDerivative[2])
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = isub3(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                return [
                    P.vsub(aDerivative[0], bDerivative[0]),
                    P.vsub(aDerivative[1], bDerivative[1]),
                    P.vsub(aDerivative[2], bDerivative[2])
                ];
            },
        });
    }

    // component-wise vector multiplication
    static vmulv(a, b) {
        a.assertType('vec3');
        b.assertType('vec3');
        return P.vec3(P.mul(P.vecX(a), P.vecX(b)),
                      P.mul(P.vecY(a), P.vecY(b)),
                      P.mul(P.vecZ(a), P.vecZ(b)));
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = imul3(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                return [
                    P.vadd(P.vmul(aDerivative[0], b), P.vmul(a, bDerivative[0])),
                    P.vadd(P.vmul(aDerivative[1], b), P.vmul(a, bDerivative[1])),
                    P.vadd(P.vmul(aDerivative[2], b), P.vmul(a, bDerivative[2]))
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = idiv3(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bInv = P.div(P.one(), b);
                const bInvDerivative = bInv.derivative(varName);
                // For a/b, the derivative is the same as the derivative of a*(1/b)
                 return [
                    P.vadd(P.vmul(aDerivative[0], bInv), P.vmul(a, bInvDerivative[0])),
                    P.vadd(P.vmul(aDerivative[1], bInv), P.vmul(a, bInvDerivative[1])),
                    P.vadd(P.vmul(aDerivative[2], bInv), P.vmul(a, bInvDerivative[2])),
                 ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = imod3(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                
                // The derivative of mod is complex and discontinuous at the boundaries
                // For a continuous approximation, we can use the derivative of a
                // since mod(a,b) behaves like a when a is within the range [0,b)
                return [
                    aDerivative[0],
                    aDerivative[1],
                    aDerivative[2]
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = ilength3(${ssaOp.left});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const length = P.vlength(a);

                // here we use sqrt(x^2+eps) as a smooth approximation to |x|
                // to avoid division by zero
                const safeLength = P.smoothabs(length);
                
                // The derivative of length(v) with respect to a vector variable
                // is the dot product of the normalized vector and the derivative
                const normalizedA = P.vdiv(a, safeLength);
                return [
                    P.vdot(normalizedA, aDerivative[0]),
                    P.vdot(normalizedA, aDerivative[1]),
                    P.vdot(normalizedA, aDerivative[2])
                ];
            },
        });
    }

    static vnormalize(a) {
        a.assertType('vec3');
        return P.vdiv(a, P.vlength(a));
    }

    static vabs(a) {
        a.assertType('vec3');
        return new Peptide('vabs', 'vec3', null, a, null, null, {
            evaluate: (vars) => a.evaluate(vars).abs(),
            evaluateInterval: (vars) => a.evaluateInterval(vars).abs(),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.abs();`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.abs();`,
            glslCode: (ssaOp) => `${ssaOp.result} = abs(${ssaOp.left});`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = mat3(iabs(${ssaOp.left}[0].xy), 0.0, iabs(${ssaOp.left}[1].xy), 0.0, iabs(${ssaOp.left}[2].xy), 0.0);`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                
                // The derivative of abs(x) is sign(x)
                // For each component, we need to multiply the derivative by the sign of the original value
                return [
                    P.vmulv(aDerivative[0], P.vec3(
                        P.sign(P.vecX(a)),
                        P.sign(P.vecY(a)),
                        P.sign(P.vecZ(a))
                    )),
                    P.vmulv(aDerivative[1], P.vec3(
                        P.sign(P.vecX(a)),
                        P.sign(P.vecY(a)),
                        P.sign(P.vecZ(a))
                    )),
                    P.vmulv(aDerivative[2], P.vec3(
                        P.sign(P.vecX(a)),
                        P.sign(P.vecY(a)),
                        P.sign(P.vecZ(a))
                    ))
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = imin3(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                
                // The derivative of min(a,b) is:
                // - derivative of a where a < b
                // - derivative of b where b < a
                // - undefined (we use average) where a = b
                return [
                    P.vec3(
                        P.mix(P.vecX(bDerivative[0]), P.vecX(aDerivative[0]), P.step(P.vecX(a), P.vecX(b))),
                        P.mix(P.vecY(bDerivative[0]), P.vecY(aDerivative[0]), P.step(P.vecY(a), P.vecY(b))),
                        P.mix(P.vecZ(bDerivative[0]), P.vecZ(aDerivative[0]), P.step(P.vecZ(a), P.vecZ(b)))
                    ),
                    P.vec3(
                        P.mix(P.vecX(bDerivative[1]), P.vecX(aDerivative[1]), P.step(P.vecX(a), P.vecX(b))),
                        P.mix(P.vecY(bDerivative[1]), P.vecY(aDerivative[1]), P.step(P.vecY(a), P.vecY(b))),
                        P.mix(P.vecZ(bDerivative[1]), P.vecZ(aDerivative[1]), P.step(P.vecZ(a), P.vecZ(b)))
                    ),
                    P.vec3(
                        P.mix(P.vecX(bDerivative[2]), P.vecX(aDerivative[2]), P.step(P.vecX(a), P.vecX(b))),
                        P.mix(P.vecY(bDerivative[2]), P.vecY(aDerivative[2]), P.step(P.vecY(a), P.vecY(b))),
                        P.mix(P.vecZ(bDerivative[2]), P.vecZ(aDerivative[2]), P.step(P.vecZ(a), P.vecZ(b)))
                    )
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = imax3(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                
                // For each component, select the derivative of whichever input is larger
                // We use step function to create a smooth selection
                const selectA_x = P.step(P.vecX(a), P.vecX(b));
                const selectA_y = P.step(P.vecY(a), P.vecY(b));
                const selectA_z = P.step(P.vecZ(a), P.vecZ(b));
                
                return [
                    P.vadd(
                        P.vmulv(bDerivative[0], P.vec3(selectA_x, selectA_y, selectA_z)),
                        P.vmulv(aDerivative[0], P.vec3(P.sub(P.one(), selectA_x), P.sub(P.one(), selectA_y), P.sub(P.one(), selectA_z)))
                    ),
                    P.vadd(
                        P.vmulv(bDerivative[1], P.vec3(selectA_x, selectA_y, selectA_z)),
                        P.vmulv(aDerivative[1], P.vec3(P.sub(P.one(), selectA_x), P.sub(P.one(), selectA_y), P.sub(P.one(), selectA_z)))
                    ),
                    P.vadd(
                        P.vmulv(bDerivative[2], P.vec3(selectA_x, selectA_y, selectA_z)),
                        P.vmulv(aDerivative[2], P.vec3(P.sub(P.one(), selectA_x), P.sub(P.one(), selectA_y), P.sub(P.one(), selectA_z)))
                    )
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = idot3(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                
                // The derivative of dot(a,b) with respect to a vector variable
                // is a combination of the derivatives of both vectors
                return [
                    P.add(P.vdot(aDerivative[0], b), P.vdot(a, bDerivative[0])),
                    P.add(P.vdot(aDerivative[1], b), P.vdot(a, bDerivative[1])),
                    P.add(P.vdot(aDerivative[2], b), P.vdot(a, bDerivative[2]))
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = icross3(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                
                // The derivative of cross(a,b) with respect to a vector variable
                // is cross(da/dx, b) + cross(a, db/dx)
                return [
                    P.vadd(P.vcross(aDerivative[0], b), P.vcross(a, bDerivative[0])),
                    P.vadd(P.vcross(aDerivative[1], b), P.vcross(a, bDerivative[1])),
                    P.vadd(P.vcross(aDerivative[2], b), P.vcross(a, bDerivative[2]))
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = ivec3(${ssaOp.left}.x, ${ssaOp.left}.y, 0.0, ${ssaOp.right}.x, ${ssaOp.right}.y, 0.0, ${ssaOp.third}.x, ${ssaOp.third}.y, 0.0);`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                const cDerivative = c.derivative(varName);
                
                // The derivative of vec3(a,b,c) is vec3(da/dx,db/dx,dc/dx)
                return [
                    P.vec3(aDerivative[0], bDerivative[0], cDerivative[0]),
                    P.vec3(aDerivative[1], bDerivative[1], cDerivative[1]),
                    P.vec3(aDerivative[2], bDerivative[2], cDerivative[2])
                ];
            },
        });
    }

    static add(a, b) {
        a.assertType('float');
        b.assertType('float');
        if (a.op == 'const' && a.value == 0) return b;
        if (b.op == 'const' && b.value == 0) return a;
        return new Peptide('add', 'float', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars) + b.evaluate(vars),
            evaluateInterval: (vars) => a.evaluateInterval(vars).add(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} + ${ssaOp.right};`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.add(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} + ${ssaOp.right};`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = iadd(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                
                // The derivative of a+b is da/dx + db/dx
                return [
                    P.add(aDerivative[0], bDerivative[0]),
                    P.add(aDerivative[1], bDerivative[1]),
                    P.add(aDerivative[2], bDerivative[2])
                ];
            },
        });
    }

    static sub(a, b) {
        a.assertType('float');
        b.assertType('float');
        if (b.op == 'const' && b.value == 0) return a;
        return new Peptide('sub', 'float', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars) - b.evaluate(vars),
            evaluateInterval: (vars) => a.evaluateInterval(vars).sub(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} - ${ssaOp.right};`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.sub(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} - ${ssaOp.right};`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = isub(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                
                // The derivative of a-b is da/dx - db/dx
                return [
                    P.sub(aDerivative[0], bDerivative[0]),
                    P.sub(aDerivative[1], bDerivative[1]),
                    P.sub(aDerivative[2], bDerivative[2])
                ];
            },
        });
    }

    static mul(a, b) {
        a.assertType('float');
        b.assertType('float');
        if (b.op == 'const' && b.value == 1) return a;
        if (a.op == 'const' && a.value == 1) return b;
        if (a.op == 'const' && a.value == 0) return P.zero();
        if (b.op == 'const' && b.value == 0) return P.zero();
        return new Peptide('mul', 'float', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars) * b.evaluate(vars),
            evaluateInterval: (vars) => {
                if (a == b) {
                    return a.evaluateInterval(vars).sqr();
                }
                return a.evaluateInterval(vars).mul(b.evaluateInterval(vars));
            },
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
            jsIntervalCode: (ssaOp) => {
                if (ssaOp.left == ssaOp.right) {
                    return `${ssaOp.result} = ${ssaOp.left}.sqr();`;
                }
                return `${ssaOp.result} = ${ssaOp.left}.mul(${ssaOp.right});`;
            },
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
            glslIntervalCode: (ssaOp) => {
                if (ssaOp.left == ssaOp.right) {
                    return `${ssaOp.result} = isqr(${ssaOp.left});`;
                }
                return `${ssaOp.result} = imul(${ssaOp.left}, ${ssaOp.right});`;
            },
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                
                // The derivative of a*b is a*(db/dx) + b*(da/dx)
                return [
                    P.add(P.mul(a, bDerivative[0]), P.mul(b, aDerivative[0])),
                    P.add(P.mul(a, bDerivative[1]), P.mul(b, aDerivative[1])),
                    P.add(P.mul(a, bDerivative[2]), P.mul(b, aDerivative[2]))
                ];
            },
        });
    }

    static div(a, b) {
        a.assertType('float');
        b.assertType('float');
        if (b.op == 'const' && b.value == 1) return a;
        return new Peptide('div', 'float', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars) / b.evaluate(vars),
            evaluateInterval: (vars) => a.evaluateInterval(vars).div(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} / ${ssaOp.right};`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.div(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} / ${ssaOp.right};`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = idiv(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                
                // The derivative of a/b is (b*da/dx - a*db/dx)/b²
                const bSquared = P.mul(b, b);
                return [
                    P.div(P.sub(P.mul(b, aDerivative[0]), P.mul(a, bDerivative[0])), bSquared),
                    P.div(P.sub(P.mul(b, aDerivative[1]), P.mul(a, bDerivative[1])), bSquared),
                    P.div(P.sub(P.mul(b, aDerivative[2]), P.mul(a, bDerivative[2])), bSquared)
                ];
            },
        });
    }

    static mod(a, b) {
        a.assertType('float');
        b.assertType('float');
        return new Peptide('mod', 'float', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars) % b.evaluate(vars),
            evaluateInterval: (vars) => a.evaluateInterval(vars).mod(b.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} % ${ssaOp.right};`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mod(${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = mod(${ssaOp.left}, ${ssaOp.right});`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = imod(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                
                // The derivative of mod is complex and discontinuous at the boundaries
                // For a continuous approximation, we can use the derivative of a
                // since mod(a,b) behaves like a when a is within the range [0,b)
                return [
                    aDerivative[0],
                    aDerivative[1],
                    aDerivative[2]
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = iabs(${ssaOp.left});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                
                // The derivative of abs(x) is sign(x)
                // sign(x) = x/|x| for x ≠ 0, and 0 for x = 0
                return [
                    P.mul(P.sign(a), aDerivative[0]),
                    P.mul(P.sign(a), aDerivative[1]),
                    P.mul(P.sign(a), aDerivative[2])
                ];
            },
        });
    }

    static smoothabs(a) {
        a.assertType('float');
        return P.sqrt(P.add(P.mul(a, a), P.const(1e-10)));
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = imin(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                
                // The derivative of min(a,b) is:
                // - derivative of a where a < b
                // - derivative of b where b < a
                // - undefined where a = b
                const selectA = P.step(a, b);
                return [
                    P.add(P.mul(selectA, aDerivative[0]), P.mul(P.sub(P.const(1), selectA), bDerivative[0])),
                    P.add(P.mul(selectA, aDerivative[1]), P.mul(P.sub(P.const(1), selectA), bDerivative[1])),
                    P.add(P.mul(selectA, aDerivative[2]), P.mul(P.sub(P.const(1), selectA), bDerivative[2]))
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = imax(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                
                // The derivative of max(a,b) is:
                // - derivative of a where a > b
                // - derivative of b where b > a
                // - undefined where a = b
                const selectA = P.step(b, a);
                return [
                    P.add(P.mul(selectA, aDerivative[0]), P.mul(P.sub(P.const(1), selectA), bDerivative[0])),
                    P.add(P.mul(selectA, aDerivative[1]), P.mul(P.sub(P.const(1), selectA), bDerivative[1])),
                    P.add(P.mul(selectA, aDerivative[2]), P.mul(P.sub(P.const(1), selectA), bDerivative[2]))
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = iclamp(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const minDerivative = min.derivative(varName);
                const maxDerivative = max.derivative(varName);
                
                // The derivative of clamp(a, min, max) is:
                // - derivative of a when min < a < max
                // - derivative of min when a <= min
                // - derivative of max when a >= max
                const belowMin = P.step(P.sub(min, a), P.const(0));
                const aboveMax = P.step(P.sub(a, max), P.const(0));
                const inRange = P.sub(P.const(1), P.add(belowMin, aboveMax));
                
                return [
                    P.add(
                        P.add(
                            P.mul(belowMin, minDerivative[0]),
                            P.mul(inRange, aDerivative[0])
                        ),
                        P.mul(aboveMax, maxDerivative[0])
                    ),
                    P.add(
                        P.add(
                            P.mul(belowMin, minDerivative[1]),
                            P.mul(inRange, aDerivative[1])
                        ),
                        P.mul(aboveMax, maxDerivative[1])
                    ),
                    P.add(
                        P.add(
                            P.mul(belowMin, minDerivative[2]),
                            P.mul(inRange, aDerivative[2])
                        ),
                        P.mul(aboveMax, maxDerivative[2])
                    )
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = imix(${ssaOp.left}, ${ssaOp.right}, ${ssaOp.third});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                const bDerivative = b.derivative(varName);
                const tDerivative = t.derivative(varName);
                
                // The derivative of mix(a, b, t) = a*(1-t) + b*t is:
                // da/dx*(1-t) + db/dx*t + (b-a)*dt/dx
                const oneMinusT = P.sub(P.const(1), t);
                const bMinusA = P.sub(b, a);
                
                return [
                    P.add(
                        P.add(
                            P.mul(aDerivative[0], oneMinusT),
                            P.mul(bDerivative[0], t)
                        ),
                        P.mul(bMinusA, tDerivative[0])
                    ),
                    P.add(
                        P.add(
                            P.mul(aDerivative[1], oneMinusT),
                            P.mul(bDerivative[1], t)
                        ),
                        P.mul(bMinusA, tDerivative[1])
                    ),
                    P.add(
                        P.add(
                            P.mul(aDerivative[2], oneMinusT),
                            P.mul(bDerivative[2], t)
                        ),
                        P.mul(bMinusA, tDerivative[2])
                    )
                ];
            },
        });
    }

    static vmix(a, b, t) {
        a.assertType('vec3');
        b.assertType('vec3');
        t.assertType('float');
        return P.vec3(P.mix(P.vecX(a), P.vecX(b), t),
                      P.mix(P.vecY(a), P.vecY(b), t),
                      P.mix(P.vecZ(a), P.vecZ(b), t));
    }
    

    // 1 if edge <= x, 0 otherwise
    static step(edge, x) {
        edge.assertType('float');
        x.assertType('float');
        return new Peptide('step', 'float', null, edge, x, null, {
            evaluate: (vars) => {
                const edgev = edge.evaluate(vars);
                const xv = x.evaluate(vars);
                return xv < edgev ? 0.0 : 1.0;
            },
            evaluateInterval: (vars) => Ifloat.step(edge.evaluateInterval(vars), x.evaluateInterval(vars)),
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.right} < ${ssaOp.left} ? 0.0 : 1.0;`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = Ifloat.step(${ssaOp.left}, ${ssaOp.right});`,
            glslCode: (ssaOp) => `${ssaOp.result} = step(${ssaOp.left}, ${ssaOp.right});`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = istep(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                // The derivative of step(edge, x) is technically a Dirac delta function at x = edge
                // For numerical purposes, we approximate it as 0 everywhere
                // This is a reasonable approximation for most SDF applications
                return [
                    P.zero(),
                    P.zero(),
                    P.zero()
                ];
            },
        });
    }

    static smoothstep(edge0, edge1, x) {
        x.assertType('float');
        edge0.assertType('float');
        edge1.assertType('float');
        return P.mix(P.const(0.0), P.const(1.0), P.clamp(P.div(P.sub(x, edge0), P.sub(edge1, edge0)), P.const(0.0), P.const(1.0)));
    }

    static and(a, b) {
        a.assertType('float');
        b.assertType('float');
        return P.mul(a, b);
    }

    static or(a, b) {
        a.assertType('float');
        b.assertType('float');
        return P.not(P.and(P.not(a), P.not(b)));
    }

    static gte(a, b) {
        a.assertType('float');
        b.assertType('float');
        return P.step(b, a);
    }

    static lte(a, b) {
        a.assertType('float');
        b.assertType('float');
        return P.step(a, b);
    }

    static not(a) {
        a.assertType('float');
        return P.eq(a, P.zero());
    }

    static eq(a, b) {
        a.assertType('float');
        b.assertType('float');
        return P.mul(P.step(a, b), P.step(b, a));
    }

    static cond(a, b, c) {
        a.assertType('float');
        b.assertType('float');
        c.assertType('float');
        return P.mix(c, b, P.step(P.const(0.5), a));
    }

    static vcond(a, b, c) {
        a.assertType('float');
        b.assertType('vec3');
        c.assertType('vec3');
        return P.vmix(c, b, P.step(P.const(0.5), a));
    }

    static neg(a) {
        a.assertType('float');
        return P.sub(P.zero(), a);
    }

    static sign(x) {
        x.assertType('float');
        return new Peptide('sign', 'float', null, x, null, null, {
            evaluate: (vars) => {
                const xv = x.evaluate(vars);
                return xv > 0.0 ? 1.0 : (xv < 0.0 ? -1.0 : 0.0);
            },
            evaluateInterval: (vars) => {
                const interval = x.evaluateInterval(vars);
                if (interval.min > 0) return new Ifloat(1);
                if (interval.max < 0) return new Ifloat(-1);
                if (interval.min === 0 && interval.max === 0) return new Ifloat(0);
                // If the interval contains 0, the result could be -1, 0, or 1
                return new Ifloat(-1, 1);
            },
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} > 0.0 ? 1.0 : (${ssaOp.left} < 0.0 ? -1.0 : 0.0);`,
            jsIntervalCode: (ssaOp) => {
                return `if (${ssaOp.left}.min > 0) ${ssaOp.result} = new Ifloat(1);
                else if (${ssaOp.left}.max < 0) ${ssaOp.result} = new Ifloat(-1);
                else if (${ssaOp.left}.min === 0 && ${ssaOp.left}.max === 0) ${ssaOp.result} = new Ifloat(0);
                else ${ssaOp.result} = new Ifloat(-1, 1);`;
            },
            glslCode: (ssaOp) => `${ssaOp.result} = sign(${ssaOp.left});`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = isign(${ssaOp.left});`,
            derivative: (varName) => {
                // The derivative of sign(x) is technically 2*delta(x) where delta is the Dirac delta function
                // For numerical purposes, we approximate it as 0 everywhere
                // This is a reasonable approximation for most SDF applications
                return [
                    P.zero(),
                    P.zero(),
                    P.zero()
                ];
            },
        });
    }

    static smin(a, b, k) {
        a.assertType('float');
        b.assertType('float');
        k.assertType('float');
        // Add a small epsilon to k to avoid division by zero
        const safeK = P.max(k, P.const(1e-10));
        const h = P.clamp(P.add(P.const(0.5), P.div(P.sub(b, a), P.mul(P.const(2), safeK))), P.zero(), P.one());
        return P.sub(P.mix(b, a, h), P.mul(safeK, P.mul(h, P.sub(P.one(), h))));
    }

    static smax(a, b, k) {
        a.assertType('float');
        b.assertType('float');
        k.assertType('float');
        // Add a small epsilon to k to avoid division by zero
        const safeK = P.max(k, P.const(1e-10));
        const h = P.clamp(P.sub(P.const(0.5), P.div(P.sub(b, a), P.mul(P.const(2), safeK))), P.zero(), P.one());
        return P.add(P.mix(b, a, h), P.mul(safeK, P.mul(h, P.sub(P.one(), h))));
    }

    static absBevelC2(x, k, s) {
        x.assertType('float');
        k.assertType('float');
        s.assertType('float');
        
        const ax = P.div(P.abs(x), k);
        
        const v = P.div(P.sub(s, ax), P.sub(s, P.const(1.0)));
        const vCubed = P.mul(P.mul(v, v), v);
        
        const poly = P.add(
            P.const(0.5857864376269051),
            P.mul(
                vCubed,
                P.add(
                    P.const(0.14213562373095012),
                    P.mul(
                        P.add(
                            P.const(0.7867965644035753),
                            P.mul(P.const(-0.5147186257614305), v)
                        ),
                        v
                    )
                )
            )
        );
        
        const condition = P.step(ax, s);
        const term1 = P.add(P.const(0.5857864376269051), P.mul(P.const(0.4142135623730949), s));
        const term2 = P.mix(s, P.const(1.0), poly);
        
        return P.max(
            P.abs(x),
            P.mul(k, P.mix(term2, term1, condition))
        );
    }

    static rampBevelC2(x, k, s) {
        x.assertType('float');
        k.assertType('float');
        s.assertType('float');
        
        return P.mul(
            P.add(x, P.absBevelC2(x, k, s)),
            P.const(0.5)
        );
    }

    static chmin(a, b, k, s = P.const(0.9)) {
        a.assertType('float');
        b.assertType('float');
        k.assertType('float');
        s.assertType('float');
        
        const diff = P.sub(a, b);
        return P.sub(a, P.rampBevelC2(diff, k, s));
    }

    static chmax(a, b, k, s = P.const(0.9)) {
        a.assertType('float');
        b.assertType('float');
        k.assertType('float');
        s.assertType('float');
        
        const diff = P.sub(b, a);
        return P.add(a, P.rampBevelC2(diff, k, s));
    }

    static sqrt(a) {
        a.assertType('float');
        return new Peptide('sqrt', 'float', null, a, null, null, {
            evaluate: (vars) => Math.sqrt(a.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).sqrt(),
            jsCode: (ssaOp) => `${ssaOp.result} = Math.sqrt(${ssaOp.left});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.sqrt();`,
            glslCode: (ssaOp) => `${ssaOp.result} = sqrt(${ssaOp.left});`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = isqrt(${ssaOp.left});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                
                // The derivative of sqrt(x) is 1/(2*sqrt(x))
                // We need to handle the case where x is close to 0
                const safeA = P.max(a, P.const(1e-10));
                const factor = P.div(P.const(0.5), P.sqrt(safeA));
                
                return [
                    P.mul(factor, aDerivative[0]),
                    P.mul(factor, aDerivative[1]),
                    P.mul(factor, aDerivative[2])
                ];
            },
        });
    }

    static sin(a) {
        a.assertType('float');
        return new Peptide('sin', 'float', null, a, null, null, {
            evaluate: (vars) => Math.sin(a.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).sin(),
            jsCode: (ssaOp) => `${ssaOp.result} = Math.sin(${ssaOp.left});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.sin();`,
            glslCode: (ssaOp) => `${ssaOp.result} = sin(${ssaOp.left});`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = isin(${ssaOp.left});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                
                // The derivative of sin(x) is cos(x)
                const cosA = P.cos(a);
                
                return [
                    P.mul(cosA, aDerivative[0]),
                    P.mul(cosA, aDerivative[1]),
                    P.mul(cosA, aDerivative[2])
                ];
            },
        });
    }

    static cos(a) {
        a.assertType('float');
        return new Peptide('cos', 'float', null, a, null, null, {
            evaluate: (vars) => Math.cos(a.evaluate(vars)),
            evaluateInterval: (vars) => a.evaluateInterval(vars).cos(),
            jsCode: (ssaOp) => `${ssaOp.result} = Math.cos(${ssaOp.left});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.cos();`,
            glslCode: (ssaOp) => `${ssaOp.result} = cos(${ssaOp.left});`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = icos(${ssaOp.left});`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                
                // The derivative of cos(x) is -sin(x)
                const negSinA = P.neg(P.sin(a));
                
                return [
                    P.mul(negSinA, aDerivative[0]),
                    P.mul(negSinA, aDerivative[1]),
                    P.mul(negSinA, aDerivative[2])
                ];
            },
        });
    }

    static tan(a) {
        a.assertType('float');
        return P.div(P.sin(a), P.cos(a));
    }

    static vecX(a) {
        a.assertType('vec3');
        return new Peptide('vecX', 'float', null, a, null, null, {
            evaluate: (vars) => a.evaluate(vars).x,
            evaluateInterval: (vars) => a.evaluateInterval(vars).x,
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.x;`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.x;`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.x;`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}[0].xy;`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                
                // The derivative of vecX(a) extracts the x component of the derivative of a
                return [
                    P.vecX(aDerivative[0]),
                    P.vecX(aDerivative[1]),
                    P.vecX(aDerivative[2])
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}[1].xy;`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                
                // The derivative of vecY(a) extracts the y component of the derivative of a
                return [
                    P.vecY(aDerivative[0]),
                    P.vecY(aDerivative[1]),
                    P.vecY(aDerivative[2])
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}[2].xy;`,
            derivative: (varName) => {
                const aDerivative = a.derivative(varName);
                
                // The derivative of vecZ(a) extracts the z component of the derivative of a
                return [
                    P.vecZ(aDerivative[0]),
                    P.vecZ(aDerivative[1]),
                    P.vecZ(aDerivative[2])
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = transpose(${ssaOp.left});`,
            derivative: (varName) => {
                // Since matrices are constant, the derivative is zero
                return [
                    P.mzero(),
                    P.mzero(),
                    P.mzero()
                ];
            },
        });
    }

    static mvmul(a, b) {
        a.assertType('mat3');
        b.assertType('vec3');

        return new Peptide('mvmul', 'vec3', null, a, b, null, {
            evaluate: (vars) => a.evaluate(vars).mulVec3(b.evaluate(vars)),
            evaluateInterval: (vars) => {
                const aVal = a.evaluate(vars); // We'll still use the concrete matrix for simplicity
                const bInterval = b.evaluateInterval(vars);

                return bInterval.mvmul(aVal);
            },
            jsCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left}.mulVec3(${ssaOp.right});`,
            jsIntervalCode: (ssaOp) => `${ssaOp.result} = new Ivec3(new Ifloat(0).add(new Ifloat(${ssaOp.left}.m[0][0]).mul(${ssaOp.right}.x)).add(new Ifloat(${ssaOp.left}.m[0][1]).mul(${ssaOp.right}.y)).add(new Ifloat(${ssaOp.left}.m[0][2]).mul(${ssaOp.right}.z)), new Ifloat(0).add(new Ifloat(${ssaOp.left}.m[1][0]).mul(${ssaOp.right}.x)).add(new Ifloat(${ssaOp.left}.m[1][1]).mul(${ssaOp.right}.y)).add(new Ifloat(${ssaOp.left}.m[1][2]).mul(${ssaOp.right}.z)), new Ifloat(0).add(new Ifloat(${ssaOp.left}.m[2][0]).mul(${ssaOp.right}.x)).add(new Ifloat(${ssaOp.left}.m[2][1]).mul(${ssaOp.right}.y)).add(new Ifloat(${ssaOp.left}.m[2][2]).mul(${ssaOp.right}.z)));`,
            glslCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = imvmul(${ssaOp.left}, ${ssaOp.right});`,
            derivative: (varName) => {
                // Since matrices are constant, the derivative depends only on the vector
                const bDerivative = b.derivative(varName);
                
                // The derivative of M*v is M*dv/dx
                return [
                    P.mvmul(a, bDerivative[0]),
                    P.mvmul(a, bDerivative[1]),
                    P.mvmul(a, bDerivative[2])
                ];
            },
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
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = ${ssaOp.left} * ${ssaOp.right};`,
            derivative: (varName) => {
                // Since matrices are constant, the derivative is zero
                return [
                    P.mzero(),
                    P.mzero(),
                    P.mzero()
                ];
            },
        });
    }

    static texture3d(name, pos) {
        pos.assertType('vec3');
        return new Peptide('texture3d', 'float', name, pos, null, null, {
            evaluate: (vars) => {
                if (!(name in vars) || !vars[name].sample) {
                    throw new Error(`Texture '${name}' not found or not a valid texture`);
                }
                return vars[name].sample(pos.evaluate(vars));
            },
            evaluateInterval: (vars) => {
                if (!(name in vars) || !vars[name].sampleInterval) {
                    throw new Error(`Texture '${name}' not found or not a valid texture for interval arithmetic`);
                }
                return vars[name].sampleInterval(pos.evaluateInterval(vars));
            },
            jsCode: (ssaOp) => {
                return `if (!('${name}' in vars) || !vars['${name}'].sample) throw new Error("Texture '${name}' not found or not a valid texture");\n`
                    + `  ${ssaOp.result} = vars['${name}'].sample(${ssaOp.left});`;
            },
            jsIntervalCode: (ssaOp) => {
                return `if (!('${name}' in vars) || !vars['${name}'].sampleInterval) throw new Error("Texture '${name}' not found or not a valid texture for interval arithmetic");\n`
                    + `  ${ssaOp.result} = vars['${name}'].sampleInterval(${ssaOp.left});`;
            },
            glslCode: (ssaOp) => `${ssaOp.result} = texture(${name}, ${ssaOp.left}).r;`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = itexture3D(${name}, ${ssaOp.left});`,
            derivative: (varName) => {
                const posDerivative = pos.derivative(varName);
                
                // Using finite differences to approximate texture gradient
                // We'll create a small expression that computes the gradient at runtime
                
                // Define a small step size for finite differences
                const h = P.const(0.01); // Small step size
                
                // Create offset vectors for sampling in each direction
                const stepX = P.vec3(h, P.zero(), P.zero());
                const stepY = P.vec3(P.zero(), h, P.zero());
                const stepZ = P.vec3(P.zero(), P.zero(), h);
                
                // Sample the texture at the center point
                const centerValue = P.texture3d(name, pos);
                
                // Sample the texture at offset points
                const valueXPlus = P.texture3d(name, P.vadd(pos, stepX));
                const valueYPlus = P.texture3d(name, P.vadd(pos, stepY));
                const valueZPlus = P.texture3d(name, P.vadd(pos, stepZ));
                
                // Calculate finite differences (forward difference)
                const gradientX = P.div(P.sub(valueXPlus, centerValue), h);
                const gradientY = P.div(P.sub(valueYPlus, centerValue), h);
                const gradientZ = P.div(P.sub(valueZPlus, centerValue), h);
                
                // Create a gradient vector
                const gradient = P.vec3(gradientX, gradientY, gradientZ);
                
                // The derivative is the dot product of the gradient with the position derivative
                return [
                    P.vdot(gradient, posDerivative[0]),
                    P.vdot(gradient, posDerivative[1]),
                    P.vdot(gradient, posDerivative[2])
                ];
            },
        });
    }

    static vtexture3d(name, pos) {
        pos.assertType('vec3');
        return new Peptide('vtexture3d', 'vec3', name, pos, null, null, {
            evaluate: (vars) => {
                if (!(name in vars) || !vars[name].sampleVec) {
                    throw new Error(`Texture '${name}' not found or not a valid vector texture`);
                }
                return vars[name].sampleVec(pos.evaluate(vars));
            },
            evaluateInterval: (vars) => {
                if (!(name in vars) || !vars[name].sampleVecInterval) {
                    throw new Error(`Texture '${name}' not found or not a valid vector texture for interval arithmetic`);
                }
                return vars[name].sampleVecInterval(pos.evaluateInterval(vars));
            },
            jsCode: (ssaOp) => {
                return `if (!('${name}' in vars) || !vars['${name}'].sampleVec) throw new Error("Texture '${name}' not found or not a valid vector texture");\n`
                    + `  ${ssaOp.result} = vars['${name}'].sampleVec(${ssaOp.left});`;
            },
            jsIntervalCode: (ssaOp) => {
                return `if (!('${name}' in vars) || !vars['${name}'].sampleVecInterval) throw new Error("Texture '${name}' not found or not a valid vector texture for interval arithmetic");\n`
                    + `  ${ssaOp.result} = vars['${name}'].sampleVecInterval(${ssaOp.left});`;
            },
            glslCode: (ssaOp) => `${ssaOp.result} = texture(${name}, ${ssaOp.left}).rgb;`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = itexture3DVec(${name}, ${ssaOp.left});`,
            derivative: (varName) => {
                const posDerivative = pos.derivative(varName);
                
                // Using finite differences to approximate texture gradient
                // For vector textures, we need to compute the Jacobian matrix
                
                // Define a small step size for finite differences
                const h = P.const(0.01); // Small step size
                
                // Create offset vectors for sampling in each direction
                const stepX = P.vec3(h, P.zero(), P.zero());
                const stepY = P.vec3(P.zero(), h, P.zero());
                const stepZ = P.vec3(P.zero(), P.zero(), h);
                
                // Sample the texture at the center point
                const centerValue = P.vtexture3d(name, pos);
                
                // Sample the texture at offset points
                const valueXPlus = P.vtexture3d(name, P.vadd(pos, stepX));
                const valueYPlus = P.vtexture3d(name, P.vadd(pos, stepY));
                const valueZPlus = P.vtexture3d(name, P.vadd(pos, stepZ));
                
                // Calculate finite differences for each component
                const gradientX = P.vdiv(P.vsub(valueXPlus, centerValue), h);
                const gradientY = P.vdiv(P.vsub(valueYPlus, centerValue), h);
                const gradientZ = P.vdiv(P.vsub(valueZPlus, centerValue), h);
                
                // For each component of the derivative, we need to compute:
                // dF/dx_i = (dF/dp_x * dp_x/dx_i) + (dF/dp_y * dp_y/dx_i) + (dF/dp_z * dp_z/dx_i)
                // where p is the position and x_i is the variable we're differentiating with respect to
                
                // Extract components of the position derivatives
                const dx_dx = P.vecX(posDerivative[0]);
                const dy_dx = P.vecY(posDerivative[0]);
                const dz_dx = P.vecZ(posDerivative[0]);
                
                const dx_dy = P.vecX(posDerivative[1]);
                const dy_dy = P.vecY(posDerivative[1]);
                const dz_dy = P.vecZ(posDerivative[1]);
                
                const dx_dz = P.vecX(posDerivative[2]);
                const dy_dz = P.vecY(posDerivative[2]);
                const dz_dz = P.vecZ(posDerivative[2]);
                
                // Compute the derivatives using the chain rule
                return [
                    P.vadd(
                        P.vadd(
                            P.vmul(gradientX, dx_dx),
                            P.vmul(gradientY, dy_dx)
                        ),
                        P.vmul(gradientZ, dz_dx)
                    ),
                    P.vadd(
                        P.vadd(
                            P.vmul(gradientX, dx_dy),
                            P.vmul(gradientY, dy_dy)
                        ),
                        P.vmul(gradientZ, dz_dy)
                    ),
                    P.vadd(
                        P.vadd(
                            P.vmul(gradientX, dx_dz),
                            P.vmul(gradientY, dy_dz)
                        ),
                        P.vmul(gradientZ, dz_dz)
                    )
                ];
            },
        });
    }

    static texture2d(name, pos) {
        pos.assertType('vec3');
        return new Peptide('texture2d', 'float', name, pos, null, null, {
            evaluate: (vars) => {
                if (!(name in vars) || !vars[name].sample) {
                    throw new Error(`Texture '${name}' not found or not a valid texture`);
                }
                return vars[name].sample(pos.evaluate(vars));
            },
            evaluateInterval: (vars) => {
                if (!(name in vars) || !vars[name].sampleInterval) {
                    throw new Error(`Texture '${name}' not found or not a valid texture for interval arithmetic`);
                }
                return vars[name].sampleInterval([
                    pos.evaluateInterval(vars).x,
                    pos.evaluateInterval(vars).y
                ]);
            },
            jsCode: (ssaOp) => {
                return `if (!('${name}' in vars) || !vars['${name}'].sample) throw new Error("Texture '${name}' not found or not a valid texture");\n`
                    + `  ${ssaOp.result} = vars['${name}'].sample(${ssaOp.left});`;
            },
            jsIntervalCode: (ssaOp) => {
                return `if (!('${name}' in vars) || !vars['${name}'].sampleInterval) throw new Error("Texture '${name}' not found or not a valid texture for interval arithmetic");\n`
                    + `  ${ssaOp.result} = vars['${name}'].sampleInterval([${ssaOp.left}.x, ${ssaOp.left}.y]);`;
            },
            glslCode: (ssaOp) => `${ssaOp.result} = texture(${name}, ${ssaOp.left}.xy).r;`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = itexture2D(${name}, ${ssaOp.left});`,
            derivative: (varName) => {
                const posDerivative = pos.derivative(varName);
                
                // Using finite differences to approximate texture gradient
                // We'll create a small expression that computes the gradient at runtime
                
                // Define a small step size for finite differences
                const h = P.const(0.01); // Small step size
                
                // Create offset vectors for sampling in each direction
                const stepX = P.vec3(h, P.zero(), P.zero());
                const stepY = P.vec3(P.zero(), h, P.zero());
                
                // Sample the texture at the center point
                const centerValue = P.texture2d(name, pos);
                
                // Sample the texture at offset points
                const valueXPlus = P.texture2d(name, P.vadd(pos, stepX));
                const valueYPlus = P.texture2d(name, P.vadd(pos, stepY));
                
                // Calculate finite differences (forward difference)
                const gradientX = P.div(P.sub(valueXPlus, centerValue), h);
                const gradientY = P.div(P.sub(valueYPlus, centerValue), h);
                
                // Create a gradient vector (z component is 0 since we're in 2D)
                const gradient = P.vec3(gradientX, gradientY, P.zero());
                
                // The derivative is the dot product of the gradient with the position derivative
                return [
                    P.vdot(gradient, posDerivative[0]),
                    P.vdot(gradient, posDerivative[1]),
                    P.vdot(gradient, posDerivative[2])
                ];
            },
        });
    }

    static vtexture2d(name, pos) {
        pos.assertType('vec3');
        return new Peptide('vtexture2d', 'vec3', name, pos, null, null, {
            evaluate: (vars) => {
                if (!(name in vars) || !vars[name].sampleVec) {
                    throw new Error(`Texture '${name}' not found or not a valid vector texture`);
                }
                return vars[name].sampleVec(pos.evaluate(vars));
            },
            evaluateInterval: (vars) => {
                if (!(name in vars) || !vars[name].sampleVecInterval) {
                    throw new Error(`Texture '${name}' not found or not a valid vector texture for interval arithmetic`);
                }
                return vars[name].sampleVecInterval([
                    pos.evaluateInterval(vars).x,
                    pos.evaluateInterval(vars).y
                ]);
            },
            jsCode: (ssaOp) => {
                return `if (!('${name}' in vars) || !vars['${name}'].sampleVec) throw new Error("Texture '${name}' not found or not a valid vector texture");\n`
                    + `  ${ssaOp.result} = vars['${name}'].sampleVec(${ssaOp.left});`;
            },
            jsIntervalCode: (ssaOp) => {
                return `if (!('${name}' in vars) || !vars['${name}'].sampleVecInterval) throw new Error("Texture '${name}' not found or not a valid vector texture for interval arithmetic");\n`
                    + `  ${ssaOp.result} = vars['${name}'].sampleVecInterval([${ssaOp.left}.x, ${ssaOp.left}.y]);`;
            },
            glslCode: (ssaOp) => `${ssaOp.result} = texture(${name}, ${ssaOp.left}.xy).rgb;`,
            glslIntervalCode: (ssaOp) => `${ssaOp.result} = ivtexture2D(${name}, ${ssaOp.left});`,
            derivative: (varName) => {
                const posDerivative = pos.derivative(varName);
                
                // Using finite differences to approximate texture gradient
                // For vector textures, we need to compute the Jacobian matrix
                
                // Define a small step size for finite differences
                const h = P.const(0.01); // Small step size
                
                // Create offset vectors for sampling in each direction
                const stepX = P.vec3(h, P.zero(), P.zero());
                const stepY = P.vec3(P.zero(), h, P.zero());
                
                // Sample the texture at the center point
                const centerValue = P.vtexture2d(name, pos);
                
                // Sample the texture at offset points
                const valueXPlus = P.vtexture2d(name, P.vadd(pos, stepX));
                const valueYPlus = P.vtexture2d(name, P.vadd(pos, stepY));
                
                // Calculate finite differences for each component
                const gradientX = P.vdiv(P.vsub(valueXPlus, centerValue), h);
                const gradientY = P.vdiv(P.vsub(valueYPlus, centerValue), h);
                
                // For each component of the derivative, we need to compute:
                // dF/dx_i = (dF/dp_x * dp_x/dx_i) + (dF/dp_y * dp_y/dx_i)
                // where p is the position and x_i is the variable we're differentiating with respect to
                
                // Extract components of the position derivatives
                const dx_dx = P.vecX(posDerivative[0]);
                const dy_dx = P.vecY(posDerivative[0]);
                
                const dx_dy = P.vecX(posDerivative[1]);
                const dy_dy = P.vecY(posDerivative[1]);
                
                const dx_dz = P.vecX(posDerivative[2]);
                const dy_dz = P.vecY(posDerivative[2]);
                
                // Compute the derivatives using the chain rule
                return [
                    P.vadd(
                        P.vmul(gradientX, dx_dx),
                        P.vmul(gradientY, dy_dx)
                    ),
                    P.vadd(
                        P.vmul(gradientX, dx_dy),
                        P.vmul(gradientY, dy_dy)
                    ),
                    P.vadd(
                        P.vmul(gradientX, dx_dz),
                        P.vmul(gradientY, dy_dz)
                    )
                ];
            },
        });
    }


    static struct(data) {
        return new Peptide('struct', 'struct', data, null, null, null, {
            evaluate: (vars) => {
                const result = {};
                for (const key in data) {
                    result[key] = data[key].evaluate(vars);
                }
                return result;
            },
            evaluateInterval: (vars) => {
                const result = {};
                for (const key in data) {
                    result[key] = data[key].evaluateInterval(vars);
                }
                return result;
            },
            jsCode: (ssaOp) => { throw new Error('struct.jsCode not implemented'); },
            jsIntervalCode: (ssaOp) => { throw new Error('struct.jsIntervalCode not implemented'); },
            glslCode: (ssaOp) => { throw new Error('struct.glslCode not implemented'); },
            glslIntervalCode: (ssaOp) => { throw new Error('struct.glslIntervalCode not implemented'); },
            derivative: (varName) => { throw new Error('struct.derivative not implemented'); },
        });
    }

    static field(struct, field) {
        if (struct == null) return null;
        struct.assertType('struct');
        const node = struct.value[field];
        if (!node) {
            throw new Error(`Field '${field}' not found in struct`);
        }
        return node;
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
        } else if (this.type === 'struct' && !(result instanceof Object)) {
            throw new Error(`Operation '${this.op}' returned ${typeof result} but declared struct type`);
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
        } else if (this.type === 'struct' && !(result instanceof Object)) {
            throw new Error(`Operation '${this.op}' returned ${typeof result} but declared struct type`);
        }
        return result;
    }

    // take the derivative of the expression with respect to the given variable name, which
    // is assumed to be a vec3 variable, and the result is an array of three Peptide expressions,
    // corresponding to the three components of the derivative
    derivative(varName) {
        if (!this.cachedDerivative[varName]) {
            const derivFn = this.ops.derivative;
            if (!derivFn) {
                throw new Error(`Operation '${this.op}' has no derivative function`);
            }
            this.cachedDerivative[varName] = derivFn(varName);
        }
        return this.cachedDerivative[varName];
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
        if (this.type === 'struct') {
            // For structs, simplify each field individually
            for (const key in this.value) {
                this.value[key] = simplifyNode(this.value[key]);
            }
            return this;
        } else {
            return simplifyNode(this);
        }
    }

    toString() {
        if (this.value !== null) {
            return this.value.toString();
        } else if (this.third !== null) {
            return this.op + '(' + this.left.toString() + ', ' + this.right.toString() + ', ' + this.third.toString() + ')';
        } else if (this.right !== null) {
            return this.op + '(' + this.left.toString() + ', ' + this.right.toString() + ')';
        } else {
            return this.op + '(' + this.left.toString() + ')';
        }
    }

    ssa() {
        return new PeptideSSA(this);
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
