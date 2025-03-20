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

  makePeptide(p) {
    return P.sub(P.vlength(p), P.const(this.radius));
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
      radius: this.size.length()/2.0 + this.radius,
    };
  }

  getExactness() {
    return TreeNode.EXACT;
  }

  properties() {
    return {"size": "vec3", "radius": "float"};
  }

  makePeptide(p) {
    let expr;
    if (this.radius <= 0.0) {
      // vec3 d = abs(p) - b/2.0;
      // return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
      let d = P.vsub(P.vabs(p), P.vconst(this.size.div(2.0)));
      expr = P.add(P.vlength(P.vmax(d, P.vconst(new Vec3(0.0)))),
                   P.min(P.max(P.vecX(d), P.max(P.vecY(d), P.vecZ(d))), P.const(0.0)));
    } else {
      // vec3 q = abs(p) - b/2.0 + r;
      // return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
      let d = P.vadd(P.vsub(P.vabs(p), P.vconst(this.size.div(2.0))), P.vconst(new Vec3(this.radius)));
      expr = P.sub(P.add(P.vlength(P.vmax(d, P.vconst(new Vec3(0.0)))),
                         P.min(P.max(P.vecX(d), P.max(P.vecY(d), P.vecZ(d))), P.const(0.0))),
                   P.const(this.radius));
    }
    return expr;
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

  makePeptide(p) {
    const major = P.const(this.majorDiameter/2);
    const minor = P.const(this.minorDiameter/2);
    const lenxy = P.vlength(P.vec3(P.vecX(p), P.vecY(p), P.const(0)));
    const q = P.vec3(P.sub(lenxy, major), P.vecZ(p), P.const(0));
    return P.sub(P.vlength(q), minor);
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