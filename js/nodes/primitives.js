class SphereNode extends TreeNode {
  constructor() {
    super("Sphere");
    this.radius = 5.0;
  }

  properties() {
    return {"radius": "float"};
  }

  grabHandles() {
    return {
      "radius": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 0, 0), color: new Vec3(1, 0, 0) },
    };
  }

  makePeptide(p) {
    const d = P.sub(P.vlength(p), this.uniform('radius'));
    return P.struct({
      distance: d,
    });
  }

  getIcon() {
    return "🔴";
  }

  aabb() {
    return new AABB(new Vec3(-this.radius, -this.radius, -this.radius),
                   new Vec3(this.radius, this.radius, this.radius));
  }
}

class CylinderNode extends TreeNode {
  constructor() {
    super("Cylinder");
    this.diameter = 10.0;
    this.height = 10.0;
    this.roundRadius = 0.0;
  }

  properties() {
    return {"diameter": "float", "height": "float", "roundRadius": "float"};
  }

  grabHandles() {
    return {
      "diameter": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 0, 0), ratio: 0.5, color: new Vec3(1, 0, 0) },
      "height": { origin: new Vec3(0, 0, 0), axis: new Vec3(0, 0, 1), ratio: 0.5, color: new Vec3(0, 0, 1) },
      "roundRadius": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 0, 0) }
    };
  }

  makePeptide(p) {
    const pxy = P.vec3(P.vecX(p), P.vecY(p), P.zero());
    const pz = P.abs(P.vecZ(p));
    const radius = P.div(this.uniform('diameter'), P.const(2.0));
    const halfHeight = P.div(this.uniform('height'), P.const(2.0));
    let dx = P.sub(P.vlength(pxy), radius);
    let dz = P.sub(pz, halfHeight);
    if (this.roundRadius > 0.0) {
      dx = P.add(dx, this.uniform('roundRadius'));
      dz = P.add(dz, this.uniform('roundRadius'));
    }
    let dist = P.add(P.min(P.max(dx, dz), P.zero()), P.vlength(P.vmax(P.vec3(dx, dz, P.zero()), P.vconst(new Vec3(0.0)))));
    if (this.roundRadius > 0.0) {
      dist = P.sub(dist, this.uniform('roundRadius'));
    }
    return P.struct({distance: dist});
  }

  getIcon() {
    return "🔵";
  }

  aabb() {
    const halfHeight = this.height / 2;
    return new AABB(new Vec3(-this.diameter/2, -this.diameter/2, -halfHeight),
                   new Vec3(this.diameter/2, this.diameter/2, halfHeight));
  }
}

class BoxNode extends TreeNode {
  constructor() {
    super("Box");
    this.size = new Vec3(10, 10, 10);
    this.radius = 0.0;
  }

  properties() {
    return {"size": "vec3", "radius": "float"};
  }

  grabHandles() {
    return {
      "size.x": {
        origin: new Vec3(0, 0, 0),
        axis: new Vec3(1, 0, 0),
        ratio: 0.5,
        color: new Vec3(1, 0, 0),
        get: () => this.size.x,
        set: (value) => this.setProperty('size', new Vec3(value, this.size.y, this.size.z))
      },
      "size.y": {
        origin: new Vec3(0, 0, 0),
        axis: new Vec3(0, 1, 0),
        ratio: 0.5,
        color: new Vec3(0, 1, 0),
        get: () => this.size.y,
        set: (value) => this.setProperty('size', new Vec3(this.size.x, value, this.size.z))
      },
      "size.z": {
        origin: new Vec3(0, 0, 0),
        axis: new Vec3(0, 0, 1),
        ratio: 0.5,
        color: new Vec3(0, 0, 1),
        get: () => this.size.z,
        set: (value) => this.setProperty('size', new Vec3(this.size.x, this.size.y, value))
      },
      "radius": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 0, 0) },
    };
  }

  makePeptide(p) {
    let expr;
    const halfSize = P.vdiv(this.vuniform('size'), P.const(2.0));
    if (this.radius <= 0.0) {
      // vec3 d = abs(p) - b/2.0;
      // return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
      let d = P.vsub(P.vabs(p), halfSize);
      expr = P.add(P.vlength(P.vmax(d, P.vconst(new Vec3(0.0)))),
                   P.min(P.max(P.vecX(d), P.max(P.vecY(d), P.vecZ(d))), P.zero()));
    } else {
      // vec3 q = abs(p) - b/2.0 + r;
      // return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
      const radiusVec3 = P.vec3(this.uniform('radius'), this.uniform('radius'), this.uniform('radius'));
      let d = P.vadd(P.vsub(P.vabs(p), halfSize), radiusVec3);
      expr = P.sub(P.add(P.vlength(P.vmax(d, P.vconst(new Vec3(0.0)))),
                         P.min(P.max(P.vecX(d), P.max(P.vecY(d), P.vecZ(d))), P.zero())),
                   this.uniform('radius'));
    }
    return P.struct({distance: expr});
  }

  getIcon() {
    return "📦";
  }

  aabb() {
    return new AABB(new Vec3(-this.size.x/2, -this.size.y/2, -this.size.z/2),
                   new Vec3(this.size.x/2, this.size.y/2, this.size.z/2));
  }
}

class TorusNode extends TreeNode {
  constructor() {
    super("Torus");
    this.majorDiameter = 10.0;
    this.minorDiameter = 3.0;
  }

  properties() {
    return {"majorDiameter": "float", "minorDiameter": "float"};
  }

  grabHandles() {
    return {
      "majorDiameter": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 0, 0), ratio: 0.5, color: new Vec3(1, 0, 0) },
      "minorDiameter": { origin: new Vec3(0, 0, 0), axis: new Vec3(0, 0, 1), ratio: 0.5, color: new Vec3(0, 0, 1) },
    };
  }

  makePeptide(p) {
    const major = P.div(this.uniform('majorDiameter'), P.const(2.0));
    const minor = P.div(this.uniform('minorDiameter'), P.const(2.0));
    const lenxy = P.vlength(P.vec3(P.vecX(p), P.vecY(p), P.zero()));
    const q = P.vec3(P.sub(lenxy, major), P.vecZ(p), P.zero());
    return P.struct({distance: P.sub(P.vlength(q), minor)});
  }

  getIcon() {
    return "⭕";
  }

  aabb() {
    return new AABB(new Vec3(-(this.majorDiameter+this.minorDiameter)/2,
                             -(this.majorDiameter+this.minorDiameter)/2,
                             -this.minorDiameter/2),
                   new Vec3((this.majorDiameter+this.minorDiameter)/2,
                            (this.majorDiameter+this.minorDiameter)/2,
                            this.minorDiameter/2));
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