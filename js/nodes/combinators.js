class UnionNode extends TreeNode {
    constructor(children = [], blendRadius = 0) {
      super("Union");
      this.maxChildren = null;
      this.addChild(children);
      this.blendRadius = blendRadius;
      this.chamfer = false;
    }

    boundingSphere() {
      if (this.children.length === 0) {
        return { centre: new Vec3(0, 0, 0), radius: 0 };
      }

      if (this.children.length === 1) {
        return this.children[0].boundingSphere();
      }

      // Find the center of the bounding sphere by averaging all centers
      let center = new Vec3(0, 0, 0);
      let maxRadius = 0;
      
      // First pass: calculate the average center
      for (const child of this.children) {
        const childSphere = child.boundingSphere();
        center = center.add(childSphere.centre);
      }
      
      center = center.div(this.children.length);
      
      // Second pass: find the maximum distance from the center to any child sphere's edge
      for (const child of this.children) {
        const childSphere = child.boundingSphere();
        
        // Calculate distance from our center to the child's center
        const distanceToCenter = center.distanceTo(childSphere.centre);
        
        // The radius needs to include the child's radius plus the distance to its center
        const totalRadius = distanceToCenter + childSphere.radius;
        
        if (totalRadius > maxRadius) {
          maxRadius = totalRadius;
        }
      }
      
      return {
        centre: center,
        radius: maxRadius
      };
    }

    getExactness() {
      return TreeNode.LOWERBOUND;
    }

    properties() {
      return {"blendRadius": "float", "chamfer": "bool"};
    }

    peptide(p) {
      if (this.children.length === 0) {
        return this.noop();
      }

      let minFn = (a, b) => P.min(a, b);
      if (this.blendRadius > 0) {
        if (this.chamfer) {
          minFn = (a, b) => P.chmin(a, b, P.const(this.blendRadius));
        } else {
          minFn = (a, b) => P.smin(a, b, P.const(this.blendRadius));
        }
      }

      let min = this.children[0].peptide(p);
      for (let i = 1; i < this.children.length; i++) {
        min = minFn(min, this.children[i].peptide(p));
      }
      return min;
    }

    getIcon() {
      return "🔀";
    }
  }

class IntersectionNode extends TreeNode {
  constructor(children = [], blendRadius = 0) {
    super("Intersection");
    this.maxChildren = null;
    this.addChild(children);
    this.blendRadius = blendRadius;
    this.chamfer = false;
  }

  getExactness() {
    return TreeNode.LOWERBOUND;
  }

  properties() {
    return {"blendRadius": "float", "chamfer": "bool"};
  }

  peptide(p) {
    if (this.children.length === 0) {
      return this.noop();
    }

    let maxFn = (a, b) => P.max(a, b);
    if (this.blendRadius > 0) {
      if (this.chamfer) {
        maxFn = (a, b) => P.chmax(a, b, P.const(this.blendRadius));
      } else {
        maxFn = (a, b) => P.smax(a, b, P.const(this.blendRadius));
      }
    }

    let max = this.children[0].peptide(p);
    for (let i = 1; i < this.children.length; i++) {
      max = maxFn(max, this.children[i].peptide(p));
    }
    return max;
  }

  getIcon() {
    return "🔄";
  }

  boundingSphere() {
    if (this.children.length === 0) {
      return { centre: new Vec3(0, 0, 0), radius: 0 };
    }

    // For intersection, we can return the smallest bounding sphere that contains
    // the intersection of all child bounding spheres.
    // However, this is a complex calculation, and a conservative approach is to
    // return the smallest of the child bounding spheres, as the intersection
    // cannot be larger than any of its components.
    
    let smallestRadius = Infinity;
    let smallestSphereIndex = -1;
    
    // Find the child with the smallest bounding sphere
    for (let i = 0; i < this.children.length; i++) {
      const childSphere = this.children[i].boundingSphere();
      if (childSphere.radius < smallestRadius) {
        smallestRadius = childSphere.radius;
        smallestSphereIndex = i;
      }
    }
    
    // If we found a valid child, return its bounding sphere
    if (smallestSphereIndex >= 0) {
      return this.children[smallestSphereIndex].boundingSphere();
    }
    
    // Fallback (should not happen if we have children)
    return { centre: new Vec3(0, 0, 0), radius: 0 };
  }
}

class SubtractionNode extends TreeNode {
  constructor(children = [], blendRadius = 0) {
    super("Subtraction");
    this.maxChildren = null;
    this.addChild(children);
    this.blendRadius = blendRadius;
    this.chamfer = false;
  }

  getExactness() {
    return TreeNode.LOWERBOUND;
  }

  properties() {
    return {"blendRadius": "float", "chamfer": "bool"};
  }
  
  peptide(p) {
    if (this.children.length === 0) {
      return this.noop();
    }

    let maxFn = (a, b) => P.max(a, b);
    if (this.blendRadius > 0) {
      if (this.chamfer) {
        maxFn = (a, b) => P.chmax(a, b, P.const(this.blendRadius));
      } else {
        maxFn = (a, b) => P.smax(a, b, P.const(this.blendRadius));
      }
    }

    let max = this.children[0].peptide(p);
    for (let i = 1; i < this.children.length; i++) {
      max = maxFn(max, P.sub(P.const(0), this.children[i].peptide(p)));
    }
    return max;
  }

  getIcon() {
    return "➖";
  }

  boundingSphere() {
    if (this.children.length === 0) {
      return { centre: new Vec3(0, 0, 0), radius: 0 };
    }

    // For subtraction, the result cannot be larger than the first shape
    // (the one we're subtracting from), so we can simply return its bounding sphere
    return this.children[0].boundingSphere();
  }
}


// Detect environment and export accordingly
(function() {
  const nodes = { UnionNode, IntersectionNode, SubtractionNode };
  
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
