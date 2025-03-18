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
                this.results.push({ name: test.name, passed: false, error: e.message });
            }
        }
        return this.results;
    }
}

// Enhanced assertion helpers
function assertEquals(a, b) {
    if (a !== b) {
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

// Peptide tests
const T = new TestSuite();

T.test('constant creation', () => {
    const p = P.const(5);
    assertEquals(p.op, 'const');
    assertEquals(p.value, 5);
    assertEquals(p.evaluate({}), 5);
});

T.test('basic arithmetic', () => {
    const a = P.const(5);
    const b = P.const(3);
    
    const sum = P.add(a, b);
    assertEquals(sum.evaluate({}), 8);
    
    const diff = P.sub(a, b);
    assertEquals(diff.evaluate({}), 2);
    
    const prod = P.mul(a, b);
    assertEquals(prod.evaluate({}), 15);
    
    const quot = P.div(a, b);
    assertEquals(quot.evaluate({}), 5/3);
});

T.test('variable lookup', () => {
    const x = P.var('x');
    assertEquals(x.evaluate({ x: 5 }), 5);
});

T.test('variable evaluation', () => {
    const x = P.var('x');
    const expr = P.add(x, P.const(1));
    assertEquals(expr.evaluate({ x: 5 }), 6);
});

T.test('complex expression', () => {
    // (x + 1) * (y - 2)
    const expr = P.mul(
        P.add(P.var('x'), P.const(1)),
        P.sub(P.var('y'), P.const(2))
    );
    assertEquals(expr.evaluate({ x: 3, y: 5 }), 12); // (3 + 1) * (5 - 2) = 4 * 3 = 12
});

T.test('min and max operations', () => {
    const a = P.const(5);
    const b = P.const(3);
    
    const minimum = P.min(a, b);
    assertEquals(minimum.evaluate({}), 3);
    
    const maximum = P.max(a, b);
    assertEquals(maximum.evaluate({}), 5);
});

T.test('power operations', () => {
    const base = P.const(2);
    const exp = P.const(3);
    
    const power = P.pow(base, exp);
    assertEquals(power.evaluate({}), 8); // 2^3 = 8
    
    const root = P.sqrt(P.const(16));
    assertEquals(root.evaluate({}), 4); // √16 = 4
});

T.test('complex expression with all operations', () => {
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
    assertEquals(expr.evaluate({ x: 3, y: 4 }), 7); // sqrt(max(9, 16)) + min(3, 4) = 4 + 3 = 7
});

T.test('vector constant creation', () => {
    const v = P.vconst(new Vec3(1, 2, 3));
    assertEquals(v.op, 'vconst');
    assertEquals(v.evaluate({}).x, 1);
    assertEquals(v.evaluate({}).y, 2);
    assertEquals(v.evaluate({}).z, 3);
});

T.test('vector variable lookup', () => {
    const v = P.vvar('v');
    const result = v.evaluate({ v: new Vec3(1, 2, 3) });
    assertEquals(result.x, 1);
    assertEquals(result.y, 2);
    assertEquals(result.z, 3);
});

T.test('vector arithmetic', () => {
    const a = P.vconst(new Vec3(1, 2, 3));
    const b = P.vconst(new Vec3(4, 5, 6));
    
    const sum = P.vadd(a, b);
    const sumResult = sum.evaluate({});
    assertEquals(sumResult.x, 5);
    assertEquals(sumResult.y, 7);
    assertEquals(sumResult.z, 9);
    
    const diff = P.vsub(a, b);
    const diffResult = diff.evaluate({});
    assertEquals(diffResult.x, -3);
    assertEquals(diffResult.y, -3);
    assertEquals(diffResult.z, -3);
    
    const c = P.const(2);
    const prod = P.vmul(a, c);
    const prodResult = prod.evaluate({});
    assertEquals(prodResult.x, 2);
    assertEquals(prodResult.y, 4);
    assertEquals(prodResult.z, 6);
});

T.test('vector operations', () => {
    const a = P.vconst(new Vec3(1, 2, 3));
    const b = P.vconst(new Vec3(4, 5, 6));
    
    const length = P.vlength(a);
    assertEquals(length.evaluate({}), Math.sqrt(14));  // sqrt(1^2 + 2^2 + 3^2)
    
    const dot = P.vdot(a, b);
    assertEquals(dot.evaluate({}), 32);  // 1*4 + 2*5 + 3*6
    
    const cross = P.vcross(a, b);
    const crossResult = cross.evaluate({});
    assertEquals(crossResult.x, -3);  // 2*6 - 3*5
    assertEquals(crossResult.y, 6);   // 3*4 - 1*6
    assertEquals(crossResult.z, -3);  // 1*5 - 2*4
});

T.test('vec3 construction', () => {
    const x = P.const(1);
    const y = P.const(2);
    const z = P.const(3);
    const vec = P.vec3(x, y, z);
    const result = vec.evaluate({});
    assertEquals(result.x, 1);
    assertEquals(result.y, 2);
    assertEquals(result.z, 3);
});

T.test('complex vector expression', () => {
    // (v1 + v2) · (v3 × v4)
    const v1 = P.vvar('v1');
    const v2 = P.vvar('v2');
    const v3 = P.vvar('v3');
    const v4 = P.vvar('v4');
    
    const expr = P.vdot(
        P.vadd(v1, v2),
        P.vcross(v3, v4)
    );
    
    const result = expr.evaluate({
        v1: new Vec3(1, 0, 0),
        v2: new Vec3(0, 1, 0),
        v3: new Vec3(0, 0, 1),
        v4: new Vec3(1, 0, 0)
    });
    
    assertEquals(result, 1); // ((1,1,0) · (0,1,0)) = 1
});

T.test('type mismatch errors', () => {
    const vec = P.vconst(new Vec3(1, 2, 3));
    const scalar = P.const(5);
    
    assertThrows(() => P.vadd(vec, scalar).evaluate({}));
    assertThrows(() => P.add(vec, scalar).evaluate({}));
});

T.test('insufficient arguments', () => {
    assertThrows(() => P.vec3(P.const(1), P.const(2)).evaluate({}));
    assertThrows(() => P.add(P.const(1)).evaluate({}));
});

T.test('invalid vector operations', () => {
    assertThrows(() => P.vcross(P.const(1), P.vconst(new Vec3(1, 2, 3))).evaluate({}));
    assertThrows(() => P.vdot(P.const(1), P.vconst(new Vec3(1, 2, 3))).evaluate({}));
});

T.test('invalid scalar operations', () => {
    assertThrows(() => P.add(P.const(1), P.vconst(new Vec3(1, 2, 3))).evaluate({}));
    assertThrows(() => P.sqrt(P.vconst(new Vec3(1, 2, 3))).evaluate({}));
});

// Export for browser
window.PeptideTests = T;
