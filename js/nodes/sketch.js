class SketchNode extends TreeNode {
  constructor(points = []) {
    super("Sketch");
    // New representation: first point is start, rest are end points of segments
    this.polycurves = points.length > 0 ? [points] : [];
    this.maxChildren = 0; // Primitive node with no children
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
    
    let code = `
      vec2 p2d = p.xy;
      
      // Starting point
      vec2 vb = vec2(${startPoint.x.toFixed(16)}, ${startPoint.y.toFixed(16)});
      
      float d = dot2(p2d - vb);
      float s = 1.0;
      vec2 va;
      vec2 ds;
      bvec3 cond;
    `;
    
    // Generate code for each line segment
    for (let i = 1; i < polycurve.length; i++) {
      const endPoint = polycurve[i];
      
      code += `
      // Segment ${i}
      va = vb;
      vb = vec2(${endPoint.x.toFixed(16)}, ${endPoint.y.toFixed(16)});
      ds = sdSqLine(p2d, va, vb);
      
      // in/out test
      cond = bvec3(p.y>=va.y, p.y<vb.y, ds.y>0.0);
      if (all(cond) || all(not(cond))) s *= -1.0;
      
      d = min(d, ds.x);
      `;
    }
    
    // Add closing segment back to start point
    code += `
      // Closing segment
      va = vb;
      vb = vec2(${startPoint.x.toFixed(16)}, ${startPoint.y.toFixed(16)});
      ds = sdSqLine(p2d, va, vb);
      
      // in/out test
      cond = bvec3(p.y>=va.y, p.y<vb.y, ds.y>0.0);
      if (all(cond) || all(not(cond))) s *= -1.0;
      
      d = min(d, ds.x);
      
      d = s * sqrt(d);
    `;

    return `
      // Helper function for dot product with itself
      float dot2(vec2 v) {
        return dot(v, v);
      }

      // Squared distance and projection factor to a line segment
      vec2 sdSqLine(vec2 p, vec2 a, vec2 b) {
        vec2 pa = p - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / dot2(ba), 0.0, 1.0);
        vec2 d = pa - ba * h;
        return vec2(dot2(d), ba.x*pa.y-ba.y*pa.x);
      }

      float ${this.getFunctionName()}(vec3 p) {
        ${code}
        // the max() turns it from an infinite extrusion into a 0.002mm thick surface
        return max(d, abs(p.z)-0.001);
      }
    `;
  }

  generateShaderCode() {
    if (this.polycurves.length === 0 || this.polycurves[0].length < 2) {
      return this.noopShaderCode();
    }

    return `
      ${this.getFunctionName()}(p)
    `;
  }

  sdf(p) {
    // JavaScript implementation of the SDF
    if (this.polycurves.length === 0 || this.polycurves[0].length < 2) {
      return 1000.0; // Large distance if no valid sketch
    }
    
    // Project to 2D (assuming sketch is in XY plane)
    const p2d = new Vec2(p.x, p.y);
    
    const polycurve = this.polycurves[0];
    const startPoint = polycurve[0];
    let vb = new Vec2(startPoint.x, startPoint.y);
    
    let d = p2d.sub(vb).lengthSq();
    let s = 1.0;
    
    // Process all segments
    for (let i = 1; i < polycurve.length; i++) {
      const va = vb.clone();
      const endPoint = polycurve[i];
      vb = new Vec2(endPoint.x, endPoint.y);
      
      const ds = this.sdSqLine(p2d, va, vb);
      
      // in/out test
      if ((p2d.y >= va.y && p2d.y < vb.y && ds.y > 0.0) ||
          (p2d.y < va.y && p2d.y >= vb.y && ds.y <= 0.0)) {
        s *= -1.0;
      }
      
      d = Math.min(d, ds.x);
    }
    
    // Process closing segment back to start
    const va = vb.clone();
    vb = new Vec2(startPoint.x, startPoint.y);
    
    const ds = this.sdSqLine(p2d, va, vb);
    
    // in/out test
    if ((p2d.y >= va.y && p2d.y < vb.y && ds.y > 0.0) ||
        (p2d.y < va.y && p2d.y >= vb.y && ds.y <= 0.0)) {
      s *= -1.0;
    }
    
    d = Math.min(d, ds.x);
    
    return s * Math.sqrt(d);
  }
  
  // Helper function for JavaScript implementation
  sdSqLine(p, a, b) {
    const pa = p.sub(a);
    const ba = b.sub(a);
    const h = Math.max(0, Math.min(1, pa.dot(ba) / ba.lengthSq()));
    const d = pa.sub(ba.mul(h));
    return { x: d.lengthSq(), y: ba.x * pa.y - ba.y * pa.x };
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

