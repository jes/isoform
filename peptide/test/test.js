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
    assertEquals(p.type, 'const');
    assertEquals(p.value, 5);
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

// Export for browser
window.PeptideTests = T;
