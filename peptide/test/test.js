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

// Assertion helpers
function assertEquals(a, b) {
    if (a !== b) throw new Error(`Expected ${a} to equal ${b}`);
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

// Export for browser
window.PeptideTests = T;
