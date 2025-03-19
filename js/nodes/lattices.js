class GyroidNode extends TreeNode {
  constructor() {
    super("Gyroid");
    this.scale = 1.0;
  }

  properties() {
    return {"scale": "float"};
  }

  peptide(p) {
    p = P.vdiv(p, P.const(this.scale));
    return P.add(P.mul(P.sin(P.vecX(p)), P.cos(P.vecY(p))),
           P.add(P.mul(P.sin(P.vecY(p)), P.cos(P.vecZ(p))),
                 P.mul(P.sin(P.vecZ(p)), P.cos(P.vecX(p)))));
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

  generateShaderImplementation() {
    let minfn = "min(d,d1)";
    if (this.blendRadius > 0.0) {
        if (this.chamfer) {
            minfn = `chmin(d,d1,${this.blendRadius.toFixed(16)})`;
        } else {
            minfn = `smin(d,d1,${this.blendRadius.toFixed(16)})`;
        }
    }
    let maxfn = "max(d,d1)";
    if (this.blendRadius > 0.0) {
        if (this.chamfer) {
            maxfn = `chmax(d,d1,${this.blendRadius.toFixed(16)})`;
        } else {
            maxfn = `smax(d,d1,${this.blendRadius.toFixed(16)})`;
        }
    }
    return `
      float ${this.getFunctionName()}(vec3 p) {
        float scale = ${this.scale.toFixed(16)};
        float thickness = ${this.thickness.toFixed(16)};
        // Normalize to cell coordinates
        vec3 q = abs(mod(abs(p), scale*2.0) - scale);

        float d;
        float d1;

        d = q.y;
        d1 = q.z;
        float dx = ${minfn};
        d = q.x;
        d1 = q.z;
        float dy = ${minfn};
        d = q.y;
        d1 = q.x;
        float dz = ${minfn};

        d = dx;
        d1 = dy;
        d = ${maxfn};
        d1 = dz;
        d = ${maxfn};
        return d - thickness;
      }
    `;
  }

  generateShaderCode() {
    return `${this.getFunctionName()}(p)`;
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