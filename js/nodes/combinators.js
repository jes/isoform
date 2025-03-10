class UnionNode extends TreeNode {
    constructor(children = [], smoothK = 0) {
      super("Union");
      this.maxChildren = null;
      this.addChild(children);
      this.smoothK = smoothK;
    }

    getExactness() {
      return TreeNode.LOWERBOUND;
    }

    properties() {
      return {"smoothK": "float"};
    }

    generateShaderImplementation() {
      return `
        float opUnion(float d1, float d2) { return min(d1, d2); }
        float opSmoothUnion(float d1, float d2, float k) {
          float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
          return mix(d2, d1, h) - k * h * (1.0 - h);
        }
      `;
    }
  
    generateShaderCode() {
      if (this.children.length < 1) {
        this.warn("Union node needs at least one child");
        return this.noopShaderCode();
      }

      let shaderCode = this.children[0].shaderCode();
      for (let i = 1; i < this.children.length; i++) {
        const childCode = this.children[i].shaderCode();
        // Check if either operand is a noop value
        if (childCode === this.noopShaderCode()) {
          continue; // Skip this child
        } else if (shaderCode === this.noopShaderCode()) {
          shaderCode = childCode;
          continue;
        }
        
        if (this.smoothK > 0) {
          shaderCode = `opSmoothUnion(${shaderCode}, ${childCode}, ${this.smoothK.toFixed(16)})`;
        } else {
          shaderCode = `opUnion(${shaderCode}, ${childCode})`;
        }
      }
      return shaderCode;
    }

    getIcon() {
      return "🔀";
    }
  }

class IntersectionNode extends TreeNode {
  constructor(children = [], smoothK = 0) {
    super("Intersection");
    this.maxChildren = null;
    this.addChild(children);
    this.smoothK = smoothK;
  }

  getExactness() {
    return TreeNode.LOWERBOUND;
  }

  properties() {
    return {"smoothK": "float"};
  }

  generateShaderImplementation() {
    return `
      float opIntersection(float d1, float d2) { return max(d1, d2); }
      float opSmoothIntersection(float d1, float d2, float k) {
        float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
        return mix(d2, d1, h) + k * h * (1.0 - h);
      }
    `;
  }

  generateShaderCode() {
    if (this.children.length < 1) {
      this.warn("Intersection node needs at least one child");
      return this.noopShaderCode();
    }

    let shaderCode = this.children[0].shaderCode();
    if (shaderCode === this.noopShaderCode()) {
      return this.noopShaderCode(); // If first child is noop, result is noop
    }
 
    for (let i = 1; i < this.children.length; i++) {
      const childCode = this.children[i].shaderCode();
      // Check if either operand is a noop value
      if (shaderCode === this.noopShaderCode()) {
        return this.noopShaderCode(); // For intersection, if any is noop, result is noop
      } else if (childCode === this.noopShaderCode()) {
        continue; // Skip this child
      }
      
      if (this.smoothK > 0) {
        shaderCode = `opSmoothIntersection(${shaderCode}, ${childCode}, ${this.smoothK.toFixed(16)})`;
      } else {
        shaderCode = `opIntersection(${shaderCode}, ${childCode})`;
      }
    }
    return shaderCode;
  }

  getIcon() {
    return "🔄";
  }
}

class SubtractionNode extends TreeNode {
  constructor(children = [], smoothK = 0) {
    super("Subtraction");
    this.maxChildren = null;
    this.addChild(children);
    this.smoothK = smoothK;
  }

  getExactness() {
    return TreeNode.LOWERBOUND;
  }

  properties() {
    return {"smoothK": "float"};
  }

  generateShaderImplementation() {
    return `
      float opSubtraction(float d1, float d2) { return max(d1, -d2); }
      float opSmoothSubtraction(float d1, float d2, float k) {
        float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
        return mix(d1, -d2, h) + k * h * (1.0 - h);
      }
    `;
  }

  generateShaderCode() {
    if (this.children.length < 1) {
      this.warn("Subtraction node needs at least one child");
      return this.noopShaderCode();
    }

    let shaderCode = this.children[0].shaderCode();
    if (shaderCode === this.noopShaderCode()) {
      return this.noopShaderCode(); // If first child is noop, result is noop
    }
    
    for (let i = 1; i < this.children.length; i++) {
      const childCode = this.children[i].shaderCode();
      // Check if subtrahend is a noop value
      if (childCode === this.noopShaderCode()) {
        continue; // Skip this child
      }
      
      if (this.smoothK > 0) {
        shaderCode = `opSmoothSubtraction(${shaderCode}, ${childCode}, ${this.smoothK.toFixed(16)})`;
      } else {
        shaderCode = `opSubtraction(${shaderCode}, ${childCode})`;
      }
    }
    return shaderCode;
  }

  getIcon() {
    return "➖";
  }
}


// Detect environment and export accordingly
(function() {
  const nodes = { UnionNode, IntersectionNode, SubtractionNode };
  
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
