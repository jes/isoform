class TransformNode extends TreeNode {
  constructor(translation = [0, 0, 0], rotationAxis = [0, 1, 0], rotationAngle = 0, children = []) {
    super("Transform");
    this.translation = translation; // Translation vector [x, y, z]
    this.rotationAxis = rotationAxis; // Axis of rotation [x, y, z]
    this.rotationAngle = rotationAngle; // Angle in degrees
    this.maxChildren = 1;
    this.applyToSecondary = true;
    this.addChild(children);
  }

  getCategory() {
    return TreeNode.EXACT;
  }

  properties() {
    return {
      "translation": "vec3", 
      "rotationAxis": "vec3", 
      "rotationAngle": "float"
    };
  }

  generateShaderImplementation() {
    if (!this.hasChildren()) {
      this.warn("Transform node has no children to transform");
      return '';
    }
    
    // Convert rotation angle from degrees to radians
    const angleRad = (this.rotationAngle * Math.PI / 180.0).toFixed(16);
    
    // Normalize the rotation axis
    const axisLength = Math.sqrt(
      this.rotationAxis[0] * this.rotationAxis[0] + 
      this.rotationAxis[1] * this.rotationAxis[1] + 
      this.rotationAxis[2] * this.rotationAxis[2]
    );
    
    const normalizedAxis = axisLength > 0 ? 
      this.rotationAxis.map(v => (v / axisLength).toFixed(16)) : 
      [0, 1, 0].map(v => v.toFixed(16));
    
    return `
      float ${this.getFunctionName()}(vec3 p) {
        // Apply translation
        p = p - vec3(${this.translation.map(v => v.toFixed(16)).join(", ")});
        
        // Apply rotation using axis-angle
        float angle = ${angleRad};
        if (angle != 0.0) {
          vec3 axis = vec3(${normalizedAxis.join(", ")});
          
          // Rodrigues rotation formula
          float cosA = cos(angle);
          float sinA = sin(angle);
          float k = 1.0 - cosA;
          
          vec3 a = axis * dot(axis, p) * k;
          vec3 b = p * cosA;
          vec3 c = cross(axis, p) * sinA;
          
          p = a + b + c;
        }
        
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
  }

  getCategory() {
    return TreeNode.ISOSURFACE;
  }

  properties() {
    return {"amplitude": "float", "frequency": "float"};
  }

  generateShaderImplementation() {
    if (!this.hasChildren()) {
      this.warn("Roughness node has no children to transform");
      return '';
    }
    
    return `
      float ${this.getFunctionName()}(vec3 p) {
        // Get the base distance from the child
        float d = ${this.children[0].shaderCode()};
        
        // Create roughness using sine waves in different directions
        float noise = sin(p.x * ${this.frequency.toFixed(16)}) * 
                      sin(p.y * ${this.frequency.toFixed(16)}) * 
                      sin(p.z * ${this.frequency.toFixed(16)}) * 
                      sin((p.x + p.y + p.z) * ${(this.frequency * 1.5).toFixed(16)});
                      
        // Add some higher frequency components for more detail
        noise += 0.5 * sin(p.x * ${(this.frequency * 2.0).toFixed(16)}) * 
                      sin(p.y * ${(this.frequency * 2.0).toFixed(16)}) * 
                      sin(p.z * ${(this.frequency * 2.0).toFixed(16)});
        
        // Scale the noise by the amplitude and add to the distance
        return d + noise * ${this.amplitude.toFixed(16)};
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

class ScaleNode extends TreeNode {
  constructor(k = 2.0, alongAxis = false, axis = [0, 0, 1], children = []) {
    super("Scale");
    this.k = k; // Scale factor
    this.alongAxis = alongAxis; // Whether to scale along a specific axis
    this.axis = axis; // The axis to scale along [x, y, z]
    this.maxChildren = 1;
    this.applyToSecondary = true;
    this.addChild(children);
  }

  getCategory() {
    return this.alongAxis ? TreeNode.LOWERBOUND : TreeNode.EXACT;
  }

  properties() {
    return {
      "k": "float",
      "alongAxis": "bool",
      "axis": "vec3"
    };
  }

  generateShaderImplementation() {
    if (!this.hasChildren()) {
      this.warn("Scale node has no children to transform");
      return '';
    }
    
    // Normalize the axis if scaling along axis
    let normalizedAxis = [0, 0, 1];
    if (this.alongAxis) {
      const axisLength = Math.sqrt(
        this.axis[0] * this.axis[0] + 
        this.axis[1] * this.axis[1] + 
        this.axis[2] * this.axis[2]
      );
      
      normalizedAxis = axisLength > 0 ? 
        this.axis.map(v => (v / axisLength).toFixed(16)) : 
        [0, 0, 1].map(v => v.toFixed(16));
    }
    
    return `
      float ${this.getFunctionName()}(vec3 p) {
        ${this.alongAxis ? `
        // Scale along specific axis
        vec3 axis = vec3(${normalizedAxis.join(", ")});
        float k = ${this.k.toFixed(16)};
        
        // Project p onto the axis
        float projLength = dot(p, axis);
        vec3 projVec = projLength * axis;
        
        // Decompose p into components parallel and perpendicular to axis
        vec3 perpVec = p - projVec;
        
        // Scale only the parallel component
        p = perpVec + projVec / k;
        
        // Compute the distance in the scaled space
        // we multiply by k only if k <= 1.0, because we can't maintain
        // the distance property in along-axis mode, but we can still maintain the
        // lowerbound property
        if (k > 1.0) {
          return ${this.children[0].shaderCode()};
        } else {
          return ${this.children[0].shaderCode()} * k;
        }
        ` : `
        // Uniform scaling
        vec3 p0 = p;
        p = p / ${this.k.toFixed(16)};
        float dist = ${this.children[0].shaderCode()};
        p = p0;
        return dist * ${this.k.toFixed(16)};
        `}
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
    return "⇲";
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { TransformNode, RoughnessNode, ScaleNode };
  
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