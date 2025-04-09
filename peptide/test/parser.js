// Test suite for PeptideParser
const ParserT = new TestSuite('PeptideParser');

// Helper to add parser tests
function addParserTest(name, input, expectedResult, vars = {}) {
    ParserT.test(name, () => {
        // Parse the input string
        const expr = PeptideParser.parse(input);
        
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
