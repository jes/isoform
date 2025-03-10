class SketchNode extends TreeNode {
  constructor(polycurves = []) {
    super("Sketch");
    this.polycurves = polycurves;
    this.maxChildren = 0; // Primitive node with no children
    this.exactness = "Exact"; // Assuming the sketch SDF is exact
  }

  generateShaderImplementation() {
    // Get the starting point of the first curve
    const firstPoint = this.polycurves[0].start;
    
    let code = ``;
    
    // Generate the sketch SDF directly without closure
    code += `
      vec2 p2d = p.xy;
      
      // Starting point
      vec2 vb = vec2(${firstPoint.x.toFixed(16)}, ${firstPoint.y.toFixed(16)});
      
      float d = dot2(p2d - vb);
      float s = 1.0;
      vec2 va;
      vec2 ds;
    `;
    
    // Generate code for each curve segment
    for (let i = 0; i < this.polycurves.length; i++) {
      const curve = this.polycurves[i];
      
      code += `
      // Segment ${i + 1}
      va = vb;
      `;
      
      if (curve.type === "line") {
        code += `
      vb = vec2(${curve.end.x.toFixed(16)}, ${curve.end.y.toFixed(16)});
      ds = sdSqLine(p2d, va, vb);
        `;
      } else if (curve.type === "arc") {
        code += `
      vb = vec2(${curve.end.x.toFixed(16)}, ${curve.end.y.toFixed(16)});
      ds = sdSqArc(p2d, va, vb, ${curve.radius.toFixed(16)}, d);
        `;
      }
      
      code += `
      // in/out test
      if (va.y <= p2d.y && p2d.y < vb.y) {
        // Crossing upward
        if (ds.y > 0.0) s *= -1.0;
      } else if (vb.y <= p2d.y && p2d.y < va.y) {
        // Crossing downward
        if (ds.y > 0.0) s *= -1.0;
      }
      
      d = min(d, ds.x);
      `;
    }
    
    code += `
      return s * sqrt(d) * 0.01;
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
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        vec2 d = pa - ba * h;
        return vec2(dot2(d), h);
      }

      // Squared distance and projection factor to an arc
      vec2 sdSqArc(vec2 p, vec2 a, vec2 b, float r, float d) {
        vec2 ba = b - a;
        vec2 pa = p - a;
        float l = length(ba);
        float h = clamp(dot(pa, ba) / (l * l), 0.0, 1.0);
        
        // Calculate center more robustly
        vec2 perp = normalize(vec2(ba.y, -ba.x));
        vec2 mid = a + ba * h;
        vec2 c = mid - perp * r;
        
        return vec2(dot2(p - c) - r * r, h);
      }

      float ${this.getFunctionName()}(vec3 p) {
        if (abs(p.z) > 2.0) {
            return 1000.0;
        }
        ${code}
      }
    `;
  }

  generateShaderCode() {
    if (this.polycurves.length === 0) {
      return this.noopShaderCode();
    }

    return `
      ${this.getFunctionName()}(p)
    `;
  }

  sdf(p) {
    // JavaScript implementation of the SDF
    if (this.polycurves.length === 0) {
      return 1000.0; // Large distance if no curves
    }
    
    // Project to 2D (assuming sketch is in XY plane)
    const p2d = new Vec2(p.x, p.y);
    
    // Starting point
    const firstPoint = this.polycurves[0].start;
    let vb = new Vec2(firstPoint.x, firstPoint.y);
    
    let d = p2d.sub(vb).lengthSq();
    let s = 1.0;
    
    for (const curve of this.polycurves) {
      const va = vb.clone();
      let ds;
      
      if (curve.type === "line") {
        vb = new Vec2(curve.end.x, curve.end.y);
        ds = this.sdSqLine(p2d, va, vb);
      } else if (curve.type === "arc") {
        vb = new Vec2(curve.end.x, curve.end.y);
        ds = this.sdSqArc(p2d, va, vb, curve.radius, d);
      }
      
      // in/out test
      if (va.y <= p2d.y && p2d.y < vb.y) {
        // Crossing upward
        if (ds.y > 0.0) s *= -1.0;
      } else if (vb.y <= p2d.y && p2d.y < va.y) {
        // Crossing downward
        if (ds.y > 0.0) s *= -1.0;
      }
      
      d = Math.min(d, ds.x);
    }
    
    return s * Math.sqrt(d);
  }
  
  // Helper functions for JavaScript implementation
  sdSqLine(p, a, b) {
    const pa = p.sub(a);
    const ba = b.sub(a);
    const h = Math.max(0, Math.min(1, pa.dot(ba) / ba.lengthSq()));
    const d = pa.sub(ba.mul(h));
    return { x: d.lengthSq(), y: h };
  }
  
  sdSqArc(p, a, b, r, d) {
    const ba = b.sub(a);
    const pa = p.sub(a);
    const l = ba.length();
    const h = Math.max(0, Math.min(1, pa.dot(ba) / (l * l)));
    
    // Calculate center more robustly
    const perp = new Vec2(ba.y, -ba.x).normalize();
    const mid = a.add(ba.mul(h));
    const c = mid.sub(perp.mul(r));
    
    return { x: p.sub(c).lengthSq() - r * r, y: h };
  }

  getIcon() {
    return "🎨";
  }
  
  getProperties() {
    return [
      // Properties for editing the sketch would go here
    ];
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

