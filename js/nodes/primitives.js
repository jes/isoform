class SphereNode extends TreeNode {
  constructor(radius = 5.0) {
    super("Sphere");
    this.radius = radius;
  }

  boundingSphere() {
    return { centre: new Vec3(0, 0, 0), radius: this.radius };
  }

  getExactness() {
    return TreeNode.EXACT;
  }

  properties() {
    return {"radius": "float"};
  }

  generateShaderImplementation() {
    return `
      float sdSphere(vec3 p, float r) {
        return length(p) - r;
      }
    `;
  }

  generateShaderCode() {
    return `sdSphere(p, ${this.radius.toFixed(16)})`;
  }

  sdSphere(p, r) {
    return p.length() - r;
  }

  sdf(p) {
    return this.sdSphere(p, this.radius);
  }

  getIcon() {
    return "🔴";
  }
}

class CylinderNode extends TreeNode {
  constructor(diameter = 10.0, height = 10.0, roundRadius = 0.0) {
    super("Cylinder");
    this.diameter = diameter;
    this.height = height;
    this.roundRadius = roundRadius;
  }

  boundingSphere() {
    const v = new Vec3(this.diameter/2, this.height/2, 0.0);
    return { centre: new Vec3(0, 0, 0), radius: v.length() };
  }

  getExactness() {
    return TreeNode.EXACT;
  }

  properties() {
    return {"diameter": "float", "height": "float", "roundRadius": "float"};
  }

  generateShaderImplementation() {
    return `
      float sdCylinder(vec3 p, float r, float h) {
        vec2 d = vec2(length(p.xy) - r, abs(p.z) - h);
        return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
      }
      float sdRoundCylinder(vec3 p, float r, float h, float r2) {
        vec2 d = vec2(length(p.xy) - r + r2, abs(p.z) - h + r2);
        return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r2;
      }
    `;
  }

  generateShaderCode() {
    if (this.roundRadius > 0.0) {
      return `sdRoundCylinder(p, ${(this.diameter/2).toFixed(16)}, ${(this.height/2).toFixed(16)}, ${this.roundRadius.toFixed(16)})`;
    } else {
      return `sdCylinder(p, ${(this.diameter/2).toFixed(16)}, ${(this.height/2).toFixed(16)})`;
    }
  }

  sdCylinder(p, r, h) {
    const d = new Vec3(length(p.xy) - r, abs(p.z) - h, 0.0);
    return min(max(d.x, d.y), 0.0) + Math.length(max(d, 0.0));
  }

  sdRoundCylinder(p, r, h, r2) {
    const d = new Vec3(length(p.xy) - r + r2, abs(p.z) - h + r2, 0.0);
    return min(max(d.x, d.y), 0.0) + Math.length(max(d, 0.0)) - r2;
  }
 
  sdf(p) {
    if (this.roundRadius > 0.0) {
      return this.sdRoundCylinder(p, this.diameter/2, this.height/2, this.roundRadius);
    } else {
      return this.sdCylinder(p, this.diameter/2, this.height/2);
    }
  }

  getIcon() {
    return "🔵";
  }
}


class BoxNode extends TreeNode {
  constructor(size = [10, 10, 10], radius = 0.0) {
    super("Box");
    this.size = size instanceof Vec3 ? size : new Vec3(size[0]/2, size[1]/2, size[2]/2);
    this.radius = radius;
  }

  boundingSphere() {
    return { 
      centre: new Vec3(0, 0, 0), 
      radius: this.size.length() 
    };
  }

  getExactness() {
    return TreeNode.EXACT;
  }

  properties() {
    return {"size": "vec3", "radius": "float"};
  }

  generateShaderImplementation() {
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
      return `sdRoundBox(p, ${this.size.glsl()}, ${this.radius.toFixed(16)})`;
    } else {
      return `sdBox(p, ${this.size.glsl()})`;
    }
  }

  sdBox(p, b) {
    const d = p.abs().sub(b);
    return Math.length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
  }

  sdRoundBox(p, b, r) {
    const d = p.abs().sub(b).add(r);
    return Math.length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0) - r;
  }

  sdf(p) {
    if (this.radius > 0.0) {
      return this.sdRoundBox(p, this.size, this.radius);
    } else {
      return this.sdBox(p, this.size);
    }
  }
  getIcon() {
    return "📦";
  }
}

class TorusNode extends TreeNode {
  constructor(majorDiameter = 10.0, minorDiameter = 3.0) {
    super("Torus");
    this.majorDiameter = majorDiameter;
    this.minorDiameter = minorDiameter;
  }

  boundingSphere() {
    return { 
      centre: new Vec3(0, 0, 0), 
      radius: this.majorDiameter/2 + this.minorDiameter/2 
    };
  }

  getExactness() {
    return TreeNode.EXACT;
  }

  properties() {
    return {"majorDiameter": "float", "minorDiameter": "float"};
  }

  generateShaderImplementation() {
    return `
      float sdTorus(vec3 p, vec2 t) {
        vec2 q = vec2(length(p.xy) - t.x, p.z);
        return length(q) - t.y;
      }
    `;
  }

  generateShaderCode() {
    return `sdTorus(p, vec2(${(this.majorDiameter/2).toFixed(16)}, ${(this.minorDiameter/2).toFixed(16)}))`;
  }

  sdTorus(p, t) {
    const q = new Vec3(p.xy().length() - t.x, p.z, 0.0);
    return q.length() - t.y;
  }

  sdf(p) {
    return this.sdTorus(p, this.majorDiameter/2, this.minorDiameter/2);
  }

  getIcon() {
    return "⭕";
  }
}

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

// Detect environment and export accordingly
(function() {
  const nodes = { SphereNode, CylinderNode, BoxNode, TorusNode, GyroidNode };
  
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