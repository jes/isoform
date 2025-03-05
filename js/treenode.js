class TreeNode {
  // Static counter for unique IDs
  static nextId = 1;

  constructor(name = "Node") {
    this.name = name;
    this.children = [];
    this.parent = null;
    this.maxChildren = 0;
    this.warnFunction = null;
    this.isDirty = true;
    this.signature = "";
    this.uniqueId = TreeNode.nextId++;
    this.displayName = `${this.name}${this.uniqueId}`;
  }

  // "dirty" means the shader needs to be recompiled
  dirty() {
    return this.isDirty;
  }
  markDirty() {
    this.isDirty = true;
    this.parent?.markDirty();
  }
  markClean() {
    this.isDirty = false;
    this.children.forEach(child => child.markClean());
  }

  properties() {
    return {};
  }

  genericProperties() {
    return {"displayName": "string"};
  }

  setProperty(name, value) {
    this[name] = value;
    this.markDirty();
  }

  getProperty(name) {
    return this[name];
  }

  addChild(node) {
    // Handle array of nodes
    if (Array.isArray(node)) {
      const addedNodes = [];
      for (const childNode of node) {
        addedNodes.push(this.addChild(childNode));
      }
      return addedNodes;
    }
    
    if (!(node instanceof TreeNode)) {
      throw new Error("Child must be a TreeNode instance");
    }
    
    if (!this.canAddMoreChildren()) {
      const nchildren = this.children.length;
      throw new Error(`Node "${this.name}" has ${nchildren} children, max is ${this.maxChildren}`);
    }
    
    // Remove from previous parent if exists
    if (node.parent) {
      node.parent.removeChild(node);
    }
    
    this.children.push(node);
    node.parent = this;
    this.markDirty();
    return node;
  }

  removeChild(node) {
    // Handle array of nodes
    if (Array.isArray(node)) {
      const results = [];
      for (const childNode of node) {
        results.push(this.removeChild(childNode));
      }
      return results;
    }
    
    const index = this.children.indexOf(node);
    if (index !== -1) {
      this.children.splice(index, 1);
      node.parent = null;
      this.markDirty();
      return true;
    }
    return false;
  }

  delete() {
    if (this.parent) {
      this.parent.removeChild(this);
    }
  }

  getChildren() {
    return [...this.children];
  }

  hasChildren() {
    return this.children.length > 0;
  }

  shaderImplementation() {
    return "";
  }

  getFunctionName() {
    return `sd${this.name}_${this.signature}`;
  }

  allShaderImplementations() {
    // Start with an array to maintain order
    const implementations = [];
    
    // First recursively collect implementations from all children (deeper nodes)
    for (const child of this.children) {
      const childImpls = child.allShaderImplementations();
      // Add each child implementation to our array
      for (const impl of childImpls) {
        // Only add if not already in the array (avoid duplicates)
        if (!implementations.includes(impl)) {
          implementations.push(impl);
        }
      }
    }
    
    // Then add this node's implementation (if any) after the children's
    const thisImpl = this.shaderImplementation();
    if (thisImpl && !implementations.includes(thisImpl)) {
      implementations.push(thisImpl);
    }
    
    // Return the array (now ordered from bottom to top)
    return implementations;
  }

  generateShaderCode() {
    return this.noopShaderCode();
  }

  noopShaderCode() {
    return "10.0";
  }

  canAddMoreChildren() {
    if (this.maxChildren === null) return true;
    return this.children.length < this.maxChildren;
  }

  // propagate warnings up the tree
  warn(message, node = this) {
    if (this.parent) {
      this.parent.warn(message, node);
    } else if (node.warnFunction) {
      this.warnFunction(message, node);
    } else {
      console.warn(message);
    }
  }

  getIcon() {
    // Default icon for generic nodes
    return "📄";
  }
}

// Detect environment and export accordingly
(function() {
  // Check if we're in a module environment
  if (typeof exports !== 'undefined') {
    // Node.js or ES modules environment
    if (typeof module !== 'undefined' && module.exports) {
      // CommonJS (Node.js)
      module.exports = TreeNode;
    } else {
      // ES modules
      exports.default = TreeNode;
    }
  } else if (typeof window !== 'undefined') {
    // Browser environment with script tags
    window.TreeNode = TreeNode;
  }
})();
