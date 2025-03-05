class TranslateNode extends TreeNode {
    constructor(offset = [-1, 0, 0], children = []) {
      super("Translate");
      this.offset = offset;
      this.maxChildren = 1;
      this.addChild(children);
      // Generate a unique ID based on the offset values
      this.uniqueId = this.offset.map(v => Math.abs(v).toString().replace('.', '_')).join('_');
    }

    properties() {
      return {"offset": "vec3"};
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

    getIcon() {
      return "↔️";
    }
  }

class RotateNode extends TreeNode {
  constructor(angles = [0, 0, 0], children = []) {
    super("Rotate");
    this.angles = angles; // Rotation angles in radians [x, y, z]
    this.maxChildren = 1;
    this.addChild(children);
    this.uniqueId = angles.map(v => Math.abs(v).toString().replace('.', '_')).join('_');
  }

  properties() {
    return {"angles": "vec3"};
  }

  shaderImplementation() {
    return `
      float ${this.getFunctionName()}(vec3 p) {
        // Rotate around X axis
        float cosX = cos(${this.angles[0].toFixed(16)});
        float sinX = sin(${this.angles[0].toFixed(16)});
        p.yz = vec2(p.y * cosX - p.z * sinX, p.y * sinX + p.z * cosX);
        
        // Rotate around Y axis
        float cosY = cos(${this.angles[1].toFixed(16)});
        float sinY = sin(${this.angles[1].toFixed(16)});
        p.xz = vec2(p.x * cosY + p.z * sinY, -p.x * sinY + p.z * cosY);
        
        // Rotate around Z axis
        float cosZ = cos(${this.angles[2].toFixed(16)});
        float sinZ = sin(${this.angles[2].toFixed(16)});
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
    
    return `${this.getFunctionName()}(p)`;
  }

  getIcon() {
    return "🔄";
  }
}

class RoughnessNode extends TreeNode {
  constructor(amplitude = 0.1, frequency = 1.0, children = []) {
    super("Roughness");
    this.amplitude = amplitude; // Controls the height of the roughness
    this.frequency = frequency; // Controls how dense the roughness pattern is
    this.maxChildren = 1;
    this.addChild(children);
    this.uniqueId = Math.abs(this.amplitude).toString().replace('.', '_') + "_" + Math.abs(this.frequency).toString().replace('.', '_');
  }

  properties() {
    return {"amplitude": "float", "frequency": "float"};
  }

  shaderImplementation() {
    return `
      float ${this.getFunctionName()}(vec3 p) {
        // Get the base distance from the child
        float d = ${this.children[0].generateShaderCode()};
        
        // Create roughness using sine waves in different directions
        float noise = sin(p.x * ${this.frequency.toFixed(8)}) * 
                      sin(p.y * ${this.frequency.toFixed(8)}) * 
                      sin(p.z * ${this.frequency.toFixed(8)}) * 
                      sin((p.x + p.y + p.z) * ${(this.frequency * 1.5).toFixed(8)});
                      
        // Add some higher frequency components for more detail
        noise += 0.5 * sin(p.x * ${(this.frequency * 2.0).toFixed(8)}) * 
                      sin(p.y * ${(this.frequency * 2.0).toFixed(8)}) * 
                      sin(p.z * ${(this.frequency * 2.0).toFixed(8)});
        
        // Scale the noise by the amplitude and add to the distance
        return d + noise * ${this.amplitude.toFixed(8)};
      }
    `;
  }

  generateShaderCode() {
    if (!this.hasChildren()) {
      this.warn("Roughness node has no children to transform");
      return this.noopShaderCode();
    }
    
    return `${this.getFunctionName()}(p)`;
  }

  getIcon() {
    return "〰️";
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { TranslateNode, RotateNode, RoughnessNode };
  
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