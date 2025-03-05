class UnionNode extends TreeNode {
    constructor() {
      super("Union");
      this.maxChildren = null;
    }

    shaderImplementation() {
      return `
        float opUnion(float d1, float d2) { return min(d1, d2); }
      `;
    }
  
    generateShaderCode() {
      if (this.children.length < 1) {
        this.warn("Union node needs at least one child");
        return this.noopShaderCode();
      }

      let shaderCode = this.children[0].generateShaderCode();
      for (let i = 0; i < this.children.length; i++) {
        shaderCode = `opUnion(${shaderCode}, ${this.children[i].generateShaderCode()})`;
      }
      return shaderCode;
    }
  }

class IntersectionNode extends TreeNode {
  constructor() {
    super("Intersection");
    this.maxChildren = null;
  }

  shaderImplementation() {
    return `
      float opIntersection(float d1, float d2) { return max(d1, d2); }
    `;
  }

  generateShaderCode() {
    if (this.children.length < 1) {
      this.warn("Intersection node needs at least one child");
      return this.noopShaderCode();
    }

    let shaderCode = this.children[0].generateShaderCode();
    for (let i = 1; i < this.children.length; i++) {
      shaderCode = `opIntersection(${shaderCode}, ${this.children[i].generateShaderCode()})`;
    }
    return shaderCode;
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { UnionNode, IntersectionNode };
  
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