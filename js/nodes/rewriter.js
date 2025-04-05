const TreeRewriter = {
  rewrite(treeNode) {
    // turn the normalised tree into our intermediate representation
    const t = TreeRewriter.fromTreeNode(treeNode.cloneWithSameIds().normalised());

    // then rewrite to fix blend parameters
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

  satisfiesBlends(t, blends) {
    if (t.type != 'combinator') return true;

    // get the set of possible surface ids that can come into the node
    const idsLeft = t.left.treeNode.possibleSurfaceIds();
    const idsRight = t.right.treeNode.possibleSurfaceIds();

    // now check that each blend that affects one chil
    for (const blend of blends) {
      if (idsLeft.has(blend.nodes[0].uniqueId) && !idsRight.has(blend.nodes[1].uniqueId)) return false;
      if (idsLeft.has(blend.nodes[1].uniqueId) && !idsRight.has(blend.nodes[0].uniqueId)) return false;
    }

    return true;
  },

  // rewrite the intermediate tree using the distributivity rule to fix blend parameters
  rewriteTree(t) {
    // only the root node contains the blends list, so we need to pass it down
    return TreeRewriter._rewriteTree(t, t.treeNode.blends);
  },

  _rewriteTree(t, blends) {
    if (t.type == 'combinator') {
      t.left = TreeRewriter.rewriteTree(t.left);
      if (t.left.type == 'combinator' && !TreeRewriter.satisfiesBlends(t.left, blends)) {
        const left = t.left;
        t.left = {
          type: 'combinator',
          left: left.left,
          right: t.right,
          treeNode: t.treeNode,
        };
        t.right = {
          type: 'combinator',
          left: left.right,
          right: t.right,
          treeNode: t.treeNode.clone(),
        };
        t.treeNode = left.treeNode;
      }

      t.right = TreeRewriter.rewriteTree(t.right);
      if (t.right.type == 'combinator' && !TreeRewriter.satisfiesBlends(t.right, blends)) {
        const right = t.right;
        t.left = {
          type: 'combinator',
          left: t.left,
          right: right.left,
          treeNode: t.treeNode,
        };
        t.right = {
          type: 'combinator',
          left: t.left,
          right: right.right,
          treeNode: t.treeNode.clone(),
        };
        t.treeNode = right.treeNode;
      }
    } else if (t.type == 'modifier') {
      t.child = TreeRewriter.rewriteTree(t.child);
    } else if (t.type == 'primitive') {
      // nothing
    } else {
      throw new Error('Unknown node type: ' + t.type);
    }
    return t;
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
