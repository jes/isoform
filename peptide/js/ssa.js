/**
 * SSA (Static Single Assignment) representation for Peptide expressions.
 * Transforms a Peptide expression tree into a linear sequence of operations
 * where each variable is assigned exactly once.
 */
class PeptideSSA {
    constructor(expr = null) {
        this.operations = [];
        this.varCounter = 0;
        this.varMap = new Map(); // Maps Peptide nodes to SSA variable names
        if (expr) {
            this.convert(expr);
        }
    }

    /**
     * Generate a new unique variable name
     * @param {string} type - The type of the variable (f for float, v for vector, etc.)
     * @returns {string} A unique variable name
     */
    newVar(type = 'f') {
        return `${type}${this.varCounter++}`;
    }

    /**
     * Convert a Peptide expression tree to SSA form
     * @param {Peptide} expr - The root of the Peptide expression tree
     * @returns {Object} An object containing the SSA operations and the result variable
     */
    convert(expr) {
        this.operations = [];
        this.varCounter = 0;
        this.varMap = new Map();
        
        const resultVar = this.processNode(expr);
        
        return {
            operations: this.operations,
            result: resultVar
        };
    }

    /**
     * Process a node in the Peptide expression tree
     * @param {Peptide} node - A node in the Peptide expression tree
     * @returns {string} The SSA variable name that holds the result of this node
     */
    processNode(node) {
        if (this.varMap.has(node)) {
            return this.varMap.get(node);
        }

        const type = node.type;
        const varPrefix = type === 'float' ? 'f' : 'v';
        const resultVar = this.newVar(varPrefix);
        this.varMap.set(node, resultVar);

        let left = null;
        let right = null;
        let third = null;
        if (node.left) {
            left = this.processNode(node.left);
        }
        if (node.right) {
            right = this.processNode(node.right);
        }
        if (node.third) {
            third = this.processNode(node.third);
        }
        this.operations.push({
            node: node,
            left: left,
            right: right,
            third: third,
            result: resultVar,
        });

        return resultVar;
    }

    /**
     * Compile the SSA form to JavaScript code
     * @returns {Function} A function that takes variable values and returns the result
     */
    compileToJS() {
        let code = '(vars) => {\n';
        
        // Declare variables
        for (const op of this.operations) {
            code += `  let ${op.result};\n`;
        }
        
        code += '\n';

        for (const op of this.operations) {
            if (op.node.ssaOpFn) {
                code += `  ${op.node.ssaOpFn(op.node, op)}\n`;
            }
        }
        
        // Return the result
        code += `  return ${this.operations[this.operations.length - 1].result};\n`;
        code += '}';
        
        return code;
    }
}

// Detect environment and export accordingly
(function() {
    const nodes = { PeptideSSA };
    
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
