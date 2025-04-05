class UnionNode extends TreeNode {
  constructor(children = []) {
    super("Union");
    this.maxChildren = null;
    this.isCombinator = true;
    this.addChild(children);
  }

  properties() {
    return {"blendRadius": "float", "chamfer": "float"};
  }

  makePeptide(p) {
    if (this.children.length !== 2) {
      throw new Error("UnionNode must have exactly 2 children after normalisation");
    }

    return this.structmin(this.children[0].peptide(p), this.children[1].peptide(p));
  }

  makeNormalised() {
    if (this.children.length === 0) return null;
    if (this.children.length === 1) return this.children[0].normalised();

    // Make a copy of the children array to prevent modification during iteration
    const childrenCopy = [...this.children];
    let tree = null;

    for (let i = 0; i < childrenCopy.length; i++) {
      let child = childrenCopy[i].normalised();
      if (!child) continue;
      if (!tree) {
        tree = child;
      } else {
        tree = new UnionNode([tree, child]);
        tree.blendRadius = this.blendRadius;
        tree.chamfer = this.chamfer;
      }
    }
    tree.blends = this.blends;

    return tree;
  }

  getIcon() {
    return "🔀";
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }
    let aabb = this.children[0].aabb();
    for (let i = 1; i < this.children.length; i++) {
      aabb = aabb.getUnion(this.children[i].aabb());
    }
    return aabb;
  }
}

class IntersectionNode extends TreeNode {
  constructor(children = []) {
    super("Intersection");
    this.maxChildren = null;
    this.isCombinator = true;
    this.addChild(children);
  }

  properties() {
    return {"blendRadius": "float", "chamfer": "float"};
  }

  makePeptide(p) {
    if (this.children.length !== 2) {
      throw new Error("IntersectionNode must have exactly 2 children after normalisation");
    }

    return this.structmax(this.children[0].peptide(p), this.children[1].peptide(p));
  }

  makeNormalised() {
    if (this.children.length === 0) return null;
    if (this.children.length === 1) return this.children[0].normalised();
    
    // Make a copy of the children array to prevent modification during iteration
    const childrenCopy = [...this.children];
    let tree = null;
    
    for (let i = 0; i < childrenCopy.length; i++) {
      let child = childrenCopy[i].normalised();
      if (!child) continue;
      if (!tree) {
        tree = child;
      } else {
        tree = new IntersectionNode([tree, child]);
        tree.blendRadius = this.blendRadius;
        tree.chamfer = this.chamfer;
      }
    }
    tree.blends = this.blends;
    
    return tree;
  }

  getIcon() {
    return "🔄";
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }

    let aabb = this.children[0].aabb();
    for (let i = 1; i < this.children.length; i++) {
      aabb = aabb.getIntersection(this.children[i].aabb());
    }
    return aabb;
  }
}

class SubtractionNode extends TreeNode {
  constructor(children = []) {
    super("Subtraction");
    this.maxChildren = null;
    this.isCombinator = true;
    this.addChild(children);
  }

  properties() {
    return {"blendRadius": "float", "chamfer": "float"};
  }
  
  makePeptide(p) {
    throw new Error("SubtractionNode.makePeptide not implemented (should have been normalised to Intersections of Negations)");
  }

  makeNormalised() {
    if (this.children.length === 0) return null;
    if (this.children.length === 1) return this.children[0].normalised();

    // Make a copy of the children array to prevent modification during iteration
    const childrenCopy = [...this.children];
    let tree = null;

    for (let i = 0; i < childrenCopy.length; i++) {
      let child = childrenCopy[i].normalised();
      if (!child) continue;
      if (!tree) {
        tree = child;
      } else {
        tree = new IntersectionNode([tree, new NegateNode([child])]);
        tree.blendRadius = this.blendRadius;
        tree.chamfer = this.chamfer;
      }
    }
    tree.blends = this.blends;

    return tree;
  }

  getIcon() {
    return "➖";
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }

    let aabb = this.children[0].aabb();
    for (let i = 1; i < this.children.length; i++) {
      aabb = aabb.getSubtraction(this.children[i].aabb());
    }
    return aabb;
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

    const child0 = this.children[0].peptide(p); 
    const child1 = this.children[1].peptide(p);

    if (!child0) return child1;
    if (!child1) return child0;

    const uniformK = this.uniform('k');

    const distance = P.mix(P.field(child0, 'distance'), P.field(child1, 'distance'), uniformK);

    const color = P.vmix(P.field(child0, 'color'), P.field(child1, 'color'), uniformK);

    const uniqueId = P.field(child0, 'uniqueId');

    return P.struct({distance, color, uniqueId});
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }
    if (this.children.length === 1) {
      return this.children[0].aabb();
    }
    
    const child0 = this.children[0].aabb();
    const child1 = this.children[1].aabb();

    return child0.getUnion(child1);
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
