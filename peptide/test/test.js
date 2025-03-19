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
                // Extract the most relevant line from the stack trace
                let sourceLocation = 'Unknown location';
                
                if (e.stack) {
                    const stackLines = e.stack.split('\n');
                    const line = stackLines[0].trim();
                    sourceLocation = line;
                }
                
                this.results.push({ 
                    name: test.name, 
                    passed: false, 
                    error: e.message,
                    sourceLocation: sourceLocation,
                    fullStack: e.stack // Keep the full stack for debugging
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
        const stack = error.stack.split('\n');
        const callerLine = stack[1].trim();
        throw new Error(`Assertion failed at ${callerLine}\nExpected ${a} to equal ${b}`);
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
        const stack = error.stack.split('\n');
        const callerLine = stack[1].trim();
        throw new Error(`Assertion failed at ${callerLine}\nExpected function to throw`);
    }
}

// Create a wrapper that runs tests with both evaluation methods
function createEvaluator(useCompiled) {
    if (useCompiled) {
        return (expr, vars = {}) => {
            const ssa = new PeptideSSA(expr);
            const src = ssa.compileToJS();
            return eval(src)(vars);
        };
    } else {
        return (expr, vars = {}) => expr.evaluate(vars);
    }
}
// Create two test suites
const DirectT = new TestSuite();
const CompiledT = new TestSuite();

// Helper to add tests to both suites
function addTest(name, testFn) {
    DirectT.test(`${name} (direct)`, () => testFn(createEvaluator(false)));
    CompiledT.test(`${name} (compiled)`, () => testFn(createEvaluator(true)));
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
    const expr = P.add(x, P.const(1));
    assertEquals(evaluate(expr, { x: 5 }), 6);
});

addTest('complex expression', (evaluate) => {
    // (x + 1) * (y - 2)
    const expr = P.mul(
        P.add(P.var('x'), P.const(1)),
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

addTest('power operations', (evaluate) => {
    const base = P.const(2);
    const exp = P.const(3);
    
    const power = P.pow(base, exp);
    assertEquals(evaluate(power), 8); // 2^3 = 8
    
    const root = P.sqrt(P.const(16));
    assertEquals(evaluate(root), 4); // √16 = 4
});

addTest('complex expression with all operations', (evaluate) => {
    // sqrt(max(x^2, y^2)) + min(x, y)
    const expr = P.add(
        P.sqrt(
            P.max(
                P.pow(P.var('x'), P.const(2)),
                P.pow(P.var('y'), P.const(2))
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
    const x = P.const(1);
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
    assertThrows(() => evaluate(P.vec3(P.const(1), P.const(2))));
    assertThrows(() => evaluate(P.add(P.const(1))));
});

addTest('invalid vector operations', (evaluate) => {
    assertThrows(() => evaluate(P.vcross(P.const(1), P.vconst(new Vec3(1, 2, 3)))));
    assertThrows(() => evaluate(P.vdot(P.const(1), P.vconst(new Vec3(1, 2, 3)))));
});

addTest('invalid scalar operations', (evaluate) => {
    assertThrows(() => evaluate(P.add(P.const(1), P.vconst(new Vec3(1, 2, 3)))));
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
    
    const x2 = P.const(1);
    const clamped2 = P.clamp(x2, min, max);
    assertEquals(evaluate(clamped2), 2); // 1 clamped between 2 and 4
    
    const x3 = P.const(3);
    const clamped3 = P.clamp(x3, min, max);
    assertEquals(evaluate(clamped3), 3); // 3 stays between 2 and 4
});

addTest('mix operations', (evaluate) => {
    const a = P.const(0);
    const b = P.const(10);
    const t = P.const(0.3);
    
    const mixed = P.mix(a, b, t);
    assertEquals(evaluate(mixed), 3); // mix(0, 10, 0.3) = 3
    
    const t2 = P.const(0);
    const mixed2 = P.mix(a, b, t2);
    assertEquals(evaluate(mixed2), 0); // mix(0, 10, 0) = 0
    
    const t3 = P.const(1);
    const mixed3 = P.mix(a, b, t3);
    assertEquals(evaluate(mixed3), 10); // mix(0, 10, 1) = 10
});

addTest('smin operations', (evaluate) => {
    const a = P.const(5);
    const b = P.const(3);
    const k = P.const(1);
    
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
    const zeroK = P.const(0);
    const sminZeroK = P.smin(a, b, zeroK);
    assertEquals(evaluate(sminZeroK), 3);
});

addTest('smax operations', (evaluate) => {
    const a = P.const(5);
    const b = P.const(3);
    const k = P.const(1);
    
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
    const zeroK = P.const(0);
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
        P.pow(P.sin(x), P.const(2)),
        P.pow(P.cos(x), P.const(2))
    );
    assertEquals(evaluate(composed, { x: 1.234 }), 1.0); // sin²(x) + cos²(x) = 1
});

addTest('trigonometric type checking', (evaluate) => {
    const vec = P.vconst(new Vec3(1, 2, 3));
    
    // Should throw when trying to use vector with sin/cos
    assertThrows(() => evaluate(P.sin(vec)));
    assertThrows(() => evaluate(P.cos(vec)));
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
        v: new Vec3(10, -11, 12),
        s: 3
    });
    assertEquals(result2.x, 1); // 10 mod 3 = 1
    assertEquals(result2.y, -2); // -11 mod 3 = -2
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

// Export for browser
window.PeptideTests = {
    direct: DirectT,
    compiled: CompiledT
};
