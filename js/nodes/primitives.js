class SphereNode extends TreeNode {
  constructor(radius = 5.0) {
    super("Sphere");
    this.radius = radius;
  }

  properties() {
    return {"radius": "float"};
  }

  grabHandles() {
    return {
      "radius": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 0, 0) },
    };
  }

  makePeptide(p) {
    return P.sub(P.vlength(p), this.uniform('radius'));
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

  properties() {
    return {"diameter": "float", "height": "float", "roundRadius": "float"};
  }

  grabHandles() {
    return {
      "diameter": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 0, 0) },
      "height": { origin: new Vec3(0, 0, 0), axis: new Vec3(0, 0, 1) },
      "roundRadius": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 0, 0) },
    };
  }

  makePeptide(p) {
    const pxy = P.vec3(P.vecX(p), P.vecY(p), P.const(0));
    const pz = P.abs(P.vecZ(p));
    const radius = P.div(this.uniform('diameter'), P.const(2.0));
    const halfHeight = P.div(this.uniform('height'), P.const(2.0));
    let dx = P.sub(P.vlength(pxy), radius);
    let dz = P.sub(pz, halfHeight);
    if (this.roundRadius > 0.0) {
      dx = P.add(dx, this.uniform('roundRadius'));
      dz = P.add(dz, this.uniform('roundRadius'));
    }
    const dist = P.add(P.min(P.max(dx, dz), P.const(0.0)), P.vlength(P.vmax(P.vec3(dx, dz, P.const(0)), P.vconst(new Vec3(0.0)))));
    if (this.roundRadius > 0.0) {
      return P.sub(dist, this.uniform('roundRadius'));
    } else {
      return dist;
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

  properties() {
    return {"size": "vec3", "radius": "float"};
  }

  makePeptide(p) {
    let expr;
    const halfSize = P.vdiv(this.vuniform('size'), P.const(2.0));
    if (this.radius <= 0.0) {
      // vec3 d = abs(p) - b/2.0;
      // return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
      let d = P.vsub(P.vabs(p), halfSize);
      expr = P.add(P.vlength(P.vmax(d, P.vconst(new Vec3(0.0)))),
                   P.min(P.max(P.vecX(d), P.max(P.vecY(d), P.vecZ(d))), P.const(0.0)));
    } else {
      // vec3 q = abs(p) - b/2.0 + r;
      // return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
      const radiusVec3 = P.vec3(this.uniform('radius'), this.uniform('radius'), this.uniform('radius'));
      let d = P.vadd(P.vsub(P.vabs(p), halfSize), radiusVec3);
      expr = P.sub(P.add(P.vlength(P.vmax(d, P.vconst(new Vec3(0.0)))),
                         P.min(P.max(P.vecX(d), P.max(P.vecY(d), P.vecZ(d))), P.const(0.0))),
                   this.uniform('radius'));
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

  properties() {
    return {"majorDiameter": "float", "minorDiameter": "float"};
  }

  makePeptide(p) {
    const major = P.div(this.uniform('majorDiameter'), P.const(2.0));
    const minor = P.div(this.uniform('minorDiameter'), P.const(2.0));
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