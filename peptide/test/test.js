// Basic test framework
class TestSuite {
    constructor() {
        this.tests = [];
        this.results = [];
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        this.results = [];
        for (const test of this.tests) {
            try {
                await test.fn();
                this.results.push({ name: test.name, passed: true });
            } catch (e) {
                // Use the full stack trace instead of just extracting one line
                this.results.push({ 
                    name: test.name, 
                    passed: false, 
                    error: e.message,
                    sourceLocation: e.stack || 'No stack trace available'
                });
            }
        }
        return this.results;
    }
}

// Enhanced assertion helpers
function assertEquals(a, b) {
    if (Math.abs(a - b) > 0.000001) {
        const error = new Error(`Expected ${a} to equal ${b}`);
        throw new Error(`Assertion failed\nExpected ${a} to equal ${b}\n${error.stack}`);
    }
}

function assertThrows(fn) {
    let threw = false;
    try {
        fn();
    } catch (e) {
        threw = true;
    }
    if (!threw) {
        const error = new Error('Expected function to throw');
        throw new Error(`Assertion failed\nExpected function to throw\n${error.stack}`);
    }
}

// Create test suites
const DirectT = new TestSuite();
const CompiledT = new TestSuite();
const IntervalT = new TestSuite();
const CompiledIntervalT = new TestSuite();

// Helper to add tests to all suites
function addTest(name, testFn) {
    const directEvaluator = (expr, vars = {}) => expr.evaluate(vars);
    const compiledEvaluator = (expr, vars = {}) => {
        const ssa = new PeptideSSA(expr);
        const src = ssa.compileToJS();
        return eval(src)(vars);
    };
    const intervalEvaluator = (expr, vars = {}) => {
        for (const key in vars) {
            if (typeof vars[key] === 'number') {
                vars[key] = new Ifloat(vars[key]);
            }
        }
        const result = expr.evaluateInterval(vars);
        if (result instanceof Ivec3) {
            return new Vec3(result.x.min, result.y.min, result.z.min);
        } else if (result instanceof Ifloat) {
            return result.min;
        } else {
            return result;
        }
    }
    const compiledIntervalEvaluator = (expr, vars = {}) => {
        for (const key in vars) {
            if (typeof vars[key] === 'number') {
                vars[key] = new Ifloat(vars[key]);
            }
        }
        const ssa = new PeptideSSA(expr);
        const src = ssa.compileToJSInterval();
        const result = eval(src)(vars);
        if (result instanceof Ivec3) {
            return new Vec3(result.x.min, result.y.min, result.z.min);
        } else if (result instanceof Ifloat) {
            return result.min;
        } else {
            return result;
        }
    };
    DirectT.test(`${name} (direct)`, () => testFn(directEvaluator));
    CompiledT.test(`${name} (compiled)`, () => testFn(compiledEvaluator));
    IntervalT.test(`${name} (interval)`, () => testFn(intervalEvaluator));
    CompiledIntervalT.test(`${name} (compiled interval)`, () => testFn(compiledIntervalEvaluator));
}

// Peptide tests
addTest('constant creation', (evaluate) => {
    const p = P.const(5);
    assertEquals(p.op, 'const');
    assertEquals(evaluate(p), 5);
});

addTest('basic arithmetic', (evaluate) => {
    const a = P.const(5);
    const b = P.const(3);
    
    const sum = P.add(a, b);
    assertEquals(evaluate(sum), 8);
    
    const diff = P.sub(a, b);
    assertEquals(evaluate(diff), 2);
    
    const prod = P.mul(a, b);
    assertEquals(evaluate(prod), 15);
    
    const quot = P.div(a, b);
    assertEquals(evaluate(quot), 5/3);
});

addTest('variable lookup', (evaluate) => {
    const x = P.var('x');
    assertEquals(evaluate(x, { x: 5 }), 5);
});

addTest('variable evaluation', (evaluate) => {
    const x = P.var('x');
    const expr = P.add(x, P.one());
    assertEquals(evaluate(expr, { x: 5 }), 6);
});

addTest('complex expression', (evaluate) => {
    // (x + 1) * (y - 2)
    const expr = P.mul(
        P.add(P.var('x'), P.one()),
        P.sub(P.var('y'), P.const(2))
    );
    assertEquals(evaluate(expr, { x: 3, y: 5 }), 12); // (3 + 1) * (5 - 2) = 4 * 3 = 12
});

addTest('min and max operations', (evaluate) => {
    const a = P.const(5);
    const b = P.const(3);
    
    const minimum = P.min(a, b);
    assertEquals(evaluate(minimum), 3);
    
    const maximum = P.max(a, b);
    assertEquals(evaluate(maximum), 5);
});

addTest('complex expression with all operations', (evaluate) => {
    // sqrt(max(x^2, y^2)) + min(x, y)
    const expr = P.add(
        P.sqrt(
            P.max(
                P.mul(P.var('x'), P.var('x')),
                P.mul(P.var('y'), P.var('y'))
            )
        ),
        P.min(P.var('x'), P.var('y'))
    );
    assertEquals(evaluate(expr, { x: 3, y: 4 }), 7); // sqrt(max(9, 16)) + min(3, 4) = 4 + 3 = 7
});

addTest('vector constant creation', (evaluate) => {
    const v = P.vconst(new Vec3(1, 2, 3));
    assertEquals(v.op, 'vconst');
    assertEquals(evaluate(v).x, 1);
    assertEquals(evaluate(v).y, 2);
    assertEquals(evaluate(v).z, 3);
});

addTest('vector variable lookup', (evaluate) => {
    const v = P.vvar('v');
    const result = evaluate(v, { v: new Vec3(1, 2, 3) });
    assertEquals(result.x, 1);
    assertEquals(result.y, 2);
    assertEquals(result.z, 3);
});

addTest('vector arithmetic', (evaluate) => {
    const a = P.vconst(new Vec3(1, 2, 3));
    const b = P.vconst(new Vec3(4, 5, 6));
    
    const sum = P.vadd(a, b);
    const sumResult = evaluate(sum);
    assertEquals(sumResult.x, 5);
    assertEquals(sumResult.y, 7);
    assertEquals(sumResult.z, 9);
    
    const diff = P.vsub(a, b);
    const diffResult = evaluate(diff);
    assertEquals(diffResult.x, -3);
    assertEquals(diffResult.y, -3);
    assertEquals(diffResult.z, -3);
    
    const c = P.const(2);
    const prod = P.vmul(a, c);
    const prodResult = evaluate(prod);
    assertEquals(prodResult.x, 2);
    assertEquals(prodResult.y, 4);
    assertEquals(prodResult.z, 6);
});

addTest('vector operations', (evaluate) => {
    const a = P.vconst(new Vec3(1, 2, 3));
    const b = P.vconst(new Vec3(4, 5, 6));
    
    const length = P.vlength(a);
    assertEquals(evaluate(length), Math.sqrt(14));  // sqrt(1^2 + 2^2 + 3^2)
    
    const dot = P.vdot(a, b);
    assertEquals(evaluate(dot), 32);  // 1*4 + 2*5 + 3*6
    
    const cross = P.vcross(a, b);
    const crossResult = evaluate(cross);
    assertEquals(crossResult.x, -3);  // 2*6 - 3*5
    assertEquals(crossResult.y, 6);   // 3*4 - 1*6
    assertEquals(crossResult.z, -3);  // 1*5 - 2*4
});

addTest('vec3 construction', (evaluate) => {
    const x = P.one();
    const y = P.const(2);
    const z = P.const(3);
    const vec = P.vec3(x, y, z);
    const result = evaluate(vec);
    assertEquals(result.x, 1);
    assertEquals(result.y, 2);
    assertEquals(result.z, 3);
});

addTest('complex vector expression', (evaluate) => {
    // (v1 + v2) · (v3 × v4)
    const v1 = P.vvar('var1');
    const v2 = P.vvar('var2');
    const v3 = P.vvar('var3');
    const v4 = P.vvar('var4');
    
    const expr = P.vdot(
        P.vadd(v1, v2),
        P.vcross(v3, v4)
    );
    
    const result = evaluate(expr, {
        var1: new Vec3(1, 0, 0),
        var2: new Vec3(0, 1, 0),
        var3: new Vec3(0, 0, 1),
        var4: new Vec3(1, 0, 0)
    });
    
    assertEquals(result, 1); // ((1,1,0) · (0,1,0)) = 1
});

addTest('type mismatch errors', (evaluate) => {
    const vec = P.vconst(new Vec3(1, 2, 3));
    const scalar = P.const(5);
    
    assertThrows(() => evaluate(P.vadd(vec, scalar)));
    assertThrows(() => evaluate(P.add(vec, scalar)));
});

addTest('insufficient arguments', (evaluate) => {
    assertThrows(() => evaluate(P.vec3(P.one(), P.const(2))));
    assertThrows(() => evaluate(P.add(P.one())));
});

addTest('invalid vector operations', (evaluate) => {
    assertThrows(() => evaluate(P.vcross(P.one(), P.vconst(new Vec3(1, 2, 3)))));
    assertThrows(() => evaluate(P.vdot(P.one(), P.vconst(new Vec3(1, 2, 3)))));
});

addTest('invalid scalar operations', (evaluate) => {
    assertThrows(() => evaluate(P.add(P.one(), P.vconst(new Vec3(1, 2, 3)))));
    assertThrows(() => evaluate(P.sqrt(P.vconst(new Vec3(1, 2, 3)))));
});

addTest('const type checking', (evaluate) => {
    assertThrows(() => evaluate(P.const('5')));
    assertThrows(() => evaluate(P.const({})));
    assertThrows(() => evaluate(P.const([])));
    assertThrows(() => evaluate(P.const(null)));
    assertThrows(() => evaluate(P.const(undefined)));
    // These should work
    evaluate(P.const(5));
    evaluate(P.const(5.5));
    evaluate(P.const(-5));
});

addTest('vconst type checking', (evaluate) => {
    assertThrows(() => evaluate(P.vconst({x: 1, y: 2, z: 3})));
    assertThrows(() => evaluate(P.vconst([1, 2, 3])));
    assertThrows(() => evaluate(P.vconst(null)));
    assertThrows(() => evaluate(P.vconst(undefined)));
    assertThrows(() => evaluate(P.vconst(5)));
    // This should work
    evaluate(P.vconst(new Vec3(1, 2, 3)));
});

addTest('vconst deep cloning', (evaluate) => {
    const original = new Vec3(1, 2, 3);
    const p = P.vconst(original);
    
    // Modify the original vector
    original.x = 10;
    original.y = 20;
    original.z = 30;
    
    // The evaluated result should have the original values
    const result = evaluate(p);
    assertEquals(result.x, 1);
    assertEquals(result.y, 2);
    assertEquals(result.z, 3);
    
    // The result should be a new instance
    const result2 = evaluate(p);
    assertEquals(result2.x, 1);
    assertEquals(result2.y, 2);
    assertEquals(result2.z, 3);
    
    // Verify we get a new instance each time
    result.x = 100;
    const result3 = evaluate(p);
    assertEquals(result3.x, 1);
});

addTest('vector component extraction', (evaluate) => {
    const v = P.vconst(new Vec3(1, 2, 3));
    
    const x = P.vecX(v);
    assertEquals(evaluate(x), 1);
    
    const y = P.vecY(v);
    assertEquals(evaluate(y), 2);
    
    const z = P.vecZ(v);
    assertEquals(evaluate(z), 3);
});

addTest('vector component extraction with variables', (evaluate) => {
    const v = P.vvar('v');
    
    const x = P.vecX(v);
    const y = P.vecY(v);
    const z = P.vecZ(v);
    
    const vars = { v: new Vec3(4, 5, 6) };
    assertEquals(evaluate(x, vars), 4);
    assertEquals(evaluate(y, vars), 5);
    assertEquals(evaluate(z, vars), 6);
});

addTest('vector component type checking', (evaluate) => {
    const scalar = P.const(5);
    
    assertThrows(() => evaluate(P.vecX(scalar)));
    assertThrows(() => evaluate(P.vecY(scalar)));
    assertThrows(() => evaluate(P.vecZ(scalar)));
});

addTest('expression DAG', (evaluate) => {
    const x = P.var('x');
    const y = P.var('y');
    const expr = P.add(P.mul(x, y), P.mul(x, y));
    assertEquals(evaluate(expr, { x: 2, y: 3 }), 12);
});

addTest('vector division', (evaluate) => {
    const v = P.vconst(new Vec3(6, 9, 12));
    const scalar = P.const(3);
    
    const div = P.vdiv(v, scalar);
    const result = evaluate(div);
    assertEquals(result.x, 2);
    assertEquals(result.y, 3);
    assertEquals(result.z, 4);
});

addTest('vector operations type checking', (evaluate) => {
    const vec = P.vconst(new Vec3(1, 2, 3));
    const scalar = P.const(5);
    
    // Test vmul with wrong types
    assertThrows(() => evaluate(P.vmul(scalar, scalar)));
    assertThrows(() => evaluate(P.vmul(vec, vec)));
    
    // Test vdiv with wrong types
    assertThrows(() => evaluate(P.vdiv(scalar, scalar)));
    assertThrows(() => evaluate(P.vdiv(vec, vec)));
});

addTest('expression simplification', (evaluate) => {
    const x = P.var('x');
    const commonExpr = P.mul(x, P.const(2));
    // Create an expression that uses the same subexpression twice
    const expr = P.add(commonExpr, commonExpr);
    
    // Simplify the expression
    const simplified = expr.simplify();
    
    // The result should still evaluate correctly
    assertEquals(evaluate(simplified, { x: 3 }), 12);
});

addTest('missing variable error messages', (evaluate) => {
    const x = P.var('x');
    const vx = P.vvar('vx');
    
    let error;
    try {
        evaluate(x, {});
    } catch (e) {
        error = e.message;
    }
    assertEquals(error, "Variable 'x' not found");
    
    try {
        evaluate(vx, {});
    } catch (e) {
        error = e.message;
    }
    assertEquals(error, "Vector variable 'vx' not found");
});

addTest('vector absolute value', (evaluate) => {
    // Test with constant vector
    const v = P.vconst(new Vec3(-1, -2, -3));
    const abs = P.vabs(v);
    const result = evaluate(abs);
    assertEquals(result.x, 1);
    assertEquals(result.y, 2);
    assertEquals(result.z, 3);
    
    // Test with variable vector
    const vv = P.vvar('v');
    const vabs = P.vabs(vv);
    const vars = { v: new Vec3(-4, 5, -6) };
    const result2 = evaluate(vabs, vars);
    assertEquals(result2.x, 4);
    assertEquals(result2.y, 5);
    assertEquals(result2.z, 6);
});

addTest('vabs type checking', (evaluate) => {
    const scalar = P.const(5);
    // Should throw when trying to take absolute value of a scalar
    assertThrows(() => evaluate(P.vabs(scalar)));
});

addTest('vector min/max operations', (evaluate) => {
    const v1 = P.vconst(new Vec3(1, 4, 2));
    const v2 = P.vconst(new Vec3(3, 2, 5));
    
    // Test vmin
    const vminResult = evaluate(P.vmin(v1, v2));
    assertEquals(vminResult.x, 1); // min(1, 3)
    assertEquals(vminResult.y, 2); // min(4, 2)
    assertEquals(vminResult.z, 2); // min(2, 5)
    
    // Test vmax
    const vmaxResult = evaluate(P.vmax(v1, v2));
    assertEquals(vmaxResult.x, 3); // max(1, 3)
    assertEquals(vmaxResult.y, 4); // max(4, 2)
    assertEquals(vmaxResult.z, 5); // max(2, 5)
    
    // Test with variables
    const vv1 = P.vvar('v1');
    const vv2 = P.vvar('v2');
    const vars = {
        v1: new Vec3(-1, 2, -3),
        v2: new Vec3(1, -2, 3)
    };
    
    const vminVarResult = evaluate(P.vmin(vv1, vv2), vars);
    assertEquals(vminVarResult.x, -1);
    assertEquals(vminVarResult.y, -2);
    assertEquals(vminVarResult.z, -3);
    
    const vmaxVarResult = evaluate(P.vmax(vv1, vv2), vars);
    assertEquals(vmaxVarResult.x, 1);
    assertEquals(vmaxVarResult.y, 2);
    assertEquals(vmaxVarResult.z, 3);
});

addTest('vector min/max type checking', (evaluate) => {
    const vec = P.vconst(new Vec3(1, 2, 3));
    const scalar = P.const(5);
    
    // Should throw when trying to use scalar with vector operations
    assertThrows(() => evaluate(P.vmin(vec, scalar)));
    assertThrows(() => evaluate(P.vmin(scalar, vec)));
    assertThrows(() => evaluate(P.vmax(vec, scalar)));
    assertThrows(() => evaluate(P.vmax(scalar, vec)));
});

addTest('clamp operations', (evaluate) => {
    const x = P.const(5);
    const min = P.const(2);
    const max = P.const(4);
    
    const clamped = P.clamp(x, min, max);
    assertEquals(evaluate(clamped), 4); // 5 clamped between 2 and 4
    
    const x2 = P.one();
    const clamped2 = P.clamp(x2, min, max);
    assertEquals(evaluate(clamped2), 2); // 1 clamped between 2 and 4
    
    const x3 = P.const(3);
    const clamped3 = P.clamp(x3, min, max);
    assertEquals(evaluate(clamped3), 3); // 3 stays between 2 and 4
});

addTest('mix operations', (evaluate) => {
    const a = P.zero();
    const b = P.const(10);
    const t = P.const(0.3);
    
    const mixed = P.mix(a, b, t);
    assertEquals(evaluate(mixed), 3); // mix(0, 10, 0.3) = 3
    
    const t2 = P.zero();
    const mixed2 = P.mix(a, b, t2);
    assertEquals(evaluate(mixed2), 0); // mix(0, 10, 0) = 0
    
    const t3 = P.one();
    const mixed3 = P.mix(a, b, t3);
    assertEquals(evaluate(mixed3), 10); // mix(0, 10, 1) = 10
});

addTest('smin operations', (evaluate) => {
    const a = P.const(5);
    const b = P.const(3);
    const k = P.one();
    
    // When values are far apart, smin should behave like min
    const sminResult = P.smin(a, b, k);
    assertEquals(evaluate(sminResult), 3);
    
    // When values are close, smin should be slightly less than min
    const c = P.const(1.1);
    const d = P.const(1.0);
    const sminClose = P.smin(c, d, k);
    const minClose = P.min(c, d);
    
    // smin should be less than regular min
    const sminVal = evaluate(sminClose);
    const minVal = evaluate(minClose);
    if (sminVal >= minVal) {
        throw new Error(`Expected smin(1.1, 1.0, 1.0) = ${sminVal} to be less than min(1.1, 1.0) = ${minVal}`);
    }
    
    // Test with k=0 (should behave exactly like min)
    const zeroK = P.zero();
    const sminZeroK = P.smin(a, b, zeroK);
    assertEquals(evaluate(sminZeroK), 3);
});

addTest('smax operations', (evaluate) => {
    const a = P.const(5);
    const b = P.const(3);
    const k = P.one();
    
    // When values are far apart, smax should behave like max
    const smaxResult = P.smax(a, b, k);
    assertEquals(evaluate(smaxResult), 5);
    
    // When values are close, smax should be slightly more than max
    const c = P.const(1.0);
    const d = P.const(1.1);
    const smaxClose = P.smax(c, d, k);
    const maxClose = P.max(c, d);
    
    // smax should be greater than regular max
    const smaxVal = evaluate(smaxClose);
    const maxVal = evaluate(maxClose);
    if (smaxVal <= maxVal) {
        throw new Error(`Expected smax(1.0, 1.1, 1.0) = ${smaxVal} to be greater than max(1.0, 1.1) = ${maxVal}`);
    }
    
    // Test with k=0 (should behave exactly like max)
    const zeroK = P.zero();
    const smaxZeroK = P.smax(a, b, zeroK);
    assertEquals(evaluate(smaxZeroK), 5);
});

addTest('chmin operations', (evaluate) => {
    const a = P.const(5);
    const b = P.const(3);
    const k = P.const(2);
    
    // Test basic chmin
    const chminResult = P.chmin(a, b, k);
    assertEquals(evaluate(chminResult), 3);
    
    // Test with close values
    const c = P.const(1.1);
    const d = P.const(1.0);
    const k2 = P.const(0.5);
    const chminClose = P.chmin(c, d, k2);
    const minClose = P.min(c, d);
    
    // chmin should be less than or equal to regular min
    const chminVal = evaluate(chminClose);
    const minVal = evaluate(minClose);
    if (chminVal > minVal) {
        throw new Error(`Expected chmin(1.1, 1.0, 0.5) = ${chminVal} to be less than or equal to min(1.1, 1.0) = ${minVal}`);
    }
    
    // Test with variables
    const va = P.var('x');
    const vb = P.var('y');
    const vk = P.var('k');
    
    const expr = P.chmin(va, vb, vk);
    const result = evaluate(expr, {
        x: 5,
        y: 3,
        k: 2
    });
    assertEquals(result, 3);
});

addTest('chmax operations', (evaluate) => {
    const a = P.const(5);
    const b = P.const(3);
    const k = P.const(2);
    
    // Test basic chmax
    const chmaxResult = P.chmax(a, b, k);
    assertEquals(evaluate(chmaxResult), 7.071); // max(max(5, 3), 0.7071*(5+3+2))
    
    // Test with close values
    const c = P.const(1.0);
    const d = P.const(1.1);
    const k2 = P.const(0.5);
    const chmaxClose = P.chmax(c, d, k2);
    const maxClose = P.max(c, d);
    
    // chmax should be greater than or equal to regular max
    const chmaxVal = evaluate(chmaxClose);
    const maxVal = evaluate(maxClose);
    if (chmaxVal < maxVal) {
        throw new Error(`Expected chmax(1.0, 1.1, 0.5) = ${chmaxVal} to be greater than or equal to max(1.0, 1.1) = ${maxVal}`);
    }
    
    // Test with variables
    const va = P.var('x');
    const vb = P.var('y');
    const vk = P.var('k');
    
    const expr = P.chmax(va, vb, vk);
    const result = evaluate(expr, {
        x: 5,
        y: 3,
        k: 2
    });
    assertEquals(result, 7.071);
});

addTest('step operations', (evaluate) => {
    // Test when first argument is less than second
    const a1 = P.const(2);
    const b1 = P.const(5);
    const step1 = P.step(a1, b1);
    assertEquals(evaluate(step1), 1.0); // 2 <= 5, should return 1.0
    
    // Test when first argument equals second
    const a2 = P.const(3);
    const b2 = P.const(3);
    const step2 = P.step(a2, b2);
    assertEquals(evaluate(step2), 1.0); // 3 <= 3, should return 1.0
    
    // Test when first argument is greater than second
    const a3 = P.const(7);
    const b3 = P.const(4);
    const step3 = P.step(a3, b3);
    assertEquals(evaluate(step3), 0.0); // 7 > 4, should return 0.0
    
    // Test with variables
    const va = P.var('x');
    const vb = P.var('y');
    const stepVar = P.step(va, vb);
    assertEquals(evaluate(stepVar, { x: 1, y: 2 }), 1.0); // 1 <= 2
    assertEquals(evaluate(stepVar, { x: 3, y: 2 }), 0.0); // 3 > 2
});

addTest('step type checking', (evaluate) => {
    const scalar = P.const(5);
    const vec = P.vconst(new Vec3(1, 2, 3));
    
    // Should throw when trying to use vector with step
    assertThrows(() => evaluate(P.step(vec, scalar)));
    assertThrows(() => evaluate(P.step(scalar, vec)));
});

addTest('trigonometric functions', (evaluate) => {
    // Test sin
    const angle = P.const(Math.PI / 2);
    const sinExpr = P.sin(angle);
    assertEquals(evaluate(sinExpr), 1.0); // sin(π/2) = 1
    
    // Test cos
    const cosExpr = P.cos(angle);
    assertEquals(evaluate(cosExpr), 0.0); // cos(π/2) = 0
    
    // Test with variables
    const x = P.var('x');
    const sinVar = P.sin(x);
    const cosVar = P.cos(x);
    
    assertEquals(evaluate(sinVar, { x: 0 }), 0.0); // sin(0) = 0
    assertEquals(evaluate(cosVar, { x: 0 }), 1.0); // cos(0) = 1
    
    // Test composition of sin and cos
    const composed = P.add(
        P.mul(P.sin(x), P.sin(x)),
        P.mul(P.cos(x), P.cos(x))
    );
    assertEquals(evaluate(composed, { x: 1.234 }), 1.0); // sin²(x) + cos²(x) = 1

    // Test tan
    const angle2 = P.const(Math.PI / 4);
    const tanExpr = P.tan(angle2);
    assertEquals(evaluate(tanExpr), 1.0); // tan(π/4) = 1

    // Test with variables
    const tanVar = P.tan(x);
    
    assertEquals(evaluate(tanVar, { x: 0 }), 0.0); // tan(0) = 0

    // Test composition of tan
    const composed2 = P.add(
        P.mul(P.tan(x), P.tan(x)),
        P.one()
    );
    assertEquals(evaluate(composed2, { x: Math.PI / 4 }), 2.0); // tan²(π/4) + 1 = 2
});

addTest('trigonometric type checking', (evaluate) => {
    const vec = P.vconst(new Vec3(1, 2, 3));
    
    // Should throw when trying to use vector with sin/cos
    assertThrows(() => evaluate(P.sin(vec)));
    assertThrows(() => evaluate(P.cos(vec)));

    // Should throw when trying to use vector with tan
    assertThrows(() => evaluate(P.tan(vec)));
});

addTest('vector modulo', (evaluate) => {
    // Test with constant vector and scalar
    const v = P.vconst(new Vec3(7, -8, 9));
    const s = P.const(4);
    const mod = P.vmod(v, s);
    const result = evaluate(mod);
    assertEquals(result.x, 3); // 7 mod 4 = 3
    assertEquals(result.y, 0); // -8 mod 4 = 0
    assertEquals(result.z, 1); // 9 mod 4 = 1
    
    // Test with variables
    const vv = P.vvar('v');
    const sv = P.var('s');
    const modVar = P.vmod(vv, sv);
    const result2 = evaluate(modVar, {
        v: new Vec3(10, 11, 12),
        s: 3
    });
    assertEquals(result2.x, 1); // 10 mod 3 = 1
    assertEquals(result2.y, 2); // 11 mod 3 = 2
    assertEquals(result2.z, 0); // 12 mod 3 = 0
});

addTest('vmod type checking', (evaluate) => {
    const vec = P.vconst(new Vec3(1, 2, 3));
    const scalar = P.const(2);
    
    // Should throw when trying to use vector as second argument
    assertThrows(() => evaluate(P.vmod(vec, vec)));
    // Should throw when trying to use scalar as first argument
    assertThrows(() => evaluate(P.vmod(scalar, scalar)));
});

addTest('absolute value', (evaluate) => {
    // Test with positive number
    const pos = P.const(5);
    const absPos = P.abs(pos);
    assertEquals(evaluate(absPos), 5);
    
    // Test with negative number
    const neg = P.const(-3);
    const absNeg = P.abs(neg);
    assertEquals(evaluate(absNeg), 3);
    
    // Test with variable
    const x = P.var('x');
    const absVar = P.abs(x);
    assertEquals(evaluate(absVar, { x: -7 }), 7);
    assertEquals(evaluate(absVar, { x: 4 }), 4);
    
    // Test with expression
    const expr = P.abs(P.sub(P.const(3), P.const(5)));
    assertEquals(evaluate(expr), 2); // abs(3 - 5) = 2
});

addTest('abs type checking', (evaluate) => {
    const vec = P.vconst(new Vec3(1, 2, 3));
    // Should throw when trying to use vector with abs
    assertThrows(() => evaluate(P.abs(vec)));
});

addTest('matrix operations - rotateToAxis', (evaluate) => {
    // Test with a simple axis
    const rotMatrix = P.mconst(new Mat3().rotateToAxis(new Vec3(0, 0, 1)));
    const result = evaluate(rotMatrix);
    
    // For z-axis, the rotation matrix should be identity-like
    // (might have small floating point differences)
    assertEquals(Math.abs(result.m[0]), 1);
    assertEquals(Math.abs(result.m[4]), 1);
    assertEquals(Math.abs(result.m[8]), 1);
    
    // Test with a normalized vector
    const v = P.vconst(new Vec3(1, 1, 1).normalize());
    const rotMatrix2 = P.mconst(new Mat3().rotateToAxis(new Vec3(1, 1, 1).normalize()));
    const result2 = evaluate(rotMatrix2);
    
    // The resulting matrix should be orthogonal (transpose = inverse)
    // Test by multiplying a vector and checking it aligns with the axis
    const testVec = new Vec3(0, 0, 1);
    const rotated = result2.mulVec3(testVec);
    const dot = rotated.normalize().dot(evaluate(v).normalize());
    assertEquals(Math.abs(dot), 1, 0.0001); // Vectors should be parallel
});

addTest('matrix operations - mtranspose', (evaluate) => {
    // Create a test matrix using rotateToAxis
    const matrix = P.mconst(new Mat3().rotateToAxis(new Vec3(1, 2, 3).normalize()));
    const transposed = P.mtranspose(matrix);
    
    const m = evaluate(matrix);
    const mt = evaluate(transposed);
    
    // Check that the transpose operation works correctly
    assertEquals(m.m[0], mt.m[0]); // [0,0] element stays the same
    assertEquals(m.m[1], mt.m[3]); // [0,1] becomes [1,0]
    assertEquals(m.m[2], mt.m[6]); // [0,2] becomes [2,0]
    assertEquals(m.m[3], mt.m[1]); // [1,0] becomes [0,1]
    assertEquals(m.m[4], mt.m[4]); // [1,1] element stays the same
    assertEquals(m.m[5], mt.m[7]); // [1,2] becomes [2,1]
    assertEquals(m.m[6], mt.m[2]); // [2,0] becomes [0,2]
    assertEquals(m.m[7], mt.m[5]); // [2,1] becomes [1,2]
    assertEquals(m.m[8], mt.m[8]); // [2,2] element stays the same
});

addTest('matrix operations - mvmul', (evaluate) => {
    // Create a test matrix (rotation around z-axis by 90 degrees)
    const rotZ90 = new Mat3(
        0, -1, 0,
        1, 0, 0,
        0, 0, 1
    );
    const matExpr = P.mconst(rotZ90);
    
    // Test vector
    const vecX = P.vconst(new Vec3(1, 0, 0));
    
    // Multiply matrix by vector
    const result = P.mvmul(matExpr, vecX);
    const resultVec = evaluate(result);
    
    // Rotating (1,0,0) by 90 degrees around z should give (0,1,0)
    assertEquals(resultVec.x, 0, 0.0001);
    assertEquals(resultVec.y, 1, 0.0001);
    assertEquals(resultVec.z, 0, 0.0001);
    
    // Test with variables
    const matVar = P.mvar('mat');
    const vecVar = P.vvar('vec');
    const mulExpr = P.mvmul(matVar, vecVar);
    
    const vars = {
        mat: new Mat3(
            0, 1, 0,
            -1, 0, 0,
            0, 0, 1
        ),
        vec: new Vec3(0, 1, 0)
    };
    
    const varResult = evaluate(mulExpr, vars);
    // Rotating (0,1,0) by -90 degrees around z should give (1,0,0)
    assertEquals(varResult.x, 1, 0.0001);
    assertEquals(varResult.y, 0, 0.0001);
    assertEquals(varResult.z, 0, 0.0001);
});

addTest('matrix operations - mmul', (evaluate) => {
    // Create two test matrices
    const rotX90 = new Mat3(
        1, 0, 0,
        0, 0, -1,
        0, 1, 0
    );
    const rotZ90 = new Mat3(
        0, -1, 0,
        1, 0, 0,
        0, 0, 1
    );
    
    const matX = P.mconst(rotX90);
    const matZ = P.mconst(rotZ90);
    
    // Multiply matrices
    const result = P.mmul(matX, matZ);
    const resultMat = evaluate(result);
    
    // Test the result by applying to a vector
    const testVec = new Vec3(1, 0, 0);
    const expected = rotX90.mulVec3(rotZ90.mulVec3(testVec));
    const actual = resultMat.mulVec3(testVec);
    
    assertEquals(actual.x, expected.x, 0.0001);
    assertEquals(actual.y, expected.y, 0.0001);
    assertEquals(actual.z, expected.z, 0.0001);
    
    // Test with variables
    const matA = P.mvar('matA');
    const matB = P.mvar('matB');
    const mulExpr = P.mmul(matA, matB);
    
    const vars = {
        matA: rotX90,
        matB: rotZ90
    };
    
    const varResult = evaluate(mulExpr, vars);
    const varActual = varResult.mulVec3(testVec);
    
    assertEquals(varActual.x, expected.x, 0.0001);
    assertEquals(varActual.y, expected.y, 0.0001);
    assertEquals(varActual.z, expected.z, 0.0001);
});

addTest('matrix operations type checking', (evaluate) => {
    const vec = P.vconst(new Vec3(1, 2, 3));
    const scalar = P.const(5);
    const mat = P.mconst(new Mat3().rotateToAxis(new Vec3(1, 2, 3).normalize()));
    
    // Test mtranspose with wrong type
    assertThrows(() => evaluate(P.mtranspose(vec)));
    assertThrows(() => evaluate(P.mtranspose(scalar)));
    
    // Test mvmul with wrong types
    assertThrows(() => evaluate(P.mvmul(vec, vec)));
    assertThrows(() => evaluate(P.mvmul(scalar, vec)));
    assertThrows(() => evaluate(P.mvmul(mat, scalar)));
    
    // Test mmul with wrong types
    assertThrows(() => evaluate(P.mmul(vec, mat)));
    assertThrows(() => evaluate(P.mmul(scalar, mat)));
    assertThrows(() => evaluate(P.mmul(mat, vec)));
    assertThrows(() => evaluate(P.mmul(mat, scalar)));
});

addTest('matrix operations - combined', (evaluate) => {
    // Create a test vector
    const v = P.vconst(new Vec3(1, 2, 3));
    
    // Create a rotation matrix
    const axis = P.vconst(new Vec3(0, 1, 0)); // y-axis
    const rotMat = P.mconst(new Mat3().rotateToAxis(new Vec3(0, 1, 0)));
    
    // Rotate the vector
    const rotated = P.mvmul(rotMat, v);
    
    // Transpose the matrix
    const transposed = P.mtranspose(rotMat);
    
    // Rotate back using the transposed matrix (inverse for rotation matrices)
    const rotatedBack = P.mvmul(transposed, rotated);
    
    // The result should be close to the original vector
    const result = evaluate(rotatedBack);
    const original = evaluate(v);
    
    assertEquals(result.x, original.x, 0.0001);
    assertEquals(result.y, original.y, 0.0001);
    assertEquals(result.z, original.z, 0.0001);
});

// Direct Ifloat tests
addTest('interval creation', (evaluate) => {
    const i1 = new Ifloat(3, 5);
    assertEquals(i1.min, 3);
    assertEquals(i1.max, 5);
    
    // Test auto-swap when min > max
    const i2 = new Ifloat(7, 2);
    assertEquals(i2.min, 2);
    assertEquals(i2.max, 7);
    
    // Test single value constructor
    const i3 = new Ifloat(4);
    assertEquals(i3.min, 4);
    assertEquals(i3.max, 4);
});

addTest('interval basic arithmetic', (evaluate) => {
    const i1 = new Ifloat(2, 5);
    const i2 = new Ifloat(3, 7);
    
    // Addition
    const sum = i1.add(i2);
    assertEquals(sum.min, 5);  // 2 + 3
    assertEquals(sum.max, 12); // 5 + 7
    
    // Subtraction
    const diff = i1.sub(i2);
    assertEquals(diff.min, -5); // 2 - 7
    assertEquals(diff.max, 2);  // 5 - 3
    
    // Multiplication
    const prod = i1.mul(i2);
    assertEquals(prod.min, 6);  // 2 * 3
    assertEquals(prod.max, 35); // 5 * 7
    
    // Division
    const quot = i1.div(i2);
    assertEquals(quot.min, 2/7);  // 2 / 7
    assertEquals(quot.max, 5/3);  // 5 / 3
});

addTest('interval operations with negative values', (evaluate) => {
    const i1 = new Ifloat(-3, 2);
    const i2 = new Ifloat(-1, 4);
    
    // Addition
    const sum = i1.add(i2);
    assertEquals(sum.min, -4);  // -3 + (-1)
    assertEquals(sum.max, 6);   // 2 + 4
    
    // Subtraction
    const diff = i1.sub(i2);
    assertEquals(diff.min, -7); // -3 - 4
    assertEquals(diff.max, 3);  // 2 - (-1)
    
    // Multiplication
    const prod = i1.mul(i2);
    assertEquals(prod.min, -12); // -3 * 4
    assertEquals(prod.max, 8);   // 2 * 4
});

addTest('interval modulo', (evaluate) => {
    const i1 = new Ifloat(3, 8);
    const i2 = new Ifloat(2, 3);
    
    // Modulo
    const mod = i1.mod(i2);
    assertEquals(mod.min, 0);  // 3 % 3
    assertEquals(mod.max, 2);  // 8 % 2
    
    // Square root
    const sqrt = i1.sqrt();
    assertEquals(sqrt.min, Math.sqrt(3));
    assertEquals(sqrt.max, Math.sqrt(8));
});

// Peptide interval evaluation tests
addTest('evaluateInterval for constants', (evaluate) => {
    const p = P.const(5);
    const interval = p.evaluateInterval({});
    assertEquals(interval.min, 5);
    assertEquals(interval.max, 5);
});

addTest('evaluateInterval for variables', (evaluate) => {
    const x = P.var('x');
    
    // Test with scalar value
    const interval1 = x.evaluateInterval({ x: 3 });
    assertEquals(interval1.min, 3);
    assertEquals(interval1.max, 3);
    
    // Test with interval value
    const interval2 = x.evaluateInterval({ x: new Ifloat(2, 7) });
    assertEquals(interval2.min, 2);
    assertEquals(interval2.max, 7);
});

addTest('evaluateInterval for addition', (evaluate) => {
    const a = P.const(3);
    const b = P.const(5);
    const sum = P.add(a, b);
    
    const interval = sum.evaluateInterval({});
    assertEquals(interval.min, 8);
    assertEquals(interval.max, 8);
    
    // Test with variable intervals
    const x = P.var('x');
    const y = P.var('y');
    const varSum = P.add(x, y);
    
    const intervalVars = varSum.evaluateInterval({
        x: new Ifloat(1, 3),
        y: new Ifloat(2, 4)
    });
    assertEquals(intervalVars.min, 3);
    assertEquals(intervalVars.max, 7);
});

addTest('evaluateInterval for subtraction', (evaluate) => {
    const x = P.var('x');
    const y = P.var('y');
    const diff = P.sub(x, y);
    
    const interval = diff.evaluateInterval({
        x: new Ifloat(5, 10),
        y: new Ifloat(2, 4)
    });
    assertEquals(interval.min, 1);  // 5 - 4
    assertEquals(interval.max, 8);  // 10 - 2
});

addTest('evaluateInterval for multiplication', (evaluate) => {
    const x = P.var('x');
    const y = P.var('y');
    const prod = P.mul(x, y);
    
    const interval = prod.evaluateInterval({
        x: new Ifloat(2, 3),
        y: new Ifloat(-1, 4)
    });
    assertEquals(interval.min, -3);  // 3 * (-1)
    assertEquals(interval.max, 12);  // 3 * 4
});

addTest('evaluateInterval for complex expressions', (evaluate) => {
    // (x + 1) * (y - 2)
    const expr = P.mul(
        P.add(P.var('x'), P.one()),
        P.sub(P.var('y'), P.const(2))
    );

    const x = new Ifloat(3, 5);
    const y = new Ifloat(1, 6);

    const xPlus1 = x.add(new Ifloat(1));
    assertEquals(xPlus1.min, 4);
    assertEquals(xPlus1.max, 6);

    const yMinus2 = y.sub(new Ifloat(2));
    assertEquals(yMinus2.min, -1);
    assertEquals(yMinus2.max, 4);

    const product = xPlus1.mul(yMinus2);
    assertEquals(product.min, -6);
    assertEquals(product.max, 24);

    const interval = expr.evaluateInterval({
        x: x,
        y: y
    });
    
    // (3+1)*(1-2) to (5+1)*(6-2)
    // 6*(-1) to 6*4
    assertEquals(interval.min, -6);
    assertEquals(interval.max, 24);
});

addTest('evaluateInterval error handling', (evaluate) => {
    const x = P.var('x');
    
    // Missing variable
    assertThrows(() => x.evaluateInterval({}));
    assertThrows(() => x.evaluateInterval({ x: "not a number or interval" }));
});

addTest('complex DAG simplification', (evaluate) => {
    // Create expressions with common subexpressions
    const x = P.var('x');
    const y = P.var('y');
    
    // Use it multiple times
    const expr1 = P.mul(P.add(x, y), P.add(x, y));
    const expr2 = P.add(P.add(x, y), P.const(5));
    
    // Combine them
    const combined = P.add(expr1, expr2);

    const result = combined.evaluate({ x: 2, y: 3 });
    assertEquals(result, 35);

    // But should have fewer nodes (due to sharing the common subexpression)
    // Count nodes in the original vs simplified
    const countNodes = (expr, visited = new Set()) => {
        if (!expr || visited.has(expr)) return 0;
        visited.add(expr);
        return 1 + 
            (expr.left ? countNodes(expr.left, visited) : 0) + 
            (expr.right ? countNodes(expr.right, visited) : 0) + 
            (expr.third ? countNodes(expr.third, visited) : 0);
    };
    
    const originalCount = countNodes(combined);
    combined.simplify();
    const simplifiedCount = countNodes(combined);

    if (simplifiedCount >= originalCount) {
        throw new Error(`Expected simplified expression to have fewer nodes (${simplifiedCount} vs ${originalCount})`);
    }
    
    // The simplified expression should evaluate to the same result
    assertEquals(evaluate(combined, { x: 2, y: 3 }), result);
});

addTest('missing operation functions', (evaluate) => {
    // Create a Peptide instance with missing operation functions
    const missingOps = new Peptide('test', 'float', 5, null, null, null, {
        // Only provide evaluate, missing other functions
        evaluate: (vars) => 5
    });
    
    // Should still be able to evaluate
    assertEquals(missingOps.evaluate(), 5);
    
    // But other operations should throw
    assertThrows(() => missingOps.evaluateInterval());
});

addTest('modulo operations', (evaluate) => {
    // Basic positive modulo
    const a = P.const(7);
    const b = P.const(3);
    const mod1 = P.mod(a, b);
    assertEquals(evaluate(mod1), 1); // 7 mod 3 = 1
    
    // Negative dividend
    const c = P.const(7);
    const mod2 = P.mod(c, b);
    assertEquals(evaluate(mod2), 1); // 7 mod 3 = 1
});

addTest('interval square', (evaluate) => {
    const x = P.var('x');
    const square = P.mul(x, x);
    const interval = square.evaluateInterval({ x: new Ifloat(-2, 3) });
    assertEquals(interval.min, 0);
    assertEquals(interval.max, 9);
});

addTest('interval vlength', (evaluate) => {
    const x = P.var('x');
    const y = P.var('y');
    const z = P.var('z');
    const vlength = P.vlength(P.vec3(x, y, z));
    const interval = vlength.evaluateInterval({ x: new Ifloat(-2, 3), y: new Ifloat(-2, 3), z: new Ifloat(-2, 3) });
    assertEquals(interval.min, 0);
    assertEquals(interval.max, Math.sqrt(3 * 3*3));
});

addTest('sign operations', (evaluate) => {
    // Test with positive number
    const pos = P.const(5);
    const signPos = P.sign(pos);
    assertEquals(evaluate(signPos), 1);
    
    // Test with negative number
    const neg = P.const(-3);
    const signNeg = P.sign(neg);
    assertEquals(evaluate(signNeg), -1);
    
    // Test with zero
    const zero = P.zero();
    const signZero = P.sign(zero);
    assertEquals(evaluate(signZero), 0);
    
    // Test with variable
    const x = P.var('x');
    const signVar = P.sign(x);
    assertEquals(evaluate(signVar, { x: -7 }), -1);
    assertEquals(evaluate(signVar, { x: 4 }), 1);
    assertEquals(evaluate(signVar, { x: 0 }), 0);
    
    // Test with expression
    const expr = P.sign(P.sub(P.const(3), P.const(5)));
    assertEquals(evaluate(expr), -1); // sign(3 - 5) = sign(-2) = -1
});

addTest('sign type checking', (evaluate) => {
    const vec = P.vconst(new Vec3(1, 2, 3));
    // Should throw when trying to use vector with sign
    assertThrows(() => evaluate(P.sign(vec)));
});

addTest('sign interval evaluation', (evaluate) => {
    const x = P.var('x');
    const signX = P.sign(x);
    
    // Test with positive interval
    const posInterval = signX.evaluateInterval({ x: new Ifloat(2, 5) });
    assertEquals(posInterval.min, 1);
    assertEquals(posInterval.max, 1);
    
    // Test with negative interval
    const negInterval = signX.evaluateInterval({ x: new Ifloat(-5, -2) });
    assertEquals(negInterval.min, -1);
    assertEquals(negInterval.max, -1);
    
    // Test with interval containing zero
    const mixedInterval = signX.evaluateInterval({ x: new Ifloat(-3, 4) });
    assertEquals(mixedInterval.min, -1);
    assertEquals(mixedInterval.max, 1);
    
    // Test with interval that is exactly zero
    const zeroInterval = signX.evaluateInterval({ x: new Ifloat(0, 0) });
    assertEquals(zeroInterval.min, 0);
    assertEquals(zeroInterval.max, 0);
});

addTest('logical and operation', (evaluate) => {
    // Test with two true values (non-zero)
    const a1 = P.const(5);
    const b1 = P.const(3);
    const and1 = P.and(a1, b1);
    assertEquals(evaluate(and1), 15); // 5 * 3 = 15 (logical AND is implemented as multiplication)
    
    // Test with one false value (zero)
    const a2 = P.zero();
    const b2 = P.const(7);
    const and2 = P.and(a2, b2);
    assertEquals(evaluate(and2), 0); // 0 * 7 = 0
    
    // Test with both false values
    const a3 = P.zero();
    const b3 = P.zero();
    const and3 = P.and(a3, b3);
    assertEquals(evaluate(and3), 0); // 0 * 0 = 0
    
    // Test with variables
    const va = P.var('x');
    const vb = P.var('y');
    const andVar = P.and(va, vb);
    assertEquals(evaluate(andVar, { x: 2, y: 3 }), 6); // 2 * 3 = 6
    assertEquals(evaluate(andVar, { x: 0, y: 3 }), 0); // 0 * 3 = 0
});

addTest('greater than or equal operation', (evaluate) => {
    // Test when first argument is greater than second
    const a1 = P.const(7);
    const b1 = P.const(3);
    const gte1 = P.gte(a1, b1);
    assertEquals(evaluate(gte1), 1.0); // 7 >= 3, should return 1.0
    
    // Test when first argument equals second
    const a2 = P.const(5);
    const b2 = P.const(5);
    const gte2 = P.gte(a2, b2);
    assertEquals(evaluate(gte2), 1.0); // 5 >= 5, should return 1.0
    
    // Test when first argument is less than second
    const a3 = P.const(2);
    const b3 = P.const(8);
    const gte3 = P.gte(a3, b3);
    assertEquals(evaluate(gte3), 0.0); // 2 < 8, should return 0.0
    
    // Test with variables
    const va = P.var('x');
    const vb = P.var('y');
    const gteVar = P.gte(va, vb);
    assertEquals(evaluate(gteVar, { x: 5, y: 2 }), 1.0); // 5 >= 2
    assertEquals(evaluate(gteVar, { x: 3, y: 3 }), 1.0); // 3 >= 3
    assertEquals(evaluate(gteVar, { x: 1, y: 4 }), 0.0); // 1 < 4
});

addTest('less than or equal operation', (evaluate) => {
    // Test when first argument is less than second
    const a1 = P.const(3);
    const b1 = P.const(7);
    const lte1 = P.lte(a1, b1);
    assertEquals(evaluate(lte1), 1.0); // 3 <= 7, should return 1.0
    
    // Test when first argument equals second
    const a2 = P.const(5);
    const b2 = P.const(5);
    const lte2 = P.lte(a2, b2);
    assertEquals(evaluate(lte2), 1.0); // 5 <= 5, should return 1.0
    
    // Test when first argument is greater than second
    const a3 = P.const(8);
    const b3 = P.const(2);
    const lte3 = P.lte(a3, b3);
    assertEquals(evaluate(lte3), 0.0); // 8 > 2, should return 0.0
    
    // Test with variables
    const va = P.var('x');
    const vb = P.var('y');
    const lteVar = P.lte(va, vb);
    assertEquals(evaluate(lteVar, { x: 2, y: 5 }), 1.0); // 2 <= 5
    assertEquals(evaluate(lteVar, { x: 3, y: 3 }), 1.0); // 3 <= 3
    assertEquals(evaluate(lteVar, { x: 4, y: 1 }), 0.0); // 4 > 1
});

addTest('logical not operation', (evaluate) => {
    // Test with true value (non-zero)
    const a1 = P.const(5);
    const not1 = P.not(a1);
    assertEquals(evaluate(not1), 0); // not(5) = 1 - 1 = 0
    
    // Test with false value (zero)
    const a2 = P.zero();
    const not2 = P.not(a2);
    assertEquals(evaluate(not2), 1); // not(0) = 1 - 0 = 1
    
    // Test with variables
    const va = P.var('x');
    const notVar = P.not(va);
    assertEquals(evaluate(notVar, { x: 7 }), 0); // not(7) = 0
    assertEquals(evaluate(notVar, { x: 0 }), 1); // not(0) = 1
    
    // Test with expression
    const expr = P.not(P.gte(P.const(3), P.const(5)));
    assertEquals(evaluate(expr), 1); // not(3 >= 5) = not(0) = 1
});

addTest('equality operation', (evaluate) => {
    // Test when values are equal
    const a1 = P.const(5);
    const b1 = P.const(5);
    const eq1 = P.eq(a1, b1);
    assertEquals(evaluate(eq1), 1.0); // 5 == 5, should return 1.0
    
    // Test when values are not equal
    const a2 = P.const(3);
    const b2 = P.const(7);
    const eq2 = P.eq(a2, b2);
    assertEquals(evaluate(eq2), 0.0); // 3 != 7, should return 0.0
    
    // Test with variables
    const va = P.var('x');
    const vb = P.var('y');
    const eqVar = P.eq(va, vb);
    assertEquals(evaluate(eqVar, { x: 4, y: 4 }), 1.0); // 4 == 4
    assertEquals(evaluate(eqVar, { x: 2, y: 8 }), 0.0); // 2 != 8
    
    // Test with expressions
    const expr1 = P.add(P.const(2), P.const(3));
    const expr2 = P.const(5);
    const eqExpr = P.eq(expr1, expr2);
    assertEquals(evaluate(eqExpr), 1.0); // (2 + 3) == 5
});

addTest('conditional operation', (evaluate) => {
    // Test with true condition
    const cond1 = P.one();
    const then1 = P.const(5);
    const else1 = P.const(10);
    const if1 = P.cond(cond1, then1, else1);
    assertEquals(evaluate(if1), 5); // if(1) then 5 else 10
    
    // Test with false condition
    const cond2 = P.zero();
    const then2 = P.const(5);
    const else2 = P.const(10);
    const if2 = P.cond(cond2, then2, else2);
    assertEquals(evaluate(if2), 10); // if(0) then 5 else 10
    
    // Test with variables
    const vc = P.var('c');
    const vt = P.var('t');
    const ve = P.var('e');
    const ifVar = P.cond(vc, vt, ve);
    assertEquals(evaluate(ifVar, { c: 1, t: 7, e: 3 }), 7); // if(1) then 7 else 3
    assertEquals(evaluate(ifVar, { c: 0, t: 7, e: 3 }), 3); // if(0) then 7 else 3
    
    // Test with expressions
    const condExpr = P.gte(P.const(7), P.const(5));
    const ifExpr = P.cond(condExpr, P.one(), P.const(2));
    assertEquals(evaluate(ifExpr), 1); // if(7 >= 5) then 1 else 2
});

addTest('negation operation', (evaluate) => {
    // Test with positive number
    const a1 = P.const(5);
    const neg1 = P.neg(a1);
    assertEquals(evaluate(neg1), -5); // -5
    
    // Test with negative number
    const a2 = P.const(-3);
    const neg2 = P.neg(a2);
    assertEquals(evaluate(neg2), 3); // -(-3) = 3
    
    // Test with zero
    const a3 = P.zero();
    const neg3 = P.neg(a3);
    assertEquals(evaluate(neg3), 0); // -0 = 0
    
    // Test with variables
    const va = P.var('x');
    const negVar = P.neg(va);
    assertEquals(evaluate(negVar, { x: 7 }), -7); // -7
    assertEquals(evaluate(negVar, { x: -4 }), 4); // -(-4) = 4
    
    // Test with expression
    const expr = P.neg(P.add(P.const(2), P.const(3)));
    assertEquals(evaluate(expr), -5); // -(2 + 3) = -5
});

addTest('vector component extraction', (evaluate) => {
    const v = P.vconst(new Vec3(1, 2, 3));
    
    // Test vecX
    const x = P.vecX(v);
    assertEquals(evaluate(x), 1);
    
    // Test vecY
    const y = P.vecY(v);
    assertEquals(evaluate(y), 2);
    
    // Test vecZ
    const z = P.vecZ(v);
    assertEquals(evaluate(z), 3);
    
    // Test with variables
    const vv = P.vvar('v');
    const vx = P.vecX(vv);
    const vy = P.vecY(vv);
    const vz = P.vecZ(vv);
    assertEquals(evaluate(vx, { v: new Vec3(4, 5, 6) }), 4);
    assertEquals(evaluate(vy, { v: new Vec3(4, 5, 6) }), 5);
    assertEquals(evaluate(vz, { v: new Vec3(4, 5, 6) }), 6);
    
    // Test type checking
    const scalar = P.const(5);
    assertThrows(() => evaluate(P.vecX(scalar)));
    assertThrows(() => evaluate(P.vecY(scalar)));
    assertThrows(() => evaluate(P.vecZ(scalar)));
});

addTest('matrix operations', (evaluate) => {
    // Create test matrices
    const m1 = new Mat3(1, 2, 3, 4, 5, 6, 7, 8, 9);
    const m2 = new Mat3(9, 8, 7, 6, 5, 4, 3, 2, 1);
    
    // Test matrix constant
    const mc1 = P.mconst(m1);
    const result1 = evaluate(mc1);
    assertEquals(result1.m[0][0], 1);
    assertEquals(result1.m[1][1], 5);
    assertEquals(result1.m[2][2], 9);
    
    // Test matrix variable
    const mv = P.mvar('m');
    const result2 = evaluate(mv, { m: m2 });
    assertEquals(result2.m[0][0], 9);
    assertEquals(result2.m[1][1], 5);
    assertEquals(result2.m[2][2], 1);
    
    // Test matrix transpose
    const mt = P.mtranspose(P.mconst(m1));
    const result3 = evaluate(mt);
    assertEquals(result3.m[0][0], 1);
    assertEquals(result3.m[0][1], 4);
    assertEquals(result3.m[0][2], 7);
    assertEquals(result3.m[1][0], 2);
    assertEquals(result3.m[1][1], 5);
    assertEquals(result3.m[1][2], 8);
    assertEquals(result3.m[2][0], 3);
    assertEquals(result3.m[2][1], 6);
    assertEquals(result3.m[2][2], 9);
    
    // Test matrix-vector multiplication
    const v = P.vconst(new Vec3(1, 2, 3));
    const mv_mul = P.mvmul(P.mconst(m1), v);
    const result4 = evaluate(mv_mul);
    assertEquals(result4.x, 14); // 1*1 + 2*2 + 3*3
    assertEquals(result4.y, 32); // 4*1 + 5*2 + 6*3
    assertEquals(result4.z, 50); // 7*1 + 8*2 + 9*3
    
    // Test matrix-matrix multiplication
    const mm_mul = P.mmul(P.mconst(m1), P.mconst(m2));
    const result5 = evaluate(mm_mul);
    assertEquals(result5.m[0][0], 30);
    assertEquals(result5.m[0][1], 24);
    assertEquals(result5.m[0][2], 18);
    assertEquals(result5.m[1][0], 84);
    assertEquals(result5.m[1][1], 69);
    assertEquals(result5.m[1][2], 54);
    assertEquals(result5.m[2][0], 138);
    assertEquals(result5.m[2][1], 114);
    assertEquals(result5.m[2][2], 90);
});

addTest('trigonometric functions', (evaluate) => {
    // Test sin
    const sin0 = P.sin(P.zero());
    assertEquals(evaluate(sin0), 0);
    
    const sinPiHalf = P.sin(P.const(Math.PI / 2));
    assertEquals(evaluate(sinPiHalf), 1, 1e-10);
    
    // Test cos
    const cos0 = P.cos(P.zero());
    assertEquals(evaluate(cos0), 1);
    
    const cosPiHalf = P.cos(P.const(Math.PI / 2));
    assertEquals(evaluate(cosPiHalf), 0, 1e-10);
    
    // Test tan
    const tan0 = P.tan(P.zero());
    assertEquals(evaluate(tan0), 0);
    
    const tanPi4 = P.tan(P.const(Math.PI / 4));
    assertEquals(evaluate(tanPi4), 1, 1e-10);
    
    // Test with variables
    const x = P.var('x');
    const sinX = P.sin(x);
    const cosX = P.cos(x);
    const tanX = P.tan(x);
    
    assertEquals(evaluate(sinX, { x: 0 }), 0);
    assertEquals(evaluate(cosX, { x: 0 }), 1);
    assertEquals(evaluate(tanX, { x: 0 }), 0);
});

addTest('absBevelC2 and rampBevelC2 functions', (evaluate) => {
    // Test absBevelC2 with positive value
    const abs1 = P.absBevelC2(P.const(5), P.one(), P.const(0.9));
    assertEquals(evaluate(abs1), 5);
    
    // Test absBevelC2 with negative value
    const abs2 = P.absBevelC2(P.const(-3), P.one(), P.const(0.9));
    assertEquals(evaluate(abs2), 3);
    
    // Test absBevelC2 with zero
    const abs3 = P.absBevelC2(P.zero(), P.one(), P.const(0.9));
    assertEquals(evaluate(abs3), 0);
    
    // Test rampBevelC2
    const ramp1 = P.rampBevelC2(P.const(5), P.one(), P.const(0.9));
    assertEquals(evaluate(ramp1), 5); // (5 + 5) / 2 = 5
    
    const ramp2 = P.rampBevelC2(P.const(-3), P.one(), P.const(0.9));
    assertEquals(evaluate(ramp2), 0); // (-3 + 3) / 2 = 0
    
    const ramp3 = P.rampBevelC2(P.zero(), P.one(), P.const(0.9));
    assertEquals(evaluate(ramp3), 0); // (0 + 0) / 2 = 0
});

addTest('basic derivative - constant', (evaluate) => {
    const c = P.const(5);
    const derivative = c.derivative('p');
    
    assertEquals(evaluate(derivative[0]), 0);
    assertEquals(evaluate(derivative[1]), 0);
    assertEquals(evaluate(derivative[2]), 0);
});

addTest('basic derivative - variable', (evaluate) => {
    const p = P.vvar('p');
    const derivative = p.derivative('p');
    
    const vars = { p: new Vec3(1, 2, 3) };
    const dx = evaluate(derivative[0], vars);
    const dy = evaluate(derivative[1], vars);
    const dz = evaluate(derivative[2], vars);
    
    assertEquals(dx.x, 1);
    assertEquals(dx.y, 0);
    assertEquals(dx.z, 0);
    
    assertEquals(dy.x, 0);
    assertEquals(dy.y, 1);
    assertEquals(dy.z, 0);
    
    assertEquals(dz.x, 0);
    assertEquals(dz.y, 0);
    assertEquals(dz.z, 1);
});

addTest('derivative - addition', (evaluate) => {
    const p = P.vvar('p');
    const c = P.const(5);
    const sum = P.add(P.vecX(p), c);
    
    const derivative = sum.derivative('p');
    const vars = { p: new Vec3(1, 2, 3) };
    
    assertEquals(evaluate(derivative[0], vars), 1);
    assertEquals(evaluate(derivative[1], vars), 0);
    assertEquals(evaluate(derivative[2], vars), 0);
});

addTest('derivative - subtraction', (evaluate) => {
    const p = P.vvar('p');
    const c = P.const(5);
    const diff = P.sub(P.vecY(p), c);
    
    const derivative = diff.derivative('p');
    const vars = { p: new Vec3(1, 2, 3) };
    
    assertEquals(evaluate(derivative[0], vars), 0);
    assertEquals(evaluate(derivative[1], vars), 1);
    assertEquals(evaluate(derivative[2], vars), 0);
});

addTest('derivative - multiplication', (evaluate) => {
    const p = P.vvar('p');
    const c = P.const(5);
    const product = P.mul(P.vecZ(p), c);
    
    const derivative = product.derivative('p');
    const vars = { p: new Vec3(1, 2, 3) };
    
    assertEquals(evaluate(derivative[0], vars), 0);
    assertEquals(evaluate(derivative[1], vars), 0);
    assertEquals(evaluate(derivative[2], vars), 5);
});

addTest('derivative - division', (evaluate) => {
    const p = P.vvar('p');
    const c = P.const(2);
    const quotient = P.div(P.vecX(p), c);
    
    const derivative = quotient.derivative('p');
    const vars = { p: new Vec3(1, 2, 3) };
    
    assertEquals(evaluate(derivative[0], vars), 0.5);
    assertEquals(evaluate(derivative[1], vars), 0);
    assertEquals(evaluate(derivative[2], vars), 0);
});

addTest('derivative - vector length', (evaluate) => {
    const p = P.vvar('p');
    const length = P.vlength(p);
    
    // At point (1,0,0), d/dx(|p|) = 1, d/dy(|p|) = 0, d/dz(|p|) = 0
    const derivative1 = length.derivative('p');
    const vars1 = { p: new Vec3(1, 0, 0) };
    
    assertEquals(evaluate(derivative1[0], vars1), 1, 0.0001);
    assertEquals(evaluate(derivative1[1], vars1), 0, 0.0001);
    assertEquals(evaluate(derivative1[2], vars1), 0, 0.0001);
    
    // At point (0,2,0), d/dx(|p|) = 0, d/dy(|p|) = 1, d/dz(|p|) = 0
    const vars2 = { p: new Vec3(0, 2, 0) };
    
    assertEquals(evaluate(derivative1[0], vars2), 0, 0.0001);
    assertEquals(evaluate(derivative1[1], vars2), 1, 0.0001);
    assertEquals(evaluate(derivative1[2], vars2), 0, 0.0001);
});

addTest('derivative - vector dot product', (evaluate) => {
    const p = P.vvar('p');
    const v = P.vconst(new Vec3(2, 3, 4));
    const dot = P.vdot(p, v);
    
    const derivative = dot.derivative('p');
    const vars = { p: new Vec3(1, 2, 3) };
    
    assertEquals(evaluate(derivative[0], vars), 2);
    assertEquals(evaluate(derivative[1], vars), 3);
    assertEquals(evaluate(derivative[2], vars), 4);
});

addTest('derivative - sqrt', (evaluate) => {
    const p = P.vvar('p');
    const expr = P.sqrt(P.vecX(p));
    
    const derivative = expr.derivative('p');
    const vars = { p: new Vec3(4, 0, 0) };
    
    // d/dx(sqrt(x)) = 1/(2*sqrt(x)) = 1/(2*2) = 0.25 at x=4
    assertEquals(evaluate(derivative[0], vars), 0.25);
    assertEquals(evaluate(derivative[1], vars), 0);
    assertEquals(evaluate(derivative[2], vars), 0);
});

addTest('derivative - sin and cos', (evaluate) => {
    const p = P.vvar('p');
    const sinExpr = P.sin(P.vecX(p));
    const cosExpr = P.cos(P.vecX(p));
    
    const sinDerivative = sinExpr.derivative('p');
    const cosDerivative = cosExpr.derivative('p');
    
    // At p = (0,0,0), sin(0) = 0, cos(0) = 1
    // d/dx(sin(x)) = cos(x) = 1 at x=0
    // d/dx(cos(x)) = -sin(x) = 0 at x=0
    const vars = { p: new Vec3(0, 0, 0) };
    
    assertEquals(evaluate(sinDerivative[0], vars), 1);
    assertEquals(evaluate(sinDerivative[1], vars), 0);
    assertEquals(evaluate(sinDerivative[2], vars), 0);
    
    assertEquals(evaluate(cosDerivative[0], vars), 0);
    assertEquals(evaluate(cosDerivative[1], vars), 0);
    assertEquals(evaluate(cosDerivative[2], vars), 0);
});

addTest('derivative - chain rule', (evaluate) => {
    const p = P.vvar('p');
    // f(p) = sin(sqrt(x²+y²+z²)) = sin(|p|)
    const expr = P.sin(P.vlength(p));
    
    const derivative = expr.derivative('p');
    
    // At p = (1,0,0), |p| = 1, sin(1) ≈ 0.8415
    // d/dx(sin(|p|)) = cos(|p|) * d/dx(|p|) = cos(1) * 1 ≈ 0.5403 * 1
    // d/dy(sin(|p|)) = cos(|p|) * d/dy(|p|) = cos(1) * 0 = 0
    // d/dz(sin(|p|)) = cos(|p|) * d/dz(|p|) = cos(1) * 0 = 0
    const vars = { p: new Vec3(1, 0, 0) };
    
    assertEquals(evaluate(derivative[0], vars), Math.cos(1), 0.0001);
    assertEquals(evaluate(derivative[1], vars), 0, 0.0001);
    assertEquals(evaluate(derivative[2], vars), 0, 0.0001);
});

addTest('derivative - matrix-vector multiplication', (evaluate) => {
    const p = P.vvar('p');
    const m = P.mconst(new Mat3(
        1, 0, 0,
        0, 2, 0,
        0, 0, 3
    ));
    const expr = P.mvmul(m, p);
    
    const derivative = expr.derivative('p');
    const vars = { p: new Vec3(1, 2, 3) };
    
    const dx = evaluate(derivative[0], vars);
    const dy = evaluate(derivative[1], vars);
    const dz = evaluate(derivative[2], vars);
    
    // d/dx(M*p) = M * d/dx(p) = M * (1,0,0) = (1,0,0)
    assertEquals(dx.x, 1);
    assertEquals(dx.y, 0);
    assertEquals(dx.z, 0);
    
    // d/dy(M*p) = M * d/dy(p) = M * (0,1,0) = (0,2,0)
    assertEquals(dy.x, 0);
    assertEquals(dy.y, 2);
    assertEquals(dy.z, 0);
    
    // d/dz(M*p) = M * d/dz(p) = M * (0,0,1) = (0,0,3)
    assertEquals(dz.x, 0);
    assertEquals(dz.y, 0);
    assertEquals(dz.z, 3);
});

// Export for browser
window.PeptideTests = {
    direct: DirectT,
    compiled: CompiledT,
    interval: IntervalT,
    compiledInterval: CompiledIntervalT
};
