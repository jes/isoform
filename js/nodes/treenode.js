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
    this.propertyUniforms = {}; // uniforms for the node - map uniform name to property name

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

  // override this to return the scalar properties of the node that can be edited with a grab handle
  // name => { origin: Vec3, axis: Vec3 }
  grabHandles() {
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

  // override this to return the AABB of the node
  aabb() {
    return AABB.infinite();
  }

  /// the rest of this class should not generally be overridden

  // return a map of uniform name to value
  uniforms() {
    return this.dfsUniforms();
  }

  dfsUniforms(uniforms = {}) {
    for (const [uniformName, property] of Object.entries(this.propertyUniforms)) {
      uniforms[uniformName] = this[property];
    }
    for (const child of this.children) {
      child.dfsUniforms(uniforms);
    }
    return uniforms;
  }

  uniformName(property) {
    return `u_${this.name}_${this.uniqueId}_${property}`;
  }

  // return a Peptide node for a float uniform mapped to a named property
  uniform(property) {
    const uniformName = this.uniformName(property);
    this.propertyUniforms[uniformName] = property;
    return P.var(uniformName);
  }

  // return a Peptide node for a vec3 uniform mapped to a named property
  vuniform(property) {
    const uniformName = this.uniformName(property);
    this.propertyUniforms[uniformName] = property;
    return P.vvar(uniformName);
  }

  // return a namefor a texture3d uniform
  uniformTexture3d(property) {
    const uniformName = this.uniformName(property);
    this.propertyUniforms[uniformName] = property;
    return `u_${this.name}_${this.uniqueId}_${property}`;
  }

  // set a name for this node that doesn't already exist in the document
  setUniqueName(document) {
    this.displayName = null;
    const used = document.dfsUsedNames();
    let name = this.name;
    let i = 2;
    while (used.has(name)) {
      name = `${this.name}${i}`;
      i++;
    }
    this.displayName = name;
  }

  dfsUsedNames(used = new Set()) {
    used.add(this.displayName);
    for (const child of this.children) {
      child.dfsUsedNames(used);
    }
    return used;
  }

  min(a, b){
    if (!a) return b;
    if (!b) return a;
    if (this.blendRadius > 0.0) {
      if (this.chamfer) {
        return P.chmin(a, b, this.uniform('blendRadius'));
      } else {
        return P.smin(a, b, this.uniform('blendRadius'));
      }
    }
    return P.min(a, b);
  }

  max(a, b){
    if (!a) return b;
    if (!b) return a;
    if (this.blendRadius > 0.0) {
      if (this.chamfer) {
        return P.chmax(a, b, this.uniform('blendRadius'));
      } else {
        return P.smax(a, b, this.uniform('blendRadius'));
      }
    }
    return P.max(a, b);
  }

  structmin(a, b) {
    if (!a) return b;
    if (!b) return a;
    return P.struct({
      distance: this.min(P.field(a, 'distance'), P.field(b, 'distance')),
      color: P.vcond(P.lte(P.field(a, 'distance'), P.field(b, 'distance')),
                    P.field(a, 'color'),
                    P.field(b, 'color')),
    });
  }

  structmax(a, b) {
    if (!a) return b;
    if (!b) return a;
    return P.struct({
      distance: this.max(P.field(a, 'distance'), P.field(b, 'distance')),
      color: P.vcond(P.gte(P.field(a, 'distance'), P.field(b, 'distance')),
                    P.field(a, 'color'),
                    P.field(b, 'color')),
    });
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

  // Get all properties of the node, including those not in properties()
  getAllProperties() {
    const props = {};
    
    // Add properties from properties() method
    const declaredProps = this.properties();
    for (const propName in declaredProps) {
      props[propName] = {
        type: declaredProps[propName],
        value: this[propName]
      };
    }
    
    // Add generic properties
    const genericProps = this.genericProperties();
    for (const propName in genericProps) {
      if (!props[propName]) {
        props[propName] = {
          type: genericProps[propName],
          value: this[propName]
        };
      }
    }
    
    // Add other properties that exist on the object but aren't declared
    for (const propName in this) {
      // Skip internal properties, functions, and already added properties
      if (propName.startsWith('_') || 
          typeof this[propName] === 'function' ||
          propName === 'children' ||
          propName === 'parent' ||
          propName === 'warnFunction' ||
          props[propName]) {
        continue;
      }
      
      // Determine type based on value
      let type = typeof this[propName];
      if (this[propName] instanceof Vec3) {
        type = 'vec3';
      } else if (Array.isArray(this[propName])) {
        type = 'array';
      }
      
      props[propName] = {
        type: type,
        value: this[propName]
      };
    }
    
    return props;
  }

  hasParent(node) {
    if (!this.parent) return false;
    if (this.parent == node) return true;
    return this.parent.hasParent(node);
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
      this.parent = null;
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

  // return a JavaScript function that implements the SDF
  // function(vec3) => float
  getSDF() {
    const [sdf, ssa] = this.getSDFAndSSA();
    return sdf;
  }

  // return a pair of [sdf, ssa]
  getSDFAndSSA(wantStruct = false) {
    if (this.isDisabled) {
      // ??? what else can we do?
      return (p) => 1000043.0;
    }

    let expr;
    if (wantStruct) {
      expr = this.peptide(P.vvar('p'));
    } else {
      expr = P.field(this.peptide(P.vvar('p')), 'distance');
    }
    const ssa = expr.ssa();
    const js = ssa.compileToJS();
    const uniforms = this.uniforms();
    const fn = eval(js);
    return [
      (p) => {
        const vars = {p: p, ...uniforms};
        const result = fn(vars);
        return result;
      },
      ssa
    ];
  }

  noop() {
    return null;
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

  // Serialize with support for circular references
  serialize() {
    const startTime = performance.now();
    // Create a map to track visited nodes and their IDs
    const visited = new Map();
    const nodeMap = new Map();
    
    // First pass: assign IDs to all nodes in the tree
    const assignIds = (node, path = []) => {
      if (visited.has(node)) return;
      
      visited.set(node, true);
      nodeMap.set(node, {
        id: node.uniqueId,
        path: [...path]
      });
      
      for (let i = 0; i < node.children.length; i++) {
        assignIds(node.children[i], [...path, 'children', i]);
      }
    };
    
    assignIds(this);
    
    // Second pass: create serializable object
    const serializeNode = (node) => {
      const result = {
        type: node.constructor.name,
        uniqueId: node.uniqueId,
        name: node.name,
        displayName: node.displayName,
        maxChildren: node.maxChildren,
        isDirty: node.isDirty,
        isDisabled: node.isDisabled,
        blendRadius: node.blendRadius,
        chamfer: node.chamfer,
        children: node.children.map(child => {
          // For each child, either serialize it or reference it
          if (nodeMap.get(child).path.length > nodeMap.get(node).path.length) {
            // This is a forward reference, serialize normally
            return serializeNode(child);
          } else {
            // This is a circular reference, just store the ID
            return { circularRef: child.uniqueId };
          }
        })
      };
      
      // Add all properties defined in the properties() method
      const props = node.getAllProperties();
      for (const propName in props) {
        const value = node[propName];
        if (value instanceof Vec3) {
          result[propName] = { x: value.x, y: value.y, z: value.z, isVec3: true };
        } else {
          result[propName] = value;
        }
      }
      
      return result;
    };
    
    const result = serializeNode(this);
    console.log(`Serialize took ${performance.now() - startTime} ms`);
    return result;
  }

  // Static deserialization method
  static fromSerialized(serialized) {
    // Map to store nodes by their uniqueId for resolving circular references
    const nodesById = new Map();
    
    // Function to create a node of the correct type
    const createNode = (data) => {
      // Handle circular references
      if (data.circularRef !== undefined) {
        return { isRef: true, id: data.circularRef };
      }
      
      // Create a new instance of the correct node type
      let node;
      if (typeof window[data.type] === 'function') {
        node = new window[data.type]();
      } else {
        // Fallback to TreeNode if specific type not found
        node = new TreeNode();
        console.warn(`Node type ${data.type} not found, using TreeNode instead`);
      }
      
      // Restore basic properties
      node.uniqueId = data.uniqueId;
      node.name = data.name;
      node.displayName = data.displayName;
      node.maxChildren = data.maxChildren;
      node.isDirty = data.isDirty;
      node.isDisabled = data.isDisabled;
      node.blendRadius = data.blendRadius;
      node.chamfer = data.chamfer;
      
      // Store in map for circular reference resolution
      nodesById.set(node.uniqueId, node);
      
      // Restore all other properties
      for (const propName in data) {
        if (!['type', 'uniqueId', 'name', 'displayName', 'maxChildren', 
              'isDirty', 'isDisabled', 'children', 'blendRadius', 'chamfer'].includes(propName)) {
          const value = data[propName];
          
          // Handle Vec3 properties
          if (value && value.isVec3) {
            node[propName] = new Vec3(value.x, value.y, value.z);
          } else {
            node[propName] = value;
          }
        }
      }
      
      // Process children (but don't add them yet)
      node._pendingChildren = data.children.map(childData => createNode(childData));
      
      return node;
    };
    
    // Create all nodes first
    const rootNode = createNode(serialized);
    
    // Second pass: resolve all references and add children
    const resolveReferences = (node) => {
      if (node._pendingChildren) {
        for (let i = 0; i < node._pendingChildren.length; i++) {
          let child = node._pendingChildren[i];
          
          // Resolve circular reference
          if (child.isRef) {
            child = nodesById.get(child.id);
          } else {
            resolveReferences(child);
          }
          
          // Add child to parent
          node.addChild(child);
        }
        
        // Clean up temporary property
        delete node._pendingChildren;
      }
    };
    
    resolveReferences(rootNode);
    
    // Update the next ID to be higher than any existing ID
    TreeNode.nextId = Math.max(...Array.from(nodesById.keys())) + 1;
    
    return rootNode;
  }

  clone() {
    // Create a new node from the serialized data
    const cloned = TreeNode.fromSerialized(this.serialize());

    // find the root node
    let document = this;
    while (document.parent) {
      document = document.parent;
    }
    
    // Generate new unique IDs for all nodes in the cloned tree
    const regenerateIds = (node) => {
      // Assign a new unique ID
      node.uniqueId = TreeNode.nextId++;

      // assign a unique name
      node.setUniqueName(document);
      
      // Process all children recursively
      for (const child of node.children) {
        regenerateIds(child);
      }
    };
    
    regenerateIds(cloned);
    
    return cloned;
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
