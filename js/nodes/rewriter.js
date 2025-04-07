const TreeRewriter = {
  rewrite(treeNode) {
    // turn the normalised tree into our intermediate representation
    const t = TreeRewriter.fromTreeNode(treeNode.cloneWithSameIds().normalised());

    // then rewrite to fix blend arguments
    const tRewritten = TreeRewriter.rewriteTree(t);

    // then convert back to TreeNode form
    return TreeRewriter.toTreeNode(tRewritten);
  },

  // take a TreeNode and return the intermediate tree
  fromTreeNode(treeNode) {
    // combinators
    if (treeNode.isCombinator) {
      if (treeNode.children.length != 2) {
        throw new Error('Combinator must have 2 children');
      }
      return {
        type: 'combinator',
        left: TreeRewriter.fromTreeNode(treeNode.children[0]),
        right: TreeRewriter.fromTreeNode(treeNode.children[1]),
        treeNode: treeNode,
      };
    }

    // primitives
    if (treeNode.children.length == 0) {
      return {
        type: 'primitive',
        treeNode: treeNode,
      };
    }

    // modifiers - collapse a chain of modifiers into a single node
    let child = treeNode.children[0];
    while (child.children.length > 0 && !child.isCombinator) {
      child = child.children[0];
    }
    return {
      type: 'modifier',
      child: TreeRewriter.fromTreeNode(child),
      treeNode: treeNode,
    };
  },

  // take an intermediate tree and return a TreeNode;
  // this may edit the TreeNodes in place, we're assuming a clone was created for
  // TreeRewriter in the first place, e.g. by rewrite()
  toTreeNode(t) {
    if (t.type == 'combinator') {
      const left = TreeRewriter.toTreeNode(t.left);
      const right = TreeRewriter.toTreeNode(t.right);
      left.parent = t.treeNode;
      right.parent = t.treeNode;
      t.treeNode.children = [
        left,
        right,
      ];
    } else if(t.type == 'modifier') {
      // update the child of a stack of modifiers
      const child = TreeRewriter.toTreeNode(t.child);
      // find the bottom modifier of the chain
      let node = t.treeNode;
      while (node.children.length > 0 && node.children[0].children.length > 0 && !node.children[0].isCombinator) {
        node = node.children[0];
      }
      node.children = [
        child,
      ];
      child.parent = node;
    } else if(t.type == 'primitive') {
      // nothing
    } else {
      throw new Error('Unknown node type: ' + t.type);
    }
    return t.treeNode.cloneWithSameIds();
  },

  possibleSurfaceIds(t, set = new Set()) {
    if (t.type == 'combinator') {
      TreeRewriter.possibleSurfaceIds(t.left, set);
      TreeRewriter.possibleSurfaceIds(t.right, set);
    } else if (t.type == 'modifier') {
      TreeRewriter.possibleSurfaceIds(t.child, set);
    } else if (t.type == 'primitive') {
      set.add(t.treeNode.uniqueId);
    } else {
      throw new Error('Unknown node type: ' + t.type);
    }
    return set;
  },

  satisfiesBlends(t, blends, applyBlends = false) {
    if (t.type !== 'combinator') return true;

    // get the set of possible surface ids that can come into the node
    const idsLeft = TreeRewriter.possibleSurfaceIds(t.left);
    const idsRight = TreeRewriter.possibleSurfaceIds(t.right);

    // first check that all the blend arguments are present in the subtree
    for (const blend of blends) {
      const id0 = blend.nodes[0].uniqueId;
      const id1 = blend.nodes[1].uniqueId;
      if (!idsLeft.has(id0) && !idsRight.has(id0)) return false;
      if (!idsLeft.has(id1) && !idsRight.has(id1)) return false;
    }

    // check that every surface combination has the same blend parameters
    let overallBlendRadius = null;
    let overallChamfer = null;
    // for each pair of surface ids
    for (const idLeft of idsLeft) {
      // if both ids come out of this child, then the blend is applied deeper
      if (idsRight.has(idLeft)) continue;
      for (const idRight of idsRight) {
        // if both ids come out of this child, then the blend is applied deeper
        if (idsLeft.has(idRight)) continue;

        let blendRadius = 0.0;
        let chamfer = 0.0;
        // find out the blend parameters
        for (const blend of blends) {
          const id0 = blend.nodes[0].uniqueId;
          const id1 = blend.nodes[1].uniqueId;
          if ((id0 == idLeft && id1 == idRight) ||
              (id0 == idRight && id1 == idLeft)) {
            blendRadius = blend.blendRadius;
            chamfer = blend.chamfer;
            break;
          }
        }
        if (overallBlendRadius == null) {
          overallBlendRadius = blendRadius;
          overallChamfer = chamfer;
        } else if (overallBlendRadius != blendRadius || overallChamfer != chamfer) {
          // if this pair of surface ids has different blend parameters to what we think
          // we're going to use, then we can't satisfy our blends
          return false;
        }
      }
    }

    if (applyBlends && overallBlendRadius != null && overallBlendRadius != 0.0) {
      // now set the blend parameters to actually satisfy the blends
      t.treeNode = t.treeNode.cloneWithSameIds();
      t.treeNode.blendRadius = overallBlendRadius;
      t.treeNode.chamfer = overallChamfer;
    }

    // this node looks happy
    return true;
  },

  removeHandledBlends(t, blends) {
    if (t.type == 'modifier') return TreeRewriter.removeHandledBlends(t.child, blends);
    if (t.type == 'primitive') return blends;
    if (t.type !== 'combinator') throw new Error('Unknown node type: ' + t.type);

    if (blends.size == 0) return blends;

    blends = TreeRewriter.removeHandledBlends(t.left, blends);
    blends = TreeRewriter.removeHandledBlends(t.right, blends);

    // get the set of possible surface ids that can come into the node
    const idsLeft = TreeRewriter.possibleSurfaceIds(t.left);
    const idsRight = TreeRewriter.possibleSurfaceIds(t.right);

    // handle every surface combination has the same blend parameters
    let overallBlendRadius = null;
    let overallChamfer = null;

    const newBlends = new Set(blends);

    // find out the blend parameters
    for (const blend of blends) {
      const id0 = blend.nodes[0].uniqueId;
      const id1 = blend.nodes[1].uniqueId;
      if ((idsLeft.has(id0) && !idsRight.has(id0) && idsRight.has(id1) && !idsLeft.has(id1)) ||
          (idsRight.has(id0) && !idsLeft.has(id0) && idsLeft.has(id1) && !idsRight.has(id1))) {
        if (overallBlendRadius == null) {
          overallBlendRadius = blend.blendRadius;
          overallChamfer = blend.chamfer;
          newBlends.delete(blend);
        } else if (overallBlendRadius != blend.blendRadius || overallChamfer != blend.chamfer) {
          // inconsistent blend parameters, so we can't remove any blends
          return blends;
        } else {
          newBlends.delete(blend);
        }
      }
    }

    t.treeNode = t.treeNode.cloneWithSameIds();
    t.treeNode.blendRadius = overallBlendRadius;
    t.treeNode.chamfer = overallChamfer;

    return newBlends;
  },

  // rewrite the intermediate tree using the distributivity rule to fix blend parameters
  rewriteTree(t, logs = false) {
    // take the blends from the root node
    const blends = TreeRewriter.validBlends(t);

    // rewrite the tree so that all blends can be satisfied
    let r = TreeRewriter._rewriteTree(t, blends);
    for (let i = 0; i < 0; i++) {
      r = TreeRewriter._rewriteTree(r, blends);
    }

    const check = (node, blends) => {
      if (!TreeRewriter.satisfiesBlends(node, blends)) {
        console.log("Blends not satisfied for node: ", node);
        console.log("Blends: ", blends);
        throw new Error('Blends not satisfied');
      }
      if (node.type == 'combinator') {
        blends = TreeRewriter.removeHandledBlends(node, blends);
        check(node.left, TreeRewriter.removeHandledBlends(node.right, blends));
        check(node.right, TreeRewriter.removeHandledBlends(node.left, blends));
      } else if (node.type == 'modifier') {
        check(node.child, blends);
      } else if (node.type == 'primitive') {
        // nothing
      } else {
        throw new Error('Unknown node type: ' + node.type);
      }
    }
    check(r, blends);

    return r;
  },

  _rewriteTree(t, blends) {
    if (t.type == 'combinator') {
      // if the left child is a modifier of a combinator, and we can't satisfy our blends,
      // we need to rewrite according to:
      //   Modifier(Combinator(a,b)) => Combinator(Modifier(a),Modifier(b))
      let satisfies = TreeRewriter.satisfiesBlends(t, blends, true);
      if (t.left.type == 'modifier' && t.left.child.type == 'combinator' && !satisfies) {
        const modifier = t.left;
        const combinator = modifier.child;
        t.left = {
          type: 'combinator',
          left: {
            type: 'modifier',
            child: combinator.left,
            treeNode: modifier.treeNode,
          },
          right: {
            type: 'modifier',
            child: combinator.right,
            treeNode: modifier.treeNode,
          },
          treeNode: combinator.treeNode,
        };
      }

      // if we can't satisfy our blends, we need to rewrite according to:
      //   Combinator1(Combinator2(a,b), c) => Combinator2(Combinator1(a,c),Combinator1(b,c))
      if (t.left.type == 'combinator' && !satisfies) {
        const left = t.left;
        const right = t.right;
        t.left = {
          type: 'combinator',
          left: left.left,
          right: right,
          treeNode: t.treeNode,
        };
        t.right = {
          type: 'combinator',
          left: left.right,
          right: TreeRewriter.cloneIntermediateTree(right),
          treeNode: t.treeNode.cloneWithSameIds(),
        };
        t.treeNode = left.treeNode;
        satisfies = TreeRewriter.satisfiesBlends(t, blends, true);
      }

      if (t.right.type == 'modifier' && t.right.child.type == 'combinator' && !satisfies) {
        const modifier = t.right;
        const combinator = modifier.child;
        t.right = {
          type: 'combinator',
          left: {
            type: 'modifier',
            child: combinator.left,
            treeNode: modifier.treeNode,
          },
          right: {
            type: 'modifier',
            child: combinator.right,
            treeNode: modifier.treeNode,
          },
          treeNode: combinator.treeNode,
        };
      }

      if (t.right.type == 'combinator' && !satisfies) {
        const left = t.left;
        const right = t.right;
        t.left = {
          type: 'combinator',
          left: left,
          right: right.left,
          treeNode: t.treeNode,
        };
        t.right = {
          type: 'combinator',
          left: TreeRewriter.cloneIntermediateTree(left),
          right: right.right,
          treeNode: t.treeNode.cloneWithSameIds(),
        };
        t.treeNode = right.treeNode;
        satisfies = TreeRewriter.satisfiesBlends(t, blends, true);
      }

      // recurse into children
      blends = TreeRewriter.removeHandledBlends(t, blends);
      t.left = TreeRewriter._rewriteTree(t.left, TreeRewriter.removeHandledBlends(t.right, blends));
      t.right = TreeRewriter._rewriteTree(t.right, TreeRewriter.removeHandledBlends(t.left, blends));
    } else if (t.type == 'modifier') {
      t.child = TreeRewriter._rewriteTree(t.child, blends);
    } else if (t.type == 'primitive') {
      // nothing
    } else {
      throw new Error('Unknown node type: ' + t.type);
    }

    return t;
  },

  cloneIntermediateTree(t) {
    if (t.type == 'combinator') {
      return {
        type: 'combinator',
        left: TreeRewriter.cloneIntermediateTree(t.left),
        right: TreeRewriter.cloneIntermediateTree(t.right),
        treeNode: t.treeNode,
      };
    } else if (t.type == 'modifier') {
      return {
        type: 'modifier',
        child: TreeRewriter.cloneIntermediateTree(t.child),
        treeNode: t.treeNode,
      };
    } else if (t.type == 'primitive') {
      return {
        type: 'primitive',
        treeNode: t.treeNode,
      };
    } else {
      throw new Error('Unknown node type: ' + t.type);
    }
  },

  // return the set of blends from t.treeNode.blends for which all arguments
  // are present in the tree
  validBlends(t, blends = new Set()) {
    const ids = TreeRewriter.possibleSurfaceIds(t);

    if (!t.treeNode.blends) return blends;

    for (const blend of t.treeNode.blends) {
      const id0 = blend.nodes[0].uniqueId;
      const id1 = blend.nodes[1].uniqueId;
      if (ids.has(id0) && ids.has(id1)) {
        blends.add(blend);
      }
    }
    return blends;
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
