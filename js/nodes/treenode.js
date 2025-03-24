class TreeNode {
  // Static counter for unique IDs
  static nextId = 1;

  static _secondaryNode = null; // object to do secondary for, if any
  static _showBoundingSphere = false; // whether to show the bounding sphere

  static EXACT = "exact";
  static LOWERBOUND = "lowerbound";
  static ISOSURFACE = "isosurface";

  constructor(name = "Node") {
    this.name = name; // internal node type name
    this.uniqueId = TreeNode.nextId++; // unique identifier per node
    this.displayName = `${this.name}${this.uniqueId}`; // user-visible name
    this.children = []; // child nodes
    this.parent = null; // parent node
    this.maxChildren = 0; // maximum number of children
    this.warnFunction = null; // function to call when a warning is issued
    this.isDirty = true; // whether the shader needs to be recompiled
    this.isDisabled = false; // whether the node is disabled (i.e. hidden)

    this.blendRadius = 0.0;
    this.chamfer = false;
  }

  // override this to return true if the node is 2d
  is2d() {
    return false;
  }

  // override this to return the properties of the node
  properties() {
    return {};
  }

  // override this to return the peptide expression for the node
  makePeptide(p) {
    return this.noop();
  }

  getIcon() {
    // Default icon for generic nodes
    return "📄";
  }

  /// the rest of this class should not generally be overridden

  min(a, b){
    if (this.blendRadius > 0.0) {
      if (this.chamfer) {
        return P.chmin(a, b, P.const(this.blendRadius));
      } else {
        return P.smin(a, b, P.const(this.blendRadius));
      }
    }
    return P.min(a, b);
  }

  max(a, b){
    if (this.blendRadius > 0.0) {
      if (this.chamfer) {
        return P.chmax(a, b, P.const(this.blendRadius));
      } else {
        return P.smax(a, b, P.const(this.blendRadius));
      }
    }
    return P.max(a, b);
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

  genericProperties() {
    return {"displayName": "string"};
  }

  setProperty(propName, value) {
    // Convert arrays to Vec3 objects for vec3 properties
    if (Array.isArray(value) && value.length === 3) {
        const propType = this.properties()[propName];
        if (propType === 'vec3') {
            value = new Vec3(value[0], value[1], value[2]);
        }
    }
    
    this[propName] = value;
    this.markDirty();
  }

  getProperty(propName) {
    return this[propName];
  }

  hasParent(node) {
    if (this == node) {
      return true;
    }
    return this.parent?.hasParent(node);
  }

  containsNode(node) {
    if (this == node) {
      return true;
    }
    return this.children.some(child => child.containsNode(node));
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

  peptide(p) {
    if (this.isDisabled) {
      return this.noop();
    }
    return this.makePeptide(p);
  }

  noop() {
    return P.const(10000042.0);
  }

  disable() {
    this.isDisabled = true;
    this.markDirty();
  }
  enable() {
    this.isDisabled = false;
    this.markDirty();
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

  replaceChild(oldChild, newChild) {
    // Find the index of the old child in the children array
    const index = this.children.indexOf(oldChild);
    if (index === -1) {
      throw new Error("Child node not found in parent's children");
    }
    
    // Remove the old child from its parent
    this.children.splice(index, 1);
    oldChild.parent = null;
    
    // Handle array of new children
    if (Array.isArray(newChild)) {
      // Insert all new children at the position of the old child
      for (let i = 0; i < newChild.length; i++) {
        const child = newChild[i];
        if (!(child instanceof TreeNode)) {
          throw new Error("New child must be a TreeNode instance");
        }
        
        // Remove from previous parent if exists
        if (child.parent) {
          child.parent.removeChild(child);
        }
        
        // Insert at the appropriate position
        this.children.splice(index + i, 0, child);
        child.parent = this;
      }
      this.markDirty();
      return newChild;
    } 
    // Handle single new child
    else {
      if (!(newChild instanceof TreeNode)) {
        throw new Error("New child must be a TreeNode instance");
      }
      
      // Remove from previous parent if exists
      if (newChild.parent) {
        newChild.parent.removeChild(newChild);
      }
      
      // Insert at the position of the old child
      this.children.splice(index, 0, newChild);
      newChild.parent = this;
      this.markDirty();
      return newChild;
    }
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
