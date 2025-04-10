// Test suite for PeptideParser
const ParserT = new TestSuite('PeptideParser');

// Helper to add parser tests
function addParserTest(name, input, expectedResult, vars = {}) {
    // Create a map of variable types
    const getTypeMap = (variables) => {
        const typeMap = {};
        for (const key in variables) {
            const value = variables[key];
            if (value instanceof Vec3) {
                typeMap[key] = "vec3";
            } else if (typeof value === "number") {
                typeMap[key] = "float";
            } else {
                typeMap[key] = typeof value;
            }
        }
        return typeMap;
    };
    
    ParserT.test(name, () => {
        // Parse the input string
        const expr = PeptideParser.parse(input, getTypeMap(vars));
        
        // Check that parsing succeeded
        if (expr === null) {
            throw new Error(`Failed to parse: ${input}`);
        }
        
        // Evaluate the expression
        const result = expr.evaluate(vars);
        
        // Check the result
        assertEquals(result, expectedResult);
    });
}

// Helper to test parsing failures
function addParserFailTest(name, input) {
    ParserT.test(name, () => {
        let result;
        try {
            const expr = PeptideParser.parse(input);
            result = expr.evaluate({});
        } catch (e) {
            // Check that parsing failed
            return;
        }
        throw new Error(`Expected parsing to fail for: ${input}, evaluated to: ${result}`);
    });
}

// Basic number parsing tests
addParserTest('parse integer', '42', 42);
addParserTest('parse negative integer', '-42', -42);
addParserTest('parse decimal', '3.14', 3.14);
addParserTest('parse negative decimal', '-3.14', -3.14);
addParserTest('parse numbers with leading spaces', '  42', 42);
addParserTest('parse numbers with leading tabs', '\t42', 42);
addParserTest('parse numbers with leading newlines', '\n42', 42);
addParserTest('parse numbers with trailing spaces', '42 ', 42);
addParserTest('parse numbers with trailing tabs', '42\t', 42);
addParserTest('parse numbers with trailing newlines', '42\n', 42);

// Invalid number format tests
addParserFailTest('invalid number - multiple decimal points', '3.14.15');
addParserFailTest('invalid number - multiple negative signs', '--42');
addParserFailTest('invalid number - negative sign at start', '- 42');
addParserFailTest('invalid number - negative sign at end', '42 -');
addParserFailTest('invalid number - commas', '42,000');
addParserFailTest('invalid number - letters', '3.14a');

// Infix operator tests
addParserTest('parse addition', '5 + 3', 8);
addParserTest('parse subtraction', '5 - 3', 2);
addParserTest('parse multiplication', '5 * 3', 15);
addParserTest('parse division', '6 / 3', 2);
addParserTest('parse modulo', '7 % 3', 1);

// Invalid infix operator tests
addParserFailTest('invalid infix operator - leading multiply', '*5');
addParserFailTest('invalid infix operator - leading divide', '/5');
addParserFailTest('invalid infix operator - leading modulo', '%5');

// Variable tests
addParserTest('parse variable', 'x', 1, {x: 1});
addParserTest('parse variable with spaces', ' x ', 1, {x: 1});
addParserTest('parse variable with tabs', '\tx', 1, {x: 1});
addParserTest('parse variable with newlines', '\nx', 1, {x: 1});
addParserTest('parse variable with trailing spaces', 'x ', 1, {x: 1});
addParserTest('use variable in expression', 'x + 1', 2, {x: 1});
addParserTest('use variable in expression 2', ' 1 + x',  2, {x: 1});
addParserTest('long variable name', 'long_variable_name', 1, {long_variable_name: 1});
addParserTest('multiple variables', 'x + y', 3, {x: 1, y: 2});
addParserTest('multiple variables 2', 'x + y + z', 6, {x: 1, y: 2, z: 3});

// Function call tests
addParserTest('sqrt', 'sqrt(4)', 2);
addParserTest('sin', 'sin(0)', 0);
addParserTest('cos', 'cos(0)', 1);
addParserTest('tan', 'tan(0)', 0);
addParserTest('abs', 'abs(-1)', 1);
addParserTest('complex expression', 'sqrt(x+1)*abs(y-z)', 2, {x: 3, y: 2, z: 3});
addParserTest('nested function call', 'sqrt(abs(x)*abs(x))', 3, {x: -3});

addParserFailTest("wrong number of arguments", "sqrt()");
addParserFailTest("wrong number of arguments", "sin()");
addParserFailTest("wrong number of arguments", "min(1)");
addParserFailTest("wrong number of arguments", "min(1,2,3)");

// Vector variables
addParserTest('parse vector variable', 'v', new Vec3(0, 0, 0), {v: new Vec3(0, 0, 0)});
addParserTest('parse vector variable with x', 'v.x', 1, {v: new Vec3(1, 0, 0)});
addParserTest('parse vector variable with y', 'v.y', 2, {v: new Vec3(0, 2, 0)});
addParserTest('parse vector variable with z', 'v.z', 3, {v: new Vec3(0, 0, 3)});
addParserTest('parse vector variable with xyz', 'v.x + v.y + v.z', 6, {v: new Vec3(1, 2, 3)});
addParserTest('construct vector from components', 'vec3(1, 2, 3)', new Vec3(1, 2, 3), {});

addParserFailTest("can't take vec3 of vec3", 'vec3(vec3(1,2,3),0,0)');

// Export for browser
if (typeof window !== 'undefined') {
    if (!window.PeptideTests) {
        window.PeptideTests = {};
    }
    window.PeptideTests.parser = ParserT;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ParserT };
}
