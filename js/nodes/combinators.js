class UnionNode extends TreeNode {
    constructor(children = [], blendRadius = 0) {
      super("Union");
      this.maxChildren = null;
      this.addChild(children);
      this.blendRadius = blendRadius;
      this.chamfer = false;
    }

    properties() {
      return {"blendRadius": "float", "chamfer": "bool"};
    }

    makePeptide(p) {
      if (this.children.length === 0) {
        return this.noop();
      }

      let min = this.children[0].peptide(p);
      for (let i = 1; i < this.children.length; i++) {
        if (this.children[i].isDisabled)
          continue;
        min = this.min(min, this.children[i].peptide(p));
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

  properties() {
    return {"blendRadius": "float", "chamfer": "bool"};
  }

  makePeptide(p) {
    if (this.children.length === 0) {
      return this.noop();
    }

    let max = this.children[0].peptide(p);
    for (let i = 1; i < this.children.length; i++) {
      if (this.children[i].isDisabled)
        continue;
      max = this.max(max, this.children[i].peptide(p));
    }
    return max;
  }

  getIcon() {
    return "🔄";
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

  properties() {
    return {"blendRadius": "float", "chamfer": "bool"};
  }
  
  makePeptide(p) {
    if (this.children.length === 0) {
      return this.noop();
    }

    let max = this.children[0].peptide(p);
    for (let i = 1; i < this.children.length; i++) {
      if (this.children[i].isDisabled)
        continue;
      max = this.max(max, P.sub(P.const(0), this.children[i].peptide(p)));
    }
    return max;
  }

  getIcon() {
    return "➖";
  }
}

class InterpolateNode extends TreeNode {
  constructor(children = []) {
    super("Interpolate");
    this.maxChildren = 2;
    this.k = 0.5;
    this.addChild(children);
  }

  properties() {
    return {"k": "float"};
  }

  makePeptide(p) {
    if (this.children.length === 0) {
      return this.noop();
    }

    if (this.children.length === 1) {
      return this.children[0].peptide(p);
    }

    return P.add(P.mul(P.const(1 - this.k), this.children[0].peptide(p)),
                 P.mul(P.const(this.k), this.children[1].peptide(p)));
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { UnionNode, IntersectionNode, SubtractionNode, InterpolateNode };
  
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
