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
    const v1 = P.vvar('v1');
    const v2 = P.vvar('v2');
    const v3 = P.vvar('v3');
    const v4 = P.vvar('v4');
    
    const expr = P.vdot(
        P.vadd(v1, v2),
        P.vcross(v3, v4)
    );
    
    const result = evaluate(expr, {
        v1: new Vec3(1, 0, 0),
        v2: new Vec3(0, 1, 0),
        v3: new Vec3(0, 0, 1),
        v4: new Vec3(1, 0, 0)
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

// Export for browser
window.PeptideTests = {
    direct: DirectT,
    compiled: CompiledT
};
