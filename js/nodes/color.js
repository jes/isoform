class ColorNode extends TreeNode {
  constructor() {
    super("Color");
    this.color = new Vec3(1, 0, 0);
    this.maxChildren = 1;
  }

  properties() {
    return {"color": "vec3"};
  }

  makePeptide(p) {
    const child = this.children[0].peptide(p);
    if (!child) return null;
    return P.struct({
      distance: P.field(child, 'distance'),
      color: this.vuniform('color'),
      uniqueId: P.field(child, 'uniqueId'),
    });
  }
}

class PolkaDotNode extends TreeNode {
  constructor() {
    super("PolkaDot");
    this.background = new Vec3(1, 0, 0);
    this.foreground = new Vec3(0, 0, 0);
    this.radius = 0.5;
    this.spacing = 1.5;
    this.maxChildren = 1;
  }

  properties() {
    return {"background": "vec3", "foreground": "vec3", "radius": "float", "spacing": "float"};
  }
  
  grabHandles() {
    return {
      "radius": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 0, 0) },
      "spacing": { origin: new Vec3(0, 0, 0), axis: new Vec3(0, 1, 0) },
    };
  }

  makePeptide(p) {
    const child = this.children[0].peptide(p);
    if (!child) return null;

    // Calculate the position within the repeating grid
    const spacing = this.uniform('spacing');
    const modPos = P.vmod(p, spacing);
    
    // Center the pattern by offsetting by half the spacing
    const halfSpacing = P.div(spacing, P.const(2.0));
    const centeredPos = P.vsub(modPos, P.vec3(halfSpacing, halfSpacing, halfSpacing));
    
    // Calculate distance from center of the current cell
    const distFromCenter = P.vlength(centeredPos);
    
    // Check if the point is inside the sphere
    const radius = this.uniform('radius');
    const isInside = P.lte(distFromCenter, radius);
    
    // Choose color based on whether point is inside sphere
    const color = P.vcond(isInside, this.vuniform('foreground'), this.vuniform('background'));

    return P.struct({
      distance: P.field(child, 'distance'),
      color: color,
      uniqueId: P.field(child, 'uniqueId'),
    });
  }
}

// Detect environment and export accordingly
(function() {
    const nodes = { ColorNode, PolkaDotNode };
    
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
  