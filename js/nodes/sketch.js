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
    
    let code = `
      vec2 p2d = p.xy;
      
      // Starting point
      vec2 vb = vec2(${startPoint.x.toFixed(16)}, ${startPoint.y.toFixed(16)});
      
      float d = dot2(p2d - vb);
      float s = 1.0;
      vec2 va;
      vec2 ds;
      const float eps = 0.00001;
    `;
    
    // Generate code for each line segment
    for (let i = 1; i < polycurve.length; i++) {
      const endPoint = polycurve[i];
      
      code += `
      // Segment ${i}
      va = vb;
      vb = vec2(${endPoint.x.toFixed(16)}, ${endPoint.y.toFixed(16)});
      ds = sdSqLine(p2d, va, vb);
      
      // Branchless in/out test
      s = mix(s, -s, min(1.0,
        step(va.y, p2d.y) * step(p2d.y, vb.y-eps) * step(0.0, ds.y) +
        step(vb.y, p2d.y) * step(p2d.y, va.y-eps) * step(ds.y, 0.0)
      ));
      
      d = min(d, ds.x);
      `;
    }
    
    // Add closing segment back to start point
    code += `
      // Closing segment
      va = vb;
      vb = vec2(${startPoint.x.toFixed(16)}, ${startPoint.y.toFixed(16)});
      ds = sdSqLine(p2d, va, vb);
      
      // Branchless in/out test
      s = mix(s, -s, min(1.0,
        step(va.y, p2d.y) * step(p2d.y, vb.y-eps) * step(0.0, ds.y) +
        step(vb.y, p2d.y) * step(p2d.y, va.y-eps) * step(ds.y, 0.0)
      ));
      
      d = min(d, ds.x);
      
      d = s * sqrt(d);
    `;

    return `
      float ${this.getFunctionName()}(vec3 p) {
        // this is an exact 2d SDF at Z=0, we just make a broken 3d SDF so that it looks
        // like a flat shape before being extruded/revolved, and so that transforms, unions,
        // etc. of 2d shapes still work
        ${code}
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

