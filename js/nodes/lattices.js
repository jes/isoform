class GyroidNode extends TreeNode {
  constructor() {
    super("Gyroid");
    this.scale = 1.0;
  }

  properties() {
    return {"scale": "float"};
  }

  grabHandles() {
    return {
      "scale": { origin: new Vec3(0, 0, 0), ratio: 10, axis: new Vec3(1, 0, 0) },
    };
  }

  makePeptide(p) {
    p = P.vdiv(p, this.uniform('scale'));
    const gyroid = P.add(P.mul(P.sin(P.vecX(p)), P.cos(P.vecY(p))),
                   P.add(P.mul(P.sin(P.vecY(p)), P.cos(P.vecZ(p))),
                         P.mul(P.sin(P.vecZ(p)), P.cos(P.vecX(p)))));
    return P.mul(gyroid, P.mul(P.const(0.5), this.uniform('scale')));
  }
}

class CubicLatticeNode extends TreeNode {
  constructor() {
    super("CubicLattice");
    this.scale = 1.0;
    this.thickness = 0.5;
    this.blendRadius = 0.0;
    this.chamfer = false;
  }

  properties() {
    // XXX: don't expose chamfer because it seems broken?
    return {"scale": "float", "thickness": "float", "blendRadius": "float"};
  }

  grabHandles() {
    return {
      "scale": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 0, 0) },
      "thickness": { origin: new Vec3(0, 0, 0), axis: new Vec3(0, 0, 1) },
      "blendRadius": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 0, 0) },
    };
  }

  makePeptide(p) {
    const scaleV3 = P.vec3(this.uniform('scale'), this.uniform('scale'), this.uniform('scale'));
    const q = P.vabs(P.vsub(P.vmod(P.vabs(p), P.mul(P.const(2.0), this.uniform('scale'))), scaleV3));

    const dx = this.min(P.vecY(q), P.vecZ(q));
    const dy = this.min(P.vecX(q), P.vecZ(q));
    const dz = this.min(P.vecX(q), P.vecY(q));
    
    const d = this.max(this.max(dx, dy), dz);
    return P.sub(d, this.uniform('thickness'));
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