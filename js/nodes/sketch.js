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

  makePeptide(p) {
    if (this.polycurves.length === 0 || this.polycurves[0].length < 2) {
      return this.noop();
    }

    const polycurve = this.polycurves[0];
    const startPoint = polycurve[0];

    const sdSqLine = (p, a, b) => {
      const pa = P.vsub(p, a);
      const ba = P.vsub(b, a);
      const h = P.clamp(P.div(P.vdot(pa, ba), P.vdot(ba, ba)), P.zero(), P.one());
      const d = P.vsub(pa, P.vmul(ba, h));
      return [P.vdot(d, d), P.sub(P.mul(P.vecX(ba), P.vecY(pa)), P.mul(P.vecY(ba), P.vecX(pa)))];
    }

    const p2d = P.vec3(P.vecX(p), P.vecY(p), P.zero());

    // Starting point
    let va;
    let vb = P.vconst(new Vec3(startPoint.x, startPoint.y, 0.0));
    let pvb = P.vsub(p2d, vb);
    let d = P.vdot(pvb, pvb);
    let s = P.one();
    const eps = P.const(0.00001);

    // Each line segment
    for (let i = 1; i < polycurve.length; i++) {
      const endPoint = polycurve[i];
      va = vb;
      vb = P.vconst(new Vec3(endPoint.x, endPoint.y, 0.0));
      const ds = sdSqLine(p2d, va, vb);
      const py = P.vecY(p2d);
      const vay = P.vecY(va);
      const vby = P.vecY(vb);
      s = P.mix(s, P.neg(s), P.min(P.one(),
          P.add(P.mul(P.step(vay, py), P.mul(P.step(py, P.sub(vby, eps)), P.step(P.zero(), ds[1]))),
                P.mul(P.step(vby, py), P.mul(P.step(py, P.sub(vay, eps)), P.step(ds[1], P.zero()))))
      ));
      d = P.min(d, ds[0]);
    }

    // Closing segment
    va = vb;
    vb = P.vconst(new Vec3(startPoint.x, startPoint.y, 0.0));
    pvb = P.vsub(p2d, vb);
    const ds = sdSqLine(p2d, va, vb);
    const py = P.vecY(p2d);
    const vay = P.vecY(va);
    const vby = P.vecY(vb);
    s = P.mix(s, P.neg(s), P.min(P.one(),
        P.add(P.mul(P.step(vay, py), P.mul(P.step(py, P.sub(vby, eps)), P.step(P.zero(), ds[1]))),
              P.mul(P.step(vby, py), P.mul(P.step(py, P.sub(vay, eps)), P.step(ds[1], P.zero()))))
    ));
    d = P.min(d, ds[0]);
    d = P.mul(s, P.sqrt(P.abs(d))); // take abs(d) so that the interval can't contain negative numbers

    // At this point d tells us the distance to the nearest point on the sketch in the 2d plane.
    // To make an SDF that works in 3d, we need to extend this to 3d by using the distance to the
    // nearest point on the sketch in 3d space, but only when Z is not ~0.
    // We want to reproduce:
    //   if (abs(p.z) > 0.005) return length(vec2(abs(p.z)-0.005, max(d, 0.0)));
    //   return d;
    // But only using Peptide primitives (i.e. no conditionals).
    // So we use step() to work out whether we are in 2d mode or 3d mode, and then
    // use mix() to select between the 2d distance and the 3d distance.
    
    const zdist = P.sub(P.abs(P.vecZ(p)), P.const(0.005));
    const dist3d = P.vlength(P.vec3(zdist, P.max(d, P.zero()), P.zero()));
    return P.mix(d, dist3d, P.step(P.zero(), zdist));
  }

  getIcon() {
    return "🎨";
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

  aabb() {
    if (this.polycurves.length === 0) {
      return AABB.empty();
    }
    const aabb = this.polycurves[0].reduce((acc, point) => {
      return acc.expandByPoint(new Vec3(point.x, point.y, 0.0));
    }, new AABB(new Vec3(0, 0, 0), new Vec3(0, 0, 0)));
    return aabb;
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

