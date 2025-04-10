class CustomNode extends TreeNode {
    constructor() {
        super("Custom");
        this.maxChildren = 0; // No children by default
        this.code = "vlength(p) - 1.0"; // Default sphere SDF
    }

    properties() {
        return {"code": "string"};
    }

    makePeptide(p) {
        try {
            const node = PeptideParser.parse(this.code, {p: p});
            if (node.type == 'struct') return node;
            else return P.struct({distance: node});
        } catch (error) {
            this.warn(`Error in custom SDF code: ${error.message}`);
            return this.noop();
        }
    }
}

// Detect environment and export accordingly
(function() {
    const nodes = { CustomNode };
    
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