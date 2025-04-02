class ColorNode extends TreeNode {
  constructor() {
    super("Color");
    this.color = new Vec3(1, 0, 0);
    this.maxChildren = 1;
  }

  properties() {
    return {"color": "vec3"};
  }

  makePeptide(p) {
    const child = this.children[0].peptide(p);
    if (!child) return null;
    return P.struct({
      distance: P.field(child, 'distance'),
      color: this.vuniform('color'),
    });
  }
}

// Detect environment and export accordingly
(function() {
    const nodes = { ColorNode };
    
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
  