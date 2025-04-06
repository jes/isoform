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
    if (t.type == 'modifier') return TreeRewriter.satisfiesBlends(t.child, blends);
    if (t.type == 'primitive') return true;
    if (t.type !== 'combinator') throw new Error('Unknown node type: ' + t.type);

    // get the set of possible surface ids that can come into the node
    const idsLeft = TreeRewriter.possibleSurfaceIds(t.left);
    const idsRight = TreeRewriter.possibleSurfaceIds(t.right);

    // now check that we have both arguments for any blend that affects either child
    for (const blend of blends) {
      const id0 = blend.nodes[0].uniqueId;
      const id1 = blend.nodes[1].uniqueId;

      // we can handle this blend if one child has one id and the other has the other id
      if (idsLeft.has(id0) && idsLeft.size == 1 && idsRight.has(id1) && idsRight.size == 1) continue;
      if (idsLeft.has(id1) && idsLeft.size == 1 && idsRight.has(id0) && idsRight.size == 1) continue;

      // if one child has both ids, then we know the blend is satisfied deeper
      if (idsLeft.has(id0) && idsLeft.has(id1)) continue;
      if (idsRight.has(id0) && idsRight.has(id1)) continue;

      // otherwise, we can't satisfy our blends if we see an id coming out of one child and the
      // other id not coming out of the same child, but more than one id coming out of
      // either child
      if (idsLeft.has(id0) && (idsLeft.size > 1 || idsRight.size > 1)) return false;
      if (idsLeft.has(id1) && (idsLeft.size > 1 || idsRight.size > 1)) return false;
      if (idsRight.has(id0) && (idsRight.size > 1 || idsLeft.size > 1)) return false;
      if (idsRight.has(id1) && (idsRight.size > 1 || idsLeft.size > 1)) return false;
    }

    // this node looks happy, see if all children are happy
    return TreeRewriter.satisfiesBlends(t.left, blends) && TreeRewriter.satisfiesBlends(t.right, blends);
  },

  // rewrite the intermediate tree using the distributivity rule to fix blend parameters
  rewriteTree(t) {
    const blends = t.treeNode.blends;
    // only the root node contains the blends list, so we need to pass it down
    const r = TreeRewriter._rewriteTree(t, blends);

    // now apply the blends to the rewritten tree
    TreeRewriter.applyBlends(r, blends);

    return r;
  },

  _rewriteTree(t, blends) {
    if (t.type == 'combinator') {
      t.left = TreeRewriter._rewriteTree(t.left, blends);
      // if the left child is a modifier of a combinator, and we can't satisfy our blends,
      // we need to rewrite according to:
      //   Modifier(Combinator(a,b)) == Combinator(Modifier(a),Modifier(b))
      if (t.left.type == 'modifier' && t.left.child.type == 'combinator' && !TreeRewriter.satisfiesBlends(t, blends)) {
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

      // if we can't satisfy our blends, we need to rewrite
      if (t.left.type == 'combinator' && !TreeRewriter.satisfiesBlends(t, blends)) {
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
          right: right,
          treeNode: t.treeNode,
        };
        t.treeNode = left.treeNode;
      }

      t.right = TreeRewriter._rewriteTree(t.right, blends);
      if (t.right.type == 'modifier' && t.right.child.type == 'combinator' && !TreeRewriter.satisfiesBlends(t, blends)) {
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

      if (t.right.type == 'combinator' && !TreeRewriter.satisfiesBlends(t, blends)) {
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
          left: left,
          right: right.right,
          treeNode: t.treeNode,
        };
        t.treeNode = right.treeNode;
      }
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
