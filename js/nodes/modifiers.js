class TranslateNode extends TreeNode {
    constructor(offset = [-1, 0, 0], children = []) {
      super("Translate");
      this.offset = offset;
      this.maxChildren = 1;
      this.addChild(children);
      // Generate a unique ID based on the offset values
      this.uniqueId = `Translate_${this.offset.map(v => Math.abs(v).toString().replace('.', '_')).join('_')}`;
    }

    shaderImplementation() {
      return `
        float ${this.getFunctionName()}(vec3 p) {
          p = p - vec3(${this.offset.map(v => v.toFixed(16)).join(", ")});
          return ${this.children[0].generateShaderCode()};
        }
      `;
    }

    generateShaderCode() {
      if (!this.hasChildren()) {
        this.warn("Translate node has no children to transform");
        return this.noopShaderCode();
      }
      
      return `${this.getFunctionName()}(p)`;
    }
  }

class RotateNode extends TreeNode {
  constructor(angles = [0, 0, 0], children = []) {
    super("Rotate");
    this.angles = angles; // Rotation angles in radians [x, y, z]
    this.maxChildren = 1;
    this.addChild(children);
  }

  shaderImplementation() {
    return `
      float ${this.getFunctionName()}(vec3 p) {
        // Rotate around X axis
        float cosX = cos(angles.x);
        float sinX = sin(angles.x);
        p.yz = vec2(p.y * cosX - p.z * sinX, p.y * sinX + p.z * cosX);
        
        // Rotate around Y axis
        float cosY = cos(angles.y);
        float sinY = sin(angles.y);
        p.xz = vec2(p.x * cosY + p.z * sinY, -p.x * sinY + p.z * cosY);
        
        // Rotate around Z axis
        float cosZ = cos(angles.z);
        float sinZ = sin(angles.z);
        p.xy = vec2(p.x * cosZ - p.y * sinZ, p.x * sinZ + p.y * cosZ);
        
        return ${this.children[0].generateShaderCode()};
      }
    `;
  }

  generateShaderCode() {
    if (!this.hasChildren()) {
      this.warn("Rotate node has no children to transform");
      return this.noopShaderCode();
    }
    
    return `sdRotate(p, vec3(${this.angles.map(v => v.toFixed(16)).join(", ")}))`;
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { TranslateNode, RotateNode };
  
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