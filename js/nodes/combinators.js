class UnionNode extends TreeNode {
    constructor(children = [], blendRadius = 0) {
      super("Union");
      this.maxChildren = null;
      this.addChild(children);
      this.blendRadius = blendRadius;
      this.chamfer = false;
    }

    boundingSphere() {
      if (this.children.length === 0) {
        return { centre: [0, 0, 0], radius: 0 };
      }

      if (this.children.length === 1) {
        return this.children[0].boundingSphere();
      }

      // Find the center of the bounding sphere by averaging all centers
      let centerX = 0, centerY = 0, centerZ = 0;
      let maxRadius = 0;
      
      // First pass: calculate the average center
      for (const child of this.children) {
        const childSphere = child.boundingSphere();
        centerX += childSphere.centre[0];
        centerY += childSphere.centre[1];
        centerZ += childSphere.centre[2];
      }
      
      centerX /= this.children.length;
      centerY /= this.children.length;
      centerZ /= this.children.length;
      
      // Second pass: find the maximum distance from the center to any child sphere's edge
      for (const child of this.children) {
        const childSphere = child.boundingSphere();
        
        // Calculate distance from our center to the child's center
        const dx = childSphere.centre[0] - centerX;
        const dy = childSphere.centre[1] - centerY;
        const dz = childSphere.centre[2] - centerZ;
        const distanceToCenter = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // The radius needs to include the child's radius plus the distance to its center
        const totalRadius = distanceToCenter + childSphere.radius;
        
        if (totalRadius > maxRadius) {
          maxRadius = totalRadius;
        }
      }
      
      return {
        centre: [centerX, centerY, centerZ],
        radius: maxRadius
      };
    }

    getExactness() {
      return TreeNode.LOWERBOUND;
    }

    properties() {
      return {"blendRadius": "float", "chamfer": "bool"};
    }

    generateShaderCode() {
      if (this.children.length < 1) {
        this.warn("Union node needs at least one child");
        return this.noopShaderCode();
      }

      let shaderCode = this.children[0].shaderCode();
      for (let i = 1; i < this.children.length; i++) {
        const childCode = this.children[i].shaderCode();
        // Check if either operand is a noop value
        if (childCode === this.noopShaderCode()) {
          continue; // Skip this child
        } else if (shaderCode === this.noopShaderCode()) {
          shaderCode = childCode;
          continue;
        }
        
        if (this.blendRadius > 0) {
          if (this.chamfer) {
            shaderCode = `chmin(${shaderCode}, ${childCode}, ${this.blendRadius.toFixed(16)})`;
          } else {
            shaderCode = `smin(${shaderCode}, ${childCode}, ${this.blendRadius.toFixed(16)})`;
          }
        } else {
          shaderCode = `min(${shaderCode}, ${childCode})`;
        }
      }
      return shaderCode;
    }

    opUnion(d1, d2) {
      return min(d1, d2);
    }

    opSmoothUnion(d1, d2, k) {
      const h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
      return mix(d2, d1, h) - k * h * (1.0 - h);
    }

    sdf(p) {
      if (this.children.length < 1) {
        this.warn("Union node needs at least one child");
        return this.noopSDF();
      }

      let d = this.children[0].sdf(p);
      for (let i = 1; i < this.children.length; i++) {
        if (this.children[i].sdf === this.noopSDF) {
          continue;
        }
        const d1 = this.children[i].sdf(p);
        if (this.blendRadius > 0) {
          d = this.opSmoothUnion(d, d1, this.blendRadius);
        } else {
          d = this.opUnion(d, d1);
        }
      }

      return d;
    }

    getIcon() {
      return "🔀";
    }
  }

class IntersectionNode extends TreeNode {
  constructor(children = [], blendRadius = 0) {
    super("Intersection");
    this.maxChildren = null;
    this.addChild(children);
    this.blendRadius = blendRadius;
    this.chamfer = false;
  }

  getExactness() {
    return TreeNode.LOWERBOUND;
  }

  properties() {
    return {"blendRadius": "float", "chamfer": "bool"};
  }

  generateShaderCode() {
    if (this.children.length < 1) {
      this.warn("Intersection node needs at least one child");
      return this.noopShaderCode();
    }

    let shaderCode = this.children[0].shaderCode();
    if (shaderCode === this.noopShaderCode()) {
      return this.noopShaderCode(); // If first child is noop, result is noop
    }
 
    for (let i = 1; i < this.children.length; i++) {
      const childCode = this.children[i].shaderCode();
      // Check if either operand is a noop value
      if (shaderCode === this.noopShaderCode()) {
        return this.noopShaderCode(); // For intersection, if any is noop, result is noop
      } else if (childCode === this.noopShaderCode()) {
        continue; // Skip this child
      }
      
      if (this.blendRadius > 0) {
        if (this.chamfer) {
          shaderCode = `chmax(${shaderCode}, ${childCode}, ${this.blendRadius.toFixed(16)})`;
        } else {
          shaderCode = `smax(${shaderCode}, ${childCode}, ${this.blendRadius.toFixed(16)})`;
        }
      } else {
        shaderCode = `max(${shaderCode}, ${childCode})`;
      }
    }
    return shaderCode;
  }

  opIntersection(d1, d2) {
    return max(d1, d2);
  }

  opSmoothIntersection(d1, d2, k) {
    const h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) + k * h * (1.0 - h);
  }

  sdf(p) {
    if (this.children.length < 1) {
      this.warn("Intersection node needs at least one child");
      return this.noopSDF();
    }

    if (this.children[0].sdf === this.noopSDF) {
      return this.noopSDF();
    }

    let d = this.children[0].sdf(p);
    for (let i = 1; i < this.children.length; i++) {
      if (this.children[i].sdf === this.noopSDF) {
        continue;
      }
      const d1 = this.children[i].sdf(p);
      if (this.blendRadius > 0) {
        d = this.opSmoothIntersection(d, d1, this.blendRadius);
      } else {
        d = this.opIntersection(d, d1);
      }
    }

    return d;
  }

  getIcon() {
    return "🔄";
  }

  boundingSphere() {
    if (this.children.length === 0) {
      return { centre: [0, 0, 0], radius: 0 };
    }

    // For intersection, we can return the smallest bounding sphere that contains
    // the intersection of all child bounding spheres.
    // However, this is a complex calculation, and a conservative approach is to
    // return the smallest of the child bounding spheres, as the intersection
    // cannot be larger than any of its components.
    
    let smallestRadius = Infinity;
    let smallestSphereIndex = -1;
    
    // Find the child with the smallest bounding sphere
    for (let i = 0; i < this.children.length; i++) {
      const childSphere = this.children[i].boundingSphere();
      if (childSphere.radius < smallestRadius) {
        smallestRadius = childSphere.radius;
        smallestSphereIndex = i;
      }
    }
    
    // If we found a valid child, return its bounding sphere
    if (smallestSphereIndex >= 0) {
      return this.children[smallestSphereIndex].boundingSphere();
    }
    
    // Fallback (should not happen if we have children)
    return { centre: [0, 0, 0], radius: 0 };
  }
}

class SubtractionNode extends TreeNode {
  constructor(children = [], blendRadius = 0) {
    super("Subtraction");
    this.maxChildren = null;
    this.addChild(children);
    this.blendRadius = blendRadius;
    this.chamfer = false;
  }

  getExactness() {
    return TreeNode.LOWERBOUND;
  }

  properties() {
    return {"blendRadius": "float", "chamfer": "bool"};
  }

  generateShaderImplementation() {
    return `
      float opSubtraction(float d1, float d2) { return max(d1, -d2); }
      float opSmoothSubtraction(float d1, float d2, float k) {
        float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
        return mix(d1, -d2, h) + k * h * (1.0 - h);
      }
    `;
  }

  generateShaderCode() {
    if (this.children.length < 1) {
      this.warn("Subtraction node needs at least one child");
      return this.noopShaderCode();
    }

    let shaderCode = this.children[0].shaderCode();
    if (shaderCode === this.noopShaderCode()) {
      return this.noopShaderCode(); // If first child is noop, result is noop
    }
    
    for (let i = 1; i < this.children.length; i++) {
      const childCode = this.children[i].shaderCode();
      // Check if subtrahend is a noop value
      if (childCode === this.noopShaderCode()) {
        continue; // Skip this child
      }
      
      if (this.blendRadius > 0) {
        if (this.chamfer) {
          shaderCode = `chmax(${shaderCode}, -(${childCode}), ${this.blendRadius.toFixed(16)})`;
        } else {
          shaderCode = `smax(${shaderCode}, -(${childCode}), ${this.blendRadius.toFixed(16)})`;
        }
      } else {
        shaderCode = `max(${shaderCode}, -(${childCode}))`;
      }
    }
    return shaderCode;
  }

  opSubtraction(d1, d2) {
    return max(d1, -d2);
  }

  opSmoothSubtraction(d1, d2, k) {
    const h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d1, -d2, h) + k * h * (1.0 - h);
  }

  sdf(p) {
    if (this.children.length < 1) {
      this.warn("Subtraction node needs at least one child");
      return this.noopSDF();
    }

    if (this.children[0].sdf === this.noopSDF) {
      return this.noopSDF();
    }

    let d = this.children[0].sdf(p);
    for (let i = 1; i < this.children.length; i++) {
      if (this.children[i].sdf === this.noopSDF) {
        continue;
      }
      const d1 = this.children[i].sdf(p);
      if (this.blendRadius > 0) {
        d = this.opSmoothSubtraction(d, d1, this.blendRadius);
      } else {
        d = this.opSubtraction(d, d1);
      }
    }

    return d;
  }

  getIcon() {
    return "➖";
  }

  boundingSphere() {
    if (this.children.length === 0) {
      return { centre: [0, 0, 0], radius: 0 };
    }

    // For subtraction, the result cannot be larger than the first shape
    // (the one we're subtracting from), so we can simply return its bounding sphere
    return this.children[0].boundingSphere();
  }
}


// Detect environment and export accordingly
(function() {
  const nodes = { UnionNode, IntersectionNode, SubtractionNode };
  
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
