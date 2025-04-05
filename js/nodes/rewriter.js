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
    t.treeNode.markDirty();
    return t.treeNode;
  },

  // rewrite the intermediate tree to fix blend parameters
  rewriteTree(t) {
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
