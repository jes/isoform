const TreeRewriter = {
  rewrite(treeNode) {
    const startTime = performance.now();
    if (!treeNode) return null;

    const tNormalised = treeNode.cloneWithSameIds().normalised();
    if (!tNormalised) return null;

    const blends = TreeRewriter.collectBlends(treeNode);

    // turn the normalised tree into our intermediate representation
    const t = TreeRewriter.fromTreeNode(tNormalised);

    // then rewrite to fix blend arguments
    const tRewritten = TreeRewriter.rewriteTree(t, blends);

    // then convert back to TreeNode form
    const tNode = TreeRewriter.toTreeNode(tRewritten);

    const endTime = performance.now();
    console.log("TreeRewriter time:", endTime - startTime, "ms");

    return tNode;
  },

  // take a TreeNode and return the intermediate tree
  fromTreeNode(treeNode, modifiers = []) {
    // combinators
    if (treeNode.isCombinator) {
      if (treeNode.children.length != 2) {
        throw new Error('Combinator must have 2 children');
      }
      const t = treeNode.cloneJustThisOne();
      t.uniqueId = 0; // don't recompile shader every time we rewrite
      return {
        type: 'combinator',
        left: TreeRewriter.fromTreeNode(treeNode.children[0], []),
        right: TreeRewriter.fromTreeNode(treeNode.children[1], []),
        treeNode: t,
        modifiers: modifiers,
      };
    }

    // primitives
    if (treeNode.children.length == 0) {
      return {
        type: 'primitive',
        treeNode: treeNode.cloneJustThisOne(),
        modifiers: modifiers,
      };
    }

    // modifiers - add to modifier chain and recurse
    const node = TreeRewriter.fromTreeNode(treeNode.children[0], [...modifiers, treeNode.cloneJustThisOne()]);
    node.treeNode.blends = treeNode.blends;
    return node;
  },

  // take an intermediate tree and return a TreeNode;
  // this may edit the TreeNodes in place, we're assuming a clone was created for
  // TreeRewriter in the first place, e.g. by rewrite()
  toTreeNode(t) {
    t.treeNode = t.treeNode.cloneJustThisOne();

    if (t.type == 'combinator') {
      const left = TreeRewriter.toTreeNode(t.left);
      const right = TreeRewriter.toTreeNode(t.right);
      left.parent = t.treeNode;
      right.parent = t.treeNode;
      t.treeNode.children = [
        left,
        right,
      ];
    } else if(t.type == 'primitive') {
      // nothing
    } else {
      throw new Error('Unknown node type: ' + t.type);
    }
    // now add the modifier stack on top
    let node = t.treeNode;
    for (const modifier of [...t.modifiers].reverse()) {
      const m = modifier.cloneJustThisOne();
      m.addChild(node);
      node = m;
    }
    return node;
  },

  possibleSurfaceIds(t, set = new Set()) {
    if (t.type == 'combinator') {
      TreeRewriter.possibleSurfaceIds(t.left, set);
      TreeRewriter.possibleSurfaceIds(t.right, set);
    } else if (t.type == 'primitive') {
      set.add(t.treeNode.uniqueId);
    } else {
      throw new Error('Unknown node type: ' + t.type);
    }
    return set;
  },

  cloneIntermediateTree(t) {
    if (t.type == 'combinator') {
      return {
        type: 'combinator',
        left: TreeRewriter.cloneIntermediateTree(t.left),
        right: TreeRewriter.cloneIntermediateTree(t.right),
        treeNode: t.treeNode,
        modifiers: t.modifiers,
      };
    } else if (t.type == 'primitive') {
      return {
        type: 'primitive',
        treeNode: t.treeNode,
        modifiers: t.modifiers,
      };
    } else {
      throw new Error('Unknown node type: ' + t.type);
    }
  },

  collectBlends(t, blends = new Set()) {
    if (t.blends) {
      for (const blend of t.blends) {
        blends.add(blend);
      }
    }
    for (const child of t.children) {
      TreeRewriter.collectBlends(child, blends);
    }
    return blends;
  },

  // return the set of blends from blends for which all arguments
  // are present in the tree
  validBlends(t, blends = new Set()) {
    const ids = TreeRewriter.possibleSurfaceIds(t);

    for (const blend of blends) {
      const id0 = blend.nodes[0].uniqueId;
      const id1 = blend.nodes[1].uniqueId;
      if (ids.has(id0) && ids.has(id1)) {
        blends.add(blend);
      }
    }
    return blends;
  },

  rewriteTree(t, blends) {
    console.log("blends all:", blends);
    blends = TreeRewriter.validBlends(t, blends);
    console.log("blends valid:", blends);

    for (let i = 0; i < 10; i++) {
      let allSatisfied = true;
      for (const blend of blends) {
        if (TreeRewriter.Satisfy(t, blend)) continue;
        allSatisfied = false;
        TreeRewriter.Rewrite(t, blend);
      }
      if (allSatisfied) break;
    }

    return t;
  },

  Rewrite(t, blend) {
    if (t.type == 'primitive') return false;
    const id0 = blend.nodes[0].uniqueId;
    const id1 = blend.nodes[1].uniqueId;
    let skip = false;
    const leftHasId0 = TreeRewriter.IdIsUnder(t.left, id0);
    const leftHasId1 = TreeRewriter.IdIsUnder(t.left, id1);
    const leftHasBoth = leftHasId0 && leftHasId1;
    const rightHasId0 = TreeRewriter.IdIsUnder(t.right, id0);
    const rightHasId1 = TreeRewriter.IdIsUnder(t.right, id1);
    const rightHasBoth = rightHasId0 && rightHasId1;
    const bothHaveBoth = leftHasBoth && rightHasBoth;

    // if some id doesn't exist under our subtree, we can't rewrite
    if (!leftHasId0 && !rightHasId0) return false;
    if (!leftHasId1 && !rightHasId1) return false;

    // if both children have both ids, rewrite the one that
    // is closest to making them siblings
    if (bothHaveBoth) {
      const leftDist = TreeRewriter.DistanceBetween(t.left, id0, id1);
      const rightDist = TreeRewriter.DistanceBetween(t.right, id0, id1);
      if (leftDist < rightDist) {
        return TreeRewriter.Rewrite(t.left, blend);
      } else {
        return TreeRewriter.Rewrite(t.right, blend);
      }
    }

    // if one child has both ids, rewrite that one
    if (leftHasBoth) {
      return TreeRewriter.Rewrite(t.left, blend);
    }
    if (rightHasBoth) {
      return TreeRewriter.Rewrite(t.right, blend);
    }

    if (t.left.type == 'combinator') {
      // distribute left
      const left = t.left;
      const right = t.right;
      left.left.modifiers = [...left.modifiers, ...left.left.modifiers];
      left.right.modifiers = [...left.modifiers, ...left.right.modifiers]; 
      t.left = {
        type: 'combinator',
        left: left.left,
        right: right,
        treeNode: t.treeNode,
        modifiers: [],
      };
      t.right = {
        type: 'combinator',
        left: left.right,
        right: TreeRewriter.cloneIntermediateTree(right),
        treeNode: t.treeNode,
        modifiers: [],
      };
      t.treeNode = left.treeNode;

      if (TreeRewriter.Satisfy(t, blend)) return true;
      if (TreeRewriter.Rewrite(t.left, blend)) return true;
      if (TreeRewriter.Rewrite(t.right, blend)) return true;
    }
    if (t.right.type == 'combinator') {
      // distribute right
      const left = t.left;
      const right = t.right;
      right.left.modifiers = [...right.modifiers, ...right.left.modifiers];
      right.right.modifiers = [...right.modifiers, ...right.right.modifiers];
      t.left = {
        type: 'combinator',
        left: left,
        right: right.left,
        treeNode: t.treeNode,
        modifiers: [],
      };
      t.right = {
        type: 'combinator',
        left: TreeRewriter.cloneIntermediateTree(left),
        right: right.right,
        treeNode: t.treeNode,
        modifiers: [],
      };
      t.treeNode = right.treeNode;

      if (TreeRewriter.Satisfy(t, blend)) return true;
      if (TreeRewriter.Rewrite(t.left, blend)) return true;
      if (TreeRewriter.Rewrite(t.right, blend)) return true;
    }
    return TreeRewriter.Satisfy(t, blend);
  },

  Satisfy(t, blend) {
    if (t.type == 'primitive') return false;
    const id0 = blend.nodes[0].uniqueId;
    const id1 = blend.nodes[1].uniqueId;
    if (!TreeRewriter.IdIsUnder(t.left, id0) && !TreeRewriter.IdIsUnder(t.right, id0)) return false;
    if (!TreeRewriter.IdIsUnder(t.left, id1) && !TreeRewriter.IdIsUnder(t.right, id1)) return false;
    if (TreeRewriter.Satisfy(t.left, blend) || TreeRewriter.Satisfy(t.right, blend)) return true;
    if (t.left.type == 'primitive' && t.right.type == 'primitive') {
      const idLeft = t.left.treeNode.uniqueId;
      const idRight = t.right.treeNode.uniqueId;
      if ((idLeft == id0 && idRight == id1) || (idLeft == id1 && idRight == id0)) {
        t.treeNode = t.treeNode.cloneJustThisOne();
        t.treeNode.blendRadius = blend.blendRadius;
        t.treeNode.chamfer = blend.chamfer;
        t.treeNode.uniqueId = blend.uniqueId;
        return true;
      }
    }
    // TODO: if all possible surface pairs want the same params globally, assign here and
    // return true: and at that point do we even need to iterate over the blends? can we just
    // do a pass with all blends?
    return false;
  },

  IdIsUnder(t, id) {
    if (t == undefined) throw new Error('IdIsUnder: t is undefined');
    const ids = TreeRewriter.possibleSurfaceIds(t);
    return ids.has(id);
  },

  DistanceTo(t, id) {
    if (t.type == 'combinator') {
      const leftDist = TreeRewriter.DistanceTo(t.left, id);
      const rightDist = TreeRewriter.DistanceTo(t.right, id);
      return Math.min(leftDist, rightDist);
    } else if (t.type == 'primitive') {
      return t.treeNode.uniqueId == id ? 0 : Infinity;
    } else {
      throw new Error('Unknown node type: ' + t.type);
    }
  },

  DistanceBetween(t, id0, id1) {
    if (t.type == 'combinator') {
      const distLeft = TreeRewriter.DistanceBetween(t.left, id0, id1);
      const distRight = TreeRewriter.DistanceBetween(t.right, id0, id1);
      const distMe = TreeRewriter.DistanceTo(t, id0) + TreeRewriter.DistanceTo(t, id1);
      return Math.min(distLeft, distRight, distMe);
    } else if (t.type == 'primitive') {
      return t.treeNode.uniqueId == id0 ? 0 : t.treeNode.uniqueId == id1 ? 1 : Infinity;
    } else {
      throw new Error('Unknown node type: ' + t.type);
    }
  },
};

// Detect environment and export accordingly
(function() {
  const nodes = { TreeRewriter };
  
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
