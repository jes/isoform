class GyroidNode extends TreeNode {
  constructor() {
    super("Gyroid");
    this.scale = 1.0;
  }

  properties() {
    return {"scale": "float"};
  }

  generateShaderImplementation() {
    return `
      float sdGyroid(vec3 p, float scale) {
        p = p / scale;
        float gyroid = sin(p.x) * cos(p.y) + sin(p.y) * cos(p.z) + sin(p.z) * cos(p.x);
        return gyroid;
      }
    `;
  }

  generateShaderCode() {
    return `sdGyroid(p, ${this.scale.toFixed(16)})`;
  }
}

class CubicLatticeNode extends TreeNode {
  constructor() {
    super("Cubic Lattice");
    this.scale = 1.0;
    this.thickness = 0.5;
  }

  properties() {
    return {"scale": "float", "thickness": "float"};
  }

  generateShaderImplementation() {
    return `
      float sdCubicLattice(vec3 p, float scale, float thickness) {
        // Normalize to cell coordinates
        vec3 q = mod(abs(p), scale*2.0) - scale;
        
        // Calculate distance to each axis
        vec3 d = abs(q);
        
        // We want material where at least two coordinates are close to the edge
        // Sort the distances
        if (d.x > d.y) { float tmp = d.x; d.x = d.y; d.y = tmp; }
        if (d.y > d.z) { float tmp = d.y; d.y = d.z; d.z = tmp; }
        if (d.x > d.y) { float tmp = d.x; d.x = d.y; d.y = tmp; }
        
        // Distance to the strut (we want material where the second smallest distance is small)
        return d.y - thickness;
      }
    `;
  }

  generateShaderCode() {
    return `sdCubicLattice(p, ${this.scale.toFixed(16)}, ${this.thickness.toFixed(16)})`;
  }

  getIcon() {
    return "🔩";
  }
}



// Detect environment and export accordingly
(function() {
  const nodes = { GyroidNode, CubicLatticeNode };
  
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