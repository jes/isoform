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

        expr.simplify();
        
        const resultVar = this.processNode(expr);

        this.greedyAllocate();
       
        return {
            operations: this.operations,
            result: resultVar
        };
    }

    typePrefix(type) {
        return type === 'float' ? 'f' : type === 'vec3' ? 'v' : type === 'mat3' ? 'm' : 'X';
    }

    /**
     * Perform a greedy allocation of SSA variables
     */
    greedyAllocate() {
        // map of variable name to its SSA variable name;
        // once a variable becomes dead, it is removed from the map
        let map = new Map();
        let usedVars = new Set();

        // return the next free variable name for type t
        const alloc = (t) => {
            const varPrefix = this.typePrefix(t);
            for (let i = 0; ; i++) {
                const varName = `${varPrefix}${i}`;
                if (!usedVars.has(varName)) {
                    usedVars.add(varName);
                    return varName;
                }
            }
        }

        // work in reverse order so that we know that the variable's liveness ends
        // as soon as it is assigned
        for (let i = this.operations.length - 1; i >= 0; i--) {
            const op = this.operations[i];
            if (map.get(op.result)) {
                const result = map.get(op.result);
                map.delete(op.result);
                usedVars.delete(result);
                op.result = result;
            }

            if (op.left) {
                if (!map.has(op.left)) {
                    map.set(op.left, alloc(op.node.left.type));
                }
                op.left = map.get(op.left);
            }
            if (op.right) {
                if (!map.has(op.right)) {
                    map.set(op.right, alloc(op.node.right.type));
                }
                op.right = map.get(op.right);
            }
            if (op.third) {
                if (!map.has(op.third)) {
                    map.set(op.third, alloc(op.node.third.type));
                }
                op.third = map.get(op.third);
            }
        }
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
        const varPrefix = this.typePrefix(type);
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
        if (this.operations.length === 0) {
            throw new Error('No operations to compile');
        }
        let code = '(vars) => {\n';
        
        let seen = new Set();
        for (const op of this.operations) {
            if (!seen.has(op.result)) {
                code += `  let ${op.result};\n`;
                seen.add(op.result);
            }
        }
        
        code += '\n';

        for (const op of this.operations) {
            if (!op.node.ops.jsCode) {
                throw new Error('No JS code for ' + op.node.op);
            }
            code += `  ${op.node.ops.jsCode(op)}\n`;
        }
        
        // Return the result
        code += `  return ${this.operations[this.operations.length - 1].result};\n`;
        code += '}';
        
        return code;
    }

    compileToJSInterval() {
        if (this.operations.length === 0) {
            throw new Error('No operations to compile');
        }
        let code = '(vars) => {\n';
        
        let seen = new Set();
        for (const op of this.operations) {
            if (!seen.has(op.result)) {
                code += `  let ${op.result};\n`;
                seen.add(op.result);
            }
        }
        
        code += '\n';

        for (const op of this.operations) {
            if (!op.node.ops.jsIntervalCode) {
                throw new Error('No JS interval code for ' + op.node.op);
            }
            code += `  ${op.node.ops.jsIntervalCode(op)}\n`;
        }
        
        // Return the result
        code += `  return ${this.operations[this.operations.length - 1].result};\n`;
        code += '}';

        return code;
    }

    compileToGLSL(signature = 'float map(vec3 p)') {
        if (this.operations.length === 0) {
            throw new Error('No operations to compile');
        }
        let code = '';

        let seen = new Set();
        for (const op of this.operations) {
            if (!seen.has(op.result)) {
                code += `  ${op.node.type} ${op.result};\n`;
                seen.add(op.result);
            }
        }

        code += "\n";

        for (const op of this.operations) {
            if (!op.node.ops.glslCode) {
                throw new Error('No GLSL code for ' + op.node.op);
            }
            code += `  ${op.node.ops.glslCode(op)}\n`;
        }

        code += `  return ${this.operations[this.operations.length - 1].result};\n`;

        return `${signature} {\n${code}\n}`;
    }

    compileToGLSLInterval(signature = 'float map(ivec3 p)') {
        if (this.operations.length === 0) {
            throw new Error('No operations to compile');
        }
        let code = '';

        let seen = new Set();
        for (const op of this.operations) {
            if (!seen.has(op.result)) {
                let type = op.node.type;
                if (type === 'float') {
                    type = 'ifloat';
                } else if (type === 'vec3') {
                    type = 'ivec3';
                }
                code += `  ${type} ${op.result};\n`;
                seen.add(op.result);
            }
        }

        code += "\n";

        for (const op of this.operations) {
            if (!op.node.ops.glslIntervalCode) {
                throw new Error('No GLSL interval code for ' + op.node.op);
            }
            code += `  ${op.node.ops.glslIntervalCode(op)}\n`;
        }

        code += `  return ${this.operations[this.operations.length - 1].result};\n`;

        return `${signature} {\n${code}\n}`;
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
