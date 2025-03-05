class TranslateNode extends TreeNode {
    constructor(offset = [0, 0, 0], children = []) {
      super("Translate");
      this.offset = offset;
      this.maxChildren = 1;
      this.addChild(children);
      this.recomputeSignature();
    }

    recomputeSignature() {
      this.signature = this.offset.map(v => Math.abs(v).toString().replace('.', '_')).join('_');
    }

    properties() {
      return {"offset": "vec3"};
    }

    shaderImplementation() {
      return `
        float ${this.getFunctionName()}(vec3 p) {
          p = p - vec3(${this.offset.map(v => v.toFixed(16)).join(", ")});
          return ${this.children[0].shaderCode()};
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
  constructor(axis = [0, 1, 0], angle = 0, children = []) {
    super("Rotate");
    this.axis = axis; // Rotation axis (should be normalized)
    this.angle = angle; // Rotation angle in degrees
    this.maxChildren = 1;
    this.addChild(children);
    this.recomputeSignature();
  }

  // Generate a unique ID based on the axis and angle values
  recomputeSignature() {
    this.signature = this.axis.map(v => Math.abs(v).toString().replace('.', '_')).join('_') + 
                     '_' + Math.abs(this.angle).toString().replace('.', '_');
  }

  properties() {
    return {"axis": "vec3", "angle": "float"};
  }

  shaderImplementation() {
    if (!this.hasChildren()) {
      this.warn("Rotate node has no children to transform");
      return '';
    }
    
    // Normalize the axis vector to ensure proper rotation
    const axisLength = Math.sqrt(
      this.axis[0] * this.axis[0] + 
      this.axis[1] * this.axis[1] + 
      this.axis[2] * this.axis[2]
    );
    
    const normalizedAxis = axisLength > 0 ? 
      [this.axis[0] / axisLength, this.axis[1] / axisLength, this.axis[2] / axisLength] : 
      [0, 1, 0]; // Default to Y-axis if the provided axis is a zero vector
    
    return `
      float ${this.getFunctionName()}(vec3 p) {
        // Rotation using Rodriguez rotation formula
        float angle = ${(this.angle*Math.PI/180.0).toFixed(16)};
        vec3 axis = normalize(vec3(${normalizedAxis.map(v => v.toFixed(16)).join(", ")}));
        
        // Apply rotation using Rodriguez formula
        float cosA = cos(angle);
        float sinA = sin(angle);
        float k = 1.0 - cosA;
        
        // Rotation matrix components
        float xx = axis.x * axis.x * k + cosA;
        float yy = axis.y * axis.y * k + cosA;
        float zz = axis.z * axis.z * k + cosA;
        float xy = axis.x * axis.y * k;
        float yz = axis.y * axis.z * k;
        float zx = axis.z * axis.x * k;
        float xs = axis.x * sinA;
        float ys = axis.y * sinA;
        float zs = axis.z * sinA;
        
        // Create rotation matrix and apply to point
        mat3 rotationMatrix = mat3(
          xx, xy - zs, zx + ys,
          xy + zs, yy, yz - xs,
          zx - ys, yz + xs, zz
        );
        
        p = rotationMatrix * p;
        
        return ${this.children[0].shaderCode()};
      }
    `;
  }

  generateShaderCode() {
    if (!this.hasChildren()) {
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
    this.recomputeSignature();
  }

  recomputeSignature() {
    this.signature = Math.abs(this.amplitude).toString().replace('.', '_') + "_" + Math.abs(this.frequency).toString().replace('.', '_');
  }

  properties() {
    return {"amplitude": "float", "frequency": "float"};
  }

  shaderImplementation() {
    if (!this.hasChildren()) {
      this.warn("Roughness node has no children to transform");
      return '';
    }
    
    return `
      float ${this.getFunctionName()}(vec3 p) {
        // Get the base distance from the child
        float d = ${this.children[0].shaderCode()};
        
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