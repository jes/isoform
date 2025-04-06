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

  satisfiesBlends(t, blends) {
    if (t.type !== 'combinator') return true;

    // get the set of possible surface ids that can come into the node
    const idsLeft = TreeRewriter.possibleSurfaceIds(t.left);
    const idsRight = TreeRewriter.possibleSurfaceIds(t.right);

    const needToHandle = new Set();

    // collect up the set of blends that we need to handle
    for (const blend of blends) {
      const id0 = blend.nodes[0].uniqueId;
      const id1 = blend.nodes[1].uniqueId;

      // we don't need to satisfy blends if one of the children doesn't exist in this subtree
      if (!idsLeft.has(id0) && !idsRight.has(id0)) continue;
      if (!idsLeft.has(id1) && !idsRight.has(id1)) continue;

      // we need to handle this blend if one child has one id and the other has the other id
      if ((idsLeft.has(id0) && idsRight.has(id1)) ||
          (idsLeft.has(id1) && idsRight.has(id0))) {
        needToHandle.add(blend);
        continue;
      }
    }

    // check that every surface combination has the same blend parameters
    let overallBlendRadius = null;
    let overallChamfer = null;
    // for each pair of surface ids
    for (const idLeft of idsLeft) {
      if (idsRight.has(idLeft)) continue;
      for (const idRight of idsRight) {
        if (idsLeft.has(idRight)) continue;
        let blendRadius = 0.0;
        let chamfer = 0.0;
        // find out the blend parameters
        for (const blend of needToHandle) {
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

    // this node looks happy
    return true;
  },

  removeHandledBlends(t, blends) {
    if (t.type !== 'combinator') return blends;

    const idsLeft = TreeRewriter.possibleSurfaceIds(t.left);
    const idsRight = TreeRewriter.possibleSurfaceIds(t.right);

    let r = blends;

    if (idsLeft.size == 1 && idsRight.size == 1) {
      r = new Set(blends);

      const idLeft = Array.from(idsLeft)[0];
      const idRight = Array.from(idsRight)[0];

      for (const blend of blends) {
        const id0 = blend.nodes[0].uniqueId;
        const id1 = blend.nodes[1].uniqueId;
        if (idLeft == id0 && idRight == id1 || idLeft == id1 && idRight == id0) {
          r.delete(blend);
        }
      }
    }

    r = TreeRewriter.removeHandledBlends(t.left, r);
    r = TreeRewriter.removeHandledBlends(t.right, r);

    return r;
  },

  // rewrite the intermediate tree using the distributivity rule to fix blend parameters
  rewriteTree(t) {
    // take the blends from the root node
    const blends = t.treeNode.blends || new Set();

    // rewrite the tree so that all blends can be satisfied
    let r = TreeRewriter._rewriteTree(t, blends);
    for (let i = 0; i < 1; i++) {
      r = TreeRewriter._rewriteTree(t, blends);
    }

    const check = (node, blends) => {
      if (!TreeRewriter.satisfiesBlends(node, blends)) {
        console.log("Blends not satisfied for node: ", node);
        console.log("Blends: ", blends);
      }
      if (node.type == 'combinator') {
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

    // now apply the blends to the rewritten tree
    TreeRewriter.applyBlends(r, blends);

    return r;
  },

  _rewriteTree(t, blends) {
    if (t.type == 'combinator') {
      // if the left child is a modifier of a combinator, and we can't satisfy our blends,
      // we need to rewrite according to:
      //   Modifier(Combinator(a,b)) => Combinator(Modifier(a),Modifier(b))
      let satisfies = TreeRewriter.satisfiesBlends(t, blends);
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
          treeNode: t.treeNode,
        };
        t.treeNode = left.treeNode;
        satisfies = TreeRewriter.satisfiesBlends(t, blends);
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
          treeNode: t.treeNode,
        };
        t.treeNode = right.treeNode;
      }

      // recurse into children
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

  applyBlends(t, blends) {
    if (t.type == 'modifier') return TreeRewriter.applyBlends(t.child, blends);
    if (t.type == 'primitive') return;
    if (t.type != 'combinator') throw new Error('Unknown node type: ' + t.type);

    // get the set of possible surface ids that can come into the node
    const idsLeft = TreeRewriter.possibleSurfaceIds(t.left);
    const idsRight = TreeRewriter.possibleSurfaceIds(t.right);

    // apply blend parameters on this node if we have a single id on each side
    if (idsLeft.size == 1 && idsRight.size == 1) {
      const idLeft = Array.from(idsLeft)[0];
      const idRight = Array.from(idsRight)[0];

      // now if there is a blend that applies to our ids, then we need to apply it
      for (const blend of blends) {
        const id0 = blend.nodes[0].uniqueId;
        const id1 = blend.nodes[1].uniqueId;

        if (idLeft == id0 && idRight == id1 || idLeft == id1 && idRight == id0) {
          t.treeNode = t.treeNode.cloneWithSameIds();
          t.treeNode.setProperty('blendRadius', blend.blendRadius);
          t.treeNode.setProperty('chamfer', blend.chamfer);
          break;
        }
      }
    }

    TreeRewriter.applyBlends(t.left, blends);
    TreeRewriter.applyBlends(t.right, blends);
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
