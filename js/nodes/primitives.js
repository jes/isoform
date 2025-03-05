class SphereNode extends TreeNode {
  constructor(radius = 1.0) {
    super("Sphere");
    this.radius = radius;
  }

  properties() {
    return {"radius": "float"};
  }

  shaderImplementation() {
    return `
      float sdSphere(vec3 p, float r) {
        return length(p) - r;
      }
    `;
  }

  generateShaderCode() {
    return `sdSphere(p, ${this.radius.toFixed(16)})`;
  }

  getIcon() {
    return "🔴";
  }
}

class CylinderNode extends TreeNode {
  constructor(radius = 1.0, height = 1.0) {
    super("Cylinder");
    this.radius = radius;
    this.height = height;
  }

  properties() {
    return {"radius": "float", "height": "float"};
  }
  
  shaderImplementation() {
    return `
      float sdCylinder(vec3 p, float r, float h) {
        vec2 d = vec2(length(p.xz) - r, abs(p.y) - h);
        return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
      }
    `;
  }

  generateShaderCode() {
    return `sdCylinder(p, ${this.radius.toFixed(16)}, ${this.height.toFixed(16)})`;
  }

  getIcon() {
    return "🔵";
  }
}


class BoxNode extends TreeNode {
  constructor(size = [1, 1, 1], radius = 0.0) {
    super("Box");
    this.size = size;
    this.radius = radius;
  }

  properties() {
    return {"size": "vec3", "radius": "float"};
  }

  shaderImplementation() {
    return `
      float sdBox(vec3 p, vec3 b) {
        vec3 d = abs(p) - b;
        return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
      }
      float sdRoundBox(vec3 p, vec3 b, float r) {
        vec3 q = abs(p) - b + r;
        return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
      }
    `;
  }

  generateShaderCode() {
    if (this.radius > 0.0) {
      return `sdRoundBox(p, vec3(${this.size[0].toFixed(16)}, ${this.size[1].toFixed(16)}, ${this.size[2].toFixed(16)}), ${this.radius.toFixed(16)})`;
    } else {
      return `sdBox(p, vec3(${this.size[0].toFixed(16)}, ${this.size[1].toFixed(16)}, ${this.size[2].toFixed(16)}))`;
    }
  }

  getIcon() {
    return "📦";
  }
}

class TorusNode extends TreeNode {
  constructor(majorRadius = 1.0, minorRadius = 0.3) {
    super("Torus");
    this.majorRadius = majorRadius;
    this.minorRadius = minorRadius;
  }

  properties() {
    return {"majorRadius": "float", "minorRadius": "float"};
  }

  shaderImplementation() {
    return `
      float sdTorus(vec3 p, vec2 t) {
        vec2 q = vec2(length(p.xz) - t.x, p.y);
        return length(q) - t.y;
      }
    `;
  }

  generateShaderCode() {
    return `sdTorus(p, vec2(${this.majorRadius.toFixed(16)}, ${this.minorRadius.toFixed(16)}))`;
  }

  getIcon() {
    return "⭕";
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { SphereNode, CylinderNode, BoxNode, TorusNode };
  
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