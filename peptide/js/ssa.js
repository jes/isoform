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
     * @param {string} prefix - Optional prefix for the variable name
     * @returns {string} A unique variable name
     */
    newVar(prefix = 'v') {
        return `${prefix}${this.varCounter++}`;
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
        // Check if we've already processed this node
        if (this.varMap.has(node)) {
            return this.varMap.get(node);
        }

        let resultVar;
        const type = node.type;

        switch (node.op) {
            case 'const':
                resultVar = this.newVar('const');
                this.operations.push({
                    op: 'const',
                    type: type,
                    result: resultVar,
                    value: node.value
                });
                break;
                
            case 'var':
                resultVar = this.newVar('var');
                this.operations.push({
                    op: 'var',
                    type: type,
                    result: resultVar,
                    name: node.value
                });
                break;
                
            case 'vconst':
                resultVar = this.newVar('vconst');
                this.operations.push({
                    op: 'vconst',
                    type: type,
                    result: resultVar,
                    value: node.value
                });
                break;
                
            case 'vvar':
                resultVar = this.newVar('vvar');
                this.operations.push({
                    op: 'vvar',
                    type: type,
                    result: resultVar,
                    name: node.value
                });
                break;
                
            // Binary operations
            case 'add':
            case 'sub':
            case 'mul':
            case 'div':
            case 'min':
            case 'max':
            case 'pow':
            case 'vadd':
            case 'vsub':
            case 'vmul':
            case 'vdiv':
            case 'vdot':
            case 'vcross':
                const leftVar = this.processNode(node.left);
                const rightVar = this.processNode(node.right);
                resultVar = this.newVar(node.op);
                this.operations.push({
                    op: node.op,
                    type: type,
                    result: resultVar,
                    args: [leftVar, rightVar]
                });
                break;
                
            // Unary operations
            case 'sqrt':
            case 'vlength':
            case 'vecX':
            case 'vecY':
            case 'vecZ':
                const argVar = this.processNode(node.left);
                resultVar = this.newVar(node.op);
                this.operations.push({
                    op: node.op,
                    type: type,
                    result: resultVar,
                    args: [argVar]
                });
                break;
                
            // Ternary operations (vec3 constructor)
            case 'vec3':
                const xVar = this.processNode(node.left);
                const yVar = this.processNode(node.right);
                const zVar = this.processNode(node.third);
                resultVar = this.newVar('vec3');
                this.operations.push({
                    op: 'vec3',
                    type: type,
                    result: resultVar,
                    args: [xVar, yVar, zVar]
                });
                break;
                
            default:
                throw new Error(`Unknown operation: ${node.op}`);
        }

        // Store the mapping from node to SSA variable
        this.varMap.set(node, resultVar);
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
        
        // Generate code for each operation
        for (const op of this.operations) {
            switch (op.op) {
                case 'const':
                    code += `  ${op.result} = ${op.value};\n`;
                    break;
                    
                case 'var':
                    code += `  if (!('${op.name}' in vars)) throw new Error("Variable '${op.name}' not found");\n`;
                    code += `  ${op.result} = vars['${op.name}'];\n`;
                    break;
                    
                case 'vconst':
                    code += `  ${op.result} = new Vec3(${op.value.x}, ${op.value.y}, ${op.value.z});\n`;
                    break;
                    
                case 'vvar':
                    code += `  if (!('${op.name}' in vars)) throw new Error("Vector variable '${op.name}' not found");\n`;
                    code += `  ${op.result} = vars['${op.name}'];\n`;
                    break;
                    
                // Binary operations
                case 'add':
                    code += `  ${op.result} = ${op.args[0]} + ${op.args[1]};\n`;
                    break;
                case 'sub':
                    code += `  ${op.result} = ${op.args[0]} - ${op.args[1]};\n`;
                    break;
                case 'mul':
                    code += `  ${op.result} = ${op.args[0]} * ${op.args[1]};\n`;
                    break;
                case 'div':
                    code += `  ${op.result} = ${op.args[0]} / ${op.args[1]};\n`;
                    break;
                case 'min':
                    code += `  ${op.result} = Math.min(${op.args[0]}, ${op.args[1]});\n`;
                    break;
                case 'max':
                    code += `  ${op.result} = Math.max(${op.args[0]}, ${op.args[1]});\n`;
                    break;
                case 'pow':
                    code += `  ${op.result} = Math.pow(${op.args[0]}, ${op.args[1]});\n`;
                    break;
                case 'vadd':
                    code += `  ${op.result} = ${op.args[0]}.add(${op.args[1]});\n`;
                    break;
                case 'vsub':
                    code += `  ${op.result} = ${op.args[0]}.sub(${op.args[1]});\n`;
                    break;
                case 'vmul':
                    code += `  ${op.result} = ${op.args[0]}.mul(${op.args[1]});\n`;
                    break;
                case 'vdiv':
                    code += `  ${op.result} = ${op.args[0]}.div(${op.args[1]});\n`;
                    break;
                case 'vdot':
                    code += `  ${op.result} = ${op.args[0]}.dot(${op.args[1]});\n`;
                    break;
                case 'vcross':
                    code += `  ${op.result} = ${op.args[0]}.cross(${op.args[1]});\n`;
                    break;
                    
                // Unary operations
                case 'sqrt':
                    code += `  ${op.result} = Math.sqrt(${op.args[0]});\n`;
                    break;
                case 'vlength':
                    code += `  ${op.result} = ${op.args[0]}.length();\n`;
                    break;
                case 'vecX':
                    code += `  ${op.result} = ${op.args[0]}.x;\n`;
                    break;
                case 'vecY':
                    code += `  ${op.result} = ${op.args[0]}.y;\n`;
                    break;
                case 'vecZ':
                    code += `  ${op.result} = ${op.args[0]}.z;\n`;
                    break;
                    
                // Ternary operations
                case 'vec3':
                    code += `  ${op.result} = new Vec3(${op.args[0]}, ${op.args[1]}, ${op.args[2]});\n`;
                    break;
                    
                default:
                    throw new Error(`Unknown operation: ${op.op}`);
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
