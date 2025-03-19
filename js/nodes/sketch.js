class SketchNode extends TreeNode {
  constructor(points = []) {
    super("Sketch");
    // New representation: first point is start, rest are end points of segments
    this.polycurves = points.length > 0 ? [points] : [];
    this.maxChildren = 0; // Primitive node with no children
  }

  is2d() {
    return true;
  }

  getExactness() {
    return TreeNode.EXACT;
  }

  generateShaderImplementation() {
    if (this.polycurves.length === 0 || this.polycurves[0].length < 2) {
      return `
        float ${this.getFunctionName()}(vec3 p) {
          return 1000.0; // Large distance if no valid sketch
        }
      `;
    }
    
    const polycurve = this.polycurves[0];
    const startPoint = polycurve[0];
    
    const sdSqLine = (p, a, b) => {
      const pa = P.vsub(p, a);
      const ba = P.vsub(b, a);
      const h = P.clamp(P.div(P.vdot(pa, ba), P.vdot(ba, ba)), P.const(0.0), P.const(1.0));
      const d = P.vsub(pa, P.vmul(ba, h));
      return [P.vdot(d, d), P.sub(P.mul(P.vecX(ba), P.vecY(pa)), P.mul(P.vecY(ba), P.vecX(pa)))];
    }

    // Starting point
    let va;
    let vb = P.vconst(new Vec3(startPoint.x, startPoint.y, 0.0));
    const pvb = P.vsub(P.vvar('p'), vb);
    let d = P.vdot(pvb, pvb);
    let s = P.const(1.0);
    const eps = P.const(0.00001);

    // Each line segment
    for (let i = 1; i < polycurve.length; i++) {
      const endPoint = polycurve[i];
      va = vb;
      vb = P.vconst(new Vec3(endPoint.x, endPoint.y, 0.0));
      const ds = sdSqLine(pvb, va, vb);
      const py = P.vecY(P.vvar('p'));
      const vay = P.vecY(va);
      const vby = P.vecY(vb);
      s = P.mix(s, P.sub(P.const(0.0), s), P.min(P.const(1.0),
          P.add(P.mul(P.step(vay, py), P.mul(P.step(py, P.sub(vby, eps)), P.step(P.const(0.0), ds[1]))),
                P.mul(P.step(vby, py), P.mul(P.step(py, P.sub(vay, eps)), P.step(ds[1], P.const(0.0)))))
      ));
      d = P.min(d, ds[0]);
    }

    // Closing segment
    va = vb;
    vb = P.vconst(new Vec3(startPoint.x, startPoint.y, 0.0));
    const ds = sdSqLine(pvb, va, vb);
    const py = P.vecY(P.vvar('p'));
    const vay = P.vecY(va);
    const vby = P.vecY(vb);
    s = P.mix(s, P.sub(P.const(0.0), s), P.min(P.const(1.0),
        P.add(P.mul(P.step(vay, py), P.mul(P.step(py, P.sub(vby, eps)), P.step(P.const(0.0), ds[1]))),
              P.mul(P.step(vby, py), P.mul(P.step(py, P.sub(vay, eps)), P.step(ds[1], P.const(0.0)))))
    ));
    d = P.min(d, ds[0]);
    d = P.mul(s, P.sqrt(d));

    const ssa = new PeptideSSA(d);
    const peptideCode = ssa.compileToGLSL(`float ${this.getFunctionName()}_peptide(vec3 p)`);

    return `
      ${peptideCode}
      float ${this.getFunctionName()}(vec3 p) {
        // this is an exact 2d SDF at Z=0, we just make a broken 3d SDF so that it looks
        // like a flat shape before being extruded/revolved, and so that transforms, unions,
        // etc. of 2d shapes still work
        float d = ${this.getFunctionName()}_peptide(vec3(p.x, p.y, 0.0));
        if (abs(p.z) > 0.005) return length(vec2(abs(p.z)-0.005, max(d, 0.0)));
        return d;
      }
    `;
  }

  generateShaderCode() {
    return `
      ${this.getFunctionName()}(p)
    `;
  }

  getIcon() {
    return "🎨";
  }
  
  getProperties() {
    return [
      // Properties for editing the sketch would go here
    ];
  }

  // Add a new vertex to the sketch
  addVertex(polycurveIndex, segmentIndex, position) {
    if (!this.polycurves[polycurveIndex]) return;
    
    // Insert the new point after the specified segment index
    this.polycurves[polycurveIndex].splice(segmentIndex + 1, 0, position);
    this.markDirty();
  }

  // Update a vertex position
  updateVertex(polycurveIndex, vertexIndex, position) {
    if (!this.polycurves[polycurveIndex] || 
        vertexIndex >= this.polycurves[polycurveIndex].length) return;
    
    this.polycurves[polycurveIndex][vertexIndex] = position;
    this.markDirty();
  }

  // Remove a vertex from the sketch
  removeVertex(polycurveIndex, vertexIndex) {
    if (!this.polycurves[polycurveIndex]) return;
    
    // Don't remove if we would have fewer than 3 points (need at least a triangle)
    if (this.polycurves[polycurveIndex].length <= 3) return;
    
    this.polycurves[polycurveIndex].splice(vertexIndex, 1);
    this.markDirty();
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { SketchNode };
  
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

