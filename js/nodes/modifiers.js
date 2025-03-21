class TransformNode extends TreeNode {
  constructor(translation = [0, 0, 0], rotationAxis = [0, 1, 0], rotationAngle = 0, children = []) {
    super("Transform");
    this.translation = translation instanceof Vec3 ? translation : new Vec3(translation[0], translation[1], translation[2]);
    this.rotationAxis = rotationAxis instanceof Vec3 ? rotationAxis : new Vec3(rotationAxis[0], rotationAxis[1], rotationAxis[2]);
    this.rotationAngle = rotationAngle; // Angle in degrees
    this.maxChildren = 1;
    this.addChild(children);
  }

  boundingSphere() {
    if (!this.hasChildren()) {
      return { centre: new Vec3(0, 0, 0), radius: 0 };
    }
    
    // Get the child's bounding sphere
    const childSphere = this.children[0].boundingSphere();
    
    // If the radius is infinite, no need to transform
    if (childSphere.radius === Infinity) {
      return childSphere;
    }
    
    // Create Vec3 for the center (already a Vec3 in the updated version)
    let center = childSphere.centre;
    
    // Apply rotation if there's a non-zero angle
    if (this.rotationAngle !== 0) {
      // Normalize the rotation axis
      const axisLength = Math.sqrt(
        this.rotationAxis[0] * this.rotationAxis[0] + 
        this.rotationAxis[1] * this.rotationAxis[1] + 
        this.rotationAxis[2] * this.rotationAxis[2]
      );
      
      const normalizedAxis = axisLength > 0 ? 
        this.rotationAxis.div(axisLength) : 
        new Vec3(0, 1, 0);
      
      // Rotate the center point
      center = center.rotateAround(normalizedAxis, this.rotationAngle * Math.PI / 180.0);
    }
    
    // Apply translation
    center = center.add(this.translation);
    
    // Return the transformed bounding sphere
    return {
      centre: center,
      radius: childSphere.radius
    };
  }

  is2d() {
    return this.children.length > 0 && this.children[0].is2d();
  }

  getExactness() {
    return TreeNode.EXACT;
  }

  properties() {
    return {
      "translation": "vec3", 
      "rotationAxis": "vec3", 
      "rotationAngle": "float"
    };
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Transform node has no child to transform");
      return this.noop();
    }
    
    let expr = P.vsub(p, P.vconst(this.translation));

    const angleRad = this.rotationAngle * Math.PI / 180.0;
    if (Math.abs(angleRad) > 0.000001) {
      const normalizedAxis = this.rotationAxis.length() > 0 ? 
        this.rotationAxis.normalize() : 
        new Vec3(0, 1, 0);
 
      // Rodrigues rotation formula
      const axis = P.vconst(normalizedAxis);
      const cosA = P.const(Math.cos(angleRad));
      const sinA = P.const(Math.sin(angleRad));
      const k = P.const(1.0 - Math.cos(angleRad));
      const a = P.vmul(P.vmul(axis, P.vdot(axis, expr)), k);
      const b = P.vmul(expr, cosA);
      const c = P.vmul(P.vcross(axis, expr), sinA);
      expr = P.vadd(P.vadd(a, b), c);
    }

    return this.children[0].peptide(expr);
  }

  getIcon() {
    return "🔄";
  }
}

class DomainDeformNode extends TreeNode {
  constructor(amplitude = 0.1, frequency = 1.0, children = []) {
    super("DomainDeform");
    this.amplitude = amplitude; // Controls the height of the roughness
    this.frequency = frequency; // Controls how dense the roughness pattern is
    this.maxChildren = 1;
    this.addChild(children);
  }

  boundingSphere() {
    const childSphere = this.children[0].boundingSphere();
    return {
      centre: childSphere.centre,
      radius: childSphere.radius + 1.5 * this.amplitude
    };
  }

  getExactness() {
    return TreeNode.ISOSURFACE;
  }

  properties() {
    return {"amplitude": "float", "frequency": "float"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("DomainDeform node has no child to transform");
      return this.noop();
    }

    const px1 = P.mul(P.sin(P.mul(P.vecY(p), P.const(this.frequency))), P.const(this.amplitude));
    const py1 = P.mul(P.sin(P.mul(P.vecZ(p), P.const(this.frequency))), P.const(this.amplitude));
    const pz1 = P.mul(P.sin(P.mul(P.vecX(p), P.const(this.frequency))), P.const(this.amplitude));

    const px2 = P.mul(P.const(0.5), P.mul(P.cos(P.mul(P.add(P.add(P.vecZ(p), P.vecY(p)), P.const(1.0)), P.const(this.frequency))), P.const(this.amplitude)));
    const py2 = P.mul(P.const(0.5), P.mul(P.cos(P.mul(P.add(P.add(P.vecX(p), P.vecZ(p)), P.const(2.42)), P.const(this.frequency))), P.const(this.amplitude)));
    const pz2 = P.mul(P.const(0.5), P.mul(P.cos(P.mul(P.add(P.add(P.vecY(p), P.vecX(p)), P.const(14.5)), P.const(this.frequency))), P.const(this.amplitude)));

    return this.children[0].peptide(P.vadd(p, P.vec3(P.add(px1, px2), P.add(py1, py2), P.add(pz1, pz2))));
  }

  getIcon() {
    return "〰️";
  }
}


class DistanceDeformNode extends TreeNode {
  constructor(amplitude = 0.1, frequency = 1.0, children = []) {
    super("DistanceDeform");
    this.amplitude = amplitude; // Controls the height of the roughness
    this.frequency = frequency; // Controls how dense the roughness pattern is
    this.maxChildren = 1;
    this.addChild(children);
  }

  boundingSphere() {
    const childSphere = this.children[0].boundingSphere();
    return {
      centre: childSphere.centre,
      radius: childSphere.radius + 1.5 * this.amplitude
    };
  }

  getExactness() {
    return TreeNode.ISOSURFACE;
  }

  properties() {
    return {"amplitude": "float", "frequency": "float"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("DistanceDeform node has no child to transform");
      return this.noop();
    }
    
    const d = this.children[0].peptide(p);

    const freq = P.const(this.frequency);
    const ampl = P.const(this.amplitude);

    const noise1X = P.sin(P.mul(P.vecX(p), freq));
    const noise1Y = P.sin(P.mul(P.vecY(p), freq));
    const noise1Z = P.sin(P.mul(P.vecZ(p), freq));
    const noise1XYZ = P.sin(P.mul(P.add(P.add(P.vecX(p), P.vecY(p)), P.vecZ(p)), P.mul(P.const(1.5), freq)));
    const noise1 = P.mul(noise1X, P.mul(noise1Y, P.mul(noise1Z, noise1XYZ)));

    const noise2X = P.sin(P.mul(P.vecX(p), P.mul(P.const(2.0), freq)));
    const noise2Y = P.sin(P.mul(P.vecY(p), P.mul(P.const(2.0), freq)));
    const noise2Z = P.sin(P.mul(P.vecZ(p), P.mul(P.const(2.0), freq)));
    const noise2 = P.mul(P.const(0.5), P.mul(noise2X, P.mul(noise2Y, noise2Z)));
    return P.add(d, P.mul(ampl, P.add(noise1, noise2)));
  }

  getIcon() {
    return "〰️";
  }
}

class ThicknessNode extends TreeNode {
  constructor(thickness = 1.0, inside = false, children = []) {
    super("Thickness");
    this.thickness = thickness;
    this.inside = inside;
    this.maxChildren = 1;
    this.addChild(children);
  }

  boundingSphere() {
    const childSphere = this.children[0].boundingSphere();
    if (this.inside) {
      return childSphere;
    } else {
      return {
        centre: childSphere.centre,
        radius: childSphere.radius + this.thickness
      };
    }
  }

  getExactness() {
    return TreeNode.EXACT;
  }

  properties() {
    return {"thickness": "float", "inside": "bool"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Thickness node has no child to transform");
      return this.noop();
    }
    
    const d = this.children[0].peptide(p);
    const negD = P.sub(P.const(0), d);
    if (this.inside) {
      return P.max(d, P.sub(negD, P.const(this.thickness)));
    } else {
      return P.max(P.sub(d, P.const(this.thickness)), negD);
    }
  }

  getIcon() {
    return this.inside ? "🔍" : "🔍";
  }
}

class ScaleNode extends TreeNode {
  constructor(k = 2.0, alongAxis = false, axis = new Vec3(0, 0, 1), children = []) {
    super("Scale");
    this.k = k;
    this.alongAxis = alongAxis;
    this.axis = axis instanceof Vec3 ? axis : new Vec3(axis[0], axis[1], axis[2]);
    this.maxChildren = 1;
    this.addChild(children);
  }

  boundingSphere() {
    const childSphere = this.children[0].boundingSphere();
    return {
      centre: childSphere.centre,
      radius: childSphere.radius * this.k
    };
  }

  is2d() {
    return this.children.length > 0 && this.children[0].is2d();
  }

  getExactness() {
    return this.alongAxis ? TreeNode.LOWERBOUND : TreeNode.EXACT;
  }

  properties() {
    return {
      "k": "float",
      "alongAxis": "bool",
      "axis": "vec3"
    };
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Scale node has no child to transform");
      return this.noop();
    }

    if (!this.alongAxis) {
      return P.mul(this.children[0].peptide(P.vdiv(p, P.const(this.k))), P.const(this.k));
    }
    
    const axis = P.vconst(this.axis.normalize());
    const projLength = P.vdot(p, axis);
    const projVec = P.vmul(axis, projLength);
    const perpVec = P.vsub(p, projVec);
    const scaledP = P.vadd(perpVec, P.vdiv(projVec, P.const(this.k)));
    if (this.k > 1.0) {
      return this.children[0].peptide(scaledP);
    } else {
      return P.mul(this.children[0].peptide(scaledP), P.const(this.k));
    }
  }

  getIcon() {
    return "⇲";
  }
}

class TwistNode extends TreeNode {
  constructor(height = 100.0, axis = new Vec3(0, 0, 1), children = []) {
    super("Twist");
    this.height = height;
    this.axis = axis instanceof Vec3 ? axis : new Vec3(axis[0], axis[1], axis[2]);
    this.maxChildren = 1;
    this.addChild(children);
  }

  boundingSphere() {
    if (!this.hasChildren()) {
      return { centre: new Vec3(0, 0, 0), radius: 0 };
    }
    
    const childSphere = this.children[0].boundingSphere();
    
    const maxDisplacement = childSphere.centre.length();
    
    return {
      centre: new Vec3(0, 0, 0),
      radius: childSphere.radius + maxDisplacement
    };
  }

  getExactness() {
    return TreeNode.ISOSURFACE;
  }

  properties() {
    return {"height": "float", "axis": "vec3"};
  }
  
  generateShaderImplementation() {
    if (!this.hasChildren()) {
      this.warn("Twist node has no child to transform");
      return '';
    }

    // Normalize the axis
    const normalizedAxis = this.axis.normalize();
    
    return `
      float ${this.getFunctionName()}(vec3 p) {
        float height = ${this.height.toFixed(16)};
        vec3 axis = ${normalizedAxis.glsl()};
        
        // Rotate point to align with axis
        mat3 toAxisSpace = rotateToAxis(axis);
        mat3 fromAxisSpace = transposeMatrix(toAxisSpace);
        
        // Transform to axis-aligned space
        vec3 q = toAxisSpace * p;
        
        // Apply twist around the z-axis (which is now aligned with our axis)
        // The twist angle is proportional to the distance along the axis
        // A smaller height value means more twisting (2π radians per 'height' units)
        ${ this.height != 0.0 ? `
          // Negative angle for right-handed rotation around Z
          float angle = (-2.0 * 3.14159265359 * q.z) / height;
          float c = cos(angle);
          float s = sin(angle);
          q = vec3(c * q.x - s * q.y, s * q.x + c * q.y, q.z);
        
          // Transform back to original space
          p = fromAxisSpace * q;
        ` : ""}
        
        return ${this.children[0].shaderCode()};
      }
    `;
  }

  generateShaderCode() {
    if (!this.hasChildren()) {
      this.warn("Twist node has no child to transform");
      return this.noopShaderCode();
    }
    
    return `${this.getFunctionName()}(p)`;
  }

  getIcon() {
    return "🔄";
  }
}

class MirrorNode extends TreeNode {
  constructor(children = []) {
    super("Mirror");
    this.maxChildren = 1;
    this.plane = "XY";
    this.allowDomainRepetition = true;
    this.naiveDomainRepetition = false;
    this.keepOriginal = true;
    this.blendRadius = 0.0;
    this.chamfer = false;
    this.addChild(children);
  }

  boundingSphere() {
    const childSphere = this.children[0].boundingSphere();
    return {
      centre: new Vec3(0, 0, 0),
      radius: childSphere.centre.length() + childSphere.radius,
    };
  }

  getExactness() {
    return TreeNode.LOWERBOUND;
  }

  properties() {
    return {"plane": ["XY", "XZ", "YZ"], "allowDomainRepetition": "bool", "naiveDomainRepetition": "bool", "keepOriginal": "bool", "blendRadius": "float", "chamfer": "bool"};
  }

  generateShaderImplementation() {
    if (!this.hasChildren()) {
      this.warn("Mirror node has no child to transform");
      return '';
    }

    let minfn = "min(d, d1)";
    if (this.blendRadius > 0.0) {
      if (this.chamfer) {
        minfn = `chmin(d, d1, ${this.blendRadius.toFixed(16)})`;
      } else {
        minfn = `smin(d, d1, ${this.blendRadius.toFixed(16)})`;
      }
    }
    const axis = this.plane === "XY" ? "z" : this.plane === "XZ" ? "y" : "x";
    let domainRepetitionOk = this.allowDomainRepetition;
    const boundingSphere = this.children[0].boundingSphere();
    const r = boundingSphere.radius + this.blendRadius;
    const c = boundingSphere.centre;
    let neg = "";
    if (this.plane == "XY") {
      if (r > Math.abs(c.z)) {
        domainRepetitionOk = false;
        if (c.z < 0.0) {
          neg = "-";
        }
      }
    } else if (this.plane == "XZ") {
      if (r > Math.abs(c.y)) {
        domainRepetitionOk = false;
        if (c.y < 0.0) {
          neg = "-";
        }
      }
    } else {
      if (r > Math.abs(c.x)) {
        domainRepetitionOk = false;
        if (c.x < 0.0) {
          neg = "-";
        }
      }
    }
    if (!this.keepOriginal) {
      return `
        float ${this.getFunctionName()}(vec3 p) {
          p.${axis} = -p.${axis};
          return ${this.children[0].shaderCode()};
        }
      `;
    } else if (domainRepetitionOk || this.naiveDomainRepetition) {
      return `
        float ${this.getFunctionName()}(vec3 p) {
          p.${axis} = ${neg}abs(p.${axis});
          return ${this.children[0].shaderCode()};
        }
      `;
    } else {
      return `
        float ${this.getFunctionName()}(vec3 p) {
          float d = ${this.children[0].shaderCode()};
          p.${axis} = -p.${axis};
          float d1 = ${this.children[0].shaderCode()};
          return ${minfn};
        }
      `;
    }
  }

  generateShaderCode() {
    return `${this.getFunctionName()}(p)`;
  }

  getIcon() {
    return "🪞";
  }
}

class LinearPatternNode extends TreeNode {
  constructor(axis = new Vec3(0, 0, 1), spacing = 100.0, copies = 2, children = []) {
    super("LinearPattern");
    this.maxChildren = 1;
    this.axis = axis instanceof Vec3 ? axis : new Vec3(axis[0], axis[1], axis[2]);
    this.spacing = spacing;
    this.copies = copies;
    this.allowDomainRepetition = true;
    this.naiveDomainRepetition = false;
    this.blendRadius = 0.0;
    this.chamfer = false;
    this.addChild(children);
  }

  getExactness() {
    return TreeNode.LOWERBOUND;
  }

  properties() {
    return {"axis": "vec3", "spacing": "float", "copies": "int", "allowDomainRepetition": "bool", "naiveDomainRepetition": "bool", "blendRadius": "float", "chamfer": "bool"};
  }

  generateShaderImplementation() {
    if (!this.hasChildren()) {
      this.warn("LinearPattern node has no child");
      return '';
    }

    // Normalize the axis
    const normalizedAxis = this.axis.normalize();

    const boundingSphere = this.children[0].boundingSphere();
    const radiusOverlaps = Math.ceil((boundingSphere.radius + this.blendRadius) / this.spacing);

    let minfn = "min(d, d1)";
    if (this.blendRadius > 0.0) {
      if (this.chamfer) {
        minfn = `chmin(d, d1, ${this.blendRadius.toFixed(16)})`;
      } else {
        minfn = `smin(d, d1, ${this.blendRadius.toFixed(16)})`;
      }
    }

    if (!this.allowDomainRepetition || (2*radiusOverlaps >= this.copies && !this.naiveDomainRepetition)) {
      // Explicit union of exactly the requested number of copies
      return `
        float ${this.getFunctionName()}(vec3 p) {
          float spacing = ${this.spacing.toFixed(16)};
          vec3 step = spacing * ${normalizedAxis.glsl()};
          float d = ${this.children[0].shaderCode()};
          for (int i = 1; i < ${this.copies}; i++) {
            p -= step;
            float d1 = ${this.children[0].shaderCode()};
            d = ${minfn};
          }
          return d;
        }
      `;
    } else if (this.spacing < 2*(boundingSphere.radius+this.blendRadius) && !this.naiveDomainRepetition) {
      // union of however many copies overlap, and domain repetition for the rest
      return `
        float ${this.getFunctionName()}(vec3 p) {
          // Rotate point to align with pattern axis
          vec3 axis = ${normalizedAxis.glsl()};
          mat3 toAxisSpace = rotateToAxis(axis);
          mat3 fromAxisSpace = transposeMatrix(toAxisSpace);
          
          // Transform to axis-aligned space
          vec3 q = fromAxisSpace * p;

          vec3 boundingCentre = fromAxisSpace * ${boundingSphere.centre.glsl()};
          float zOff = boundingCentre.z;

          // Apply modulo along the z-axis (which is now aligned with our pattern axis)
          float spacing = ${this.spacing.toFixed(16)};
          float halfSpacing = ${(this.spacing / 2.0).toFixed(16)};

          // Calculate the index of the current copy
          float idx = clamp(floor((q.z - zOff + halfSpacing) / spacing), ${radiusOverlaps.toFixed(16)}, ${(this.copies - radiusOverlaps - 1).toFixed(16)});
          
          // do a union of the number of overlapping copies
          q.z += spacing * (${radiusOverlaps.toFixed(16)} - idx);
          p = toAxisSpace * q;
          float d = ${this.children[0].shaderCode()};
          for (int i = 0; i < ${2*radiusOverlaps}; i++) {
            q.z -= spacing;
            p = toAxisSpace * q;
            float d1 = ${this.children[0].shaderCode()};
            d = ${minfn};
          }
          return d;

        }
      `;
    } else {
      // The bounding volumes do not overlap, so we can use pure domain repetition
      return `
        float ${this.getFunctionName()}(vec3 p) {
          // Rotate point to align with pattern axis
          vec3 axis = ${normalizedAxis.glsl()};
          mat3 toAxisSpace = rotateToAxis(axis);
          mat3 fromAxisSpace = transposeMatrix(toAxisSpace);
          
          // Transform to axis-aligned space
          vec3 q = fromAxisSpace * p;

          vec3 boundingCentre = fromAxisSpace * ${boundingSphere.centre.glsl()};
          float zOff = boundingCentre.z;
          
          // Apply modulo along the z-axis (which is now aligned with our pattern axis)
          float spacing = ${this.spacing.toFixed(16)};
          float halfSpacing = ${(this.spacing / 2.0).toFixed(16)};

          // Calculate the index of the current copy
          float idx = clamp(floor((q.z - zOff + halfSpacing) / spacing), 0.0, ${(this.copies - 1).toFixed(16)});
          
          // Apply modulo operation
          q.z -= idx * spacing;
          
          // Transform back to original space
          p = toAxisSpace * q;
          
          return ${this.children[0].shaderCode()};
        }
      `;
    }
  }

  generateShaderCode() {
    return `${this.getFunctionName()}(p)`;
  }

  getIcon() {
    return "🔀";
  }
}

class PolarPatternNode extends TreeNode {
  constructor(copies = 2, axis = new Vec3(0, 0, 1), angle = 360.0, children = []) {
    super("PolarPattern");
    this.maxChildren = 1;
    this.copies = copies;
    this.axis = axis instanceof Vec3 ? axis : new Vec3(axis[0], axis[1], axis[2]);
    this.angle = angle;
    this.allowDomainRepetition = true;
    this.naiveDomainRepetition = false;
    this.blendRadius = 0.0;
    this.chamfer = false;
    this.addChild(children);
  }

  getExactness() {
    return TreeNode.LOWERBOUND;
  }

  properties() {
    return {"copies": "int", "axis": "vec3", "angle": "float", "allowDomainRepetition": "bool", "naiveDomainRepetition": "bool", "blendRadius": "float", "chamfer": "bool"};
  }

  generateShaderImplementation() {
    if (!this.hasChildren()) {
      this.warn("PolarPattern node has no child to transform");
      return '';
    }

    // Normalize the axis
    const normalizedAxis = this.axis.normalize();

    // Calculate the angle to the bounding sphere center
    const boundingSphere = this.children[0].boundingSphere();
    const center = boundingSphere.centre;
    const toAxisSpace = new Mat3().rotateToAxis(normalizedAxis);
    const centerInAxisSpace = toAxisSpace.mulVec3(center);
    const centerAngle = Math.atan2(centerInAxisSpace.y, centerInAxisSpace.x);

    const r = center.length();
    const stepAngle = this.angle / this.copies * Math.PI / 180.0; // Convert to radians
    // Calculate the chord length between two consecutive copies
    const spacing = 2 * r * Math.sin(stepAngle / 2);
    const radiusOverlaps = Math.ceil((boundingSphere.radius + this.blendRadius) / spacing);

    let minfn = "min(d,d1)";
    if (this.blendRadius > 0) {
      if (this.chamfer) {
        minfn = `chmin(d,d1,${this.blendRadius.toFixed(16)})`;
      } else {
        minfn = `smin(d,d1,${this.blendRadius.toFixed(16)})`;
      }
    }

    if (!this.allowDomainRepetition || (2*radiusOverlaps >= this.copies && !this.naiveDomainRepetition)) {
      // explicit union of all copies
      return `
        float ${this.getFunctionName()}(vec3 p) {
          vec3 axis = ${normalizedAxis.glsl()};
          float totalAngle = ${(this.angle * Math.PI / 180.0).toFixed(16)}; // Convert to radians
          int copies = ${this.copies};
          
          // Rotate point to align with axis
          mat3 toAxisSpace = rotateToAxis(axis);
          mat3 fromAxisSpace = transposeMatrix(toAxisSpace);
          
          // Transform to axis-aligned space
          vec3 q = toAxisSpace * p;
          
          // Calculate the angle increment between copies
          float angleIncrement = totalAngle / float(copies);
          
          // Evaluate the first copy at the original position
          float d = ${this.children[0].shaderCode()};
          
          // Create the remaining copies by rotating around the axis
          for (int i = 1; i < ${this.copies}; i++) {
            // Calculate rotation angle for this copy
            float angle = float(i) * angleIncrement;
            
            // Apply rotation around the z-axis (which is aligned with our axis in this space)
            float c = cos(angle);
            float s = sin(angle);
            vec3 rotated = vec3(
              c * q.x - s * q.y,
              s * q.x + c * q.y,
              q.z
            );
            
            // Transform back to original space
            p = fromAxisSpace * rotated;
            
            // Union with the current copy
            float d1 = ${this.children[0].shaderCode()};
            d = ${minfn};
          }
          
          return d;
        }
    `;
    } else if (spacing < 2*(boundingSphere.radius+this.blendRadius) && !this.naiveDomainRepetition) {
      // union of however many copies overlap, and domain repetition for the rest
      return `
        float ${this.getFunctionName()}(vec3 p) {
          vec3 axis = ${normalizedAxis.glsl()};
          float totalAngle = ${(this.angle * Math.PI / 180.0).toFixed(16)}; // Convert to radians
          float segmentAngle = totalAngle / float(${this.copies});
          float halfSegmentAngle = segmentAngle * 0.5;
          float centerOffset = ${centerAngle.toFixed(16)}; // Angle to bounding sphere center
          
          // Rotate point to align with axis
          mat3 toAxisSpace = rotateToAxis(axis);
          mat3 fromAxisSpace = transposeMatrix(toAxisSpace);
          
          // Transform to axis-aligned space (z is now along rotation axis)
          vec3 q = toAxisSpace * p;
          
          // Get angle in XY plane (around Z axis)
          float angle = atan(q.y, q.x) - centerOffset + halfSegmentAngle;
          
          // Normalize angle to [0, totalAngle) without branching
          // First add enough multiples of 2π to make it positive
          angle += 2.0 * 3.14159265359 * ceil(-angle / (2.0 * 3.14159265359));
          // Then use mod to get it within [0, totalAngle)
          angle = mod(angle, totalAngle);
          
          // Calculate the index of the current segment
          float idx = floor(angle / segmentAngle);
          
          // Evaluate overlapping copies, including wrapping around
          float d = 1e10;  // Initialize to a large value
          
          // Start from idx - radiusOverlaps and wrap around if needed
          for (int i = 0; i < ${2*radiusOverlaps + 1}; i++) {
            float copyIdx = idx - float(${radiusOverlaps}) + float(i);
            
            // Wrap copyIdx to valid range without branching
            copyIdx = mod(copyIdx + float(${this.copies}), float(${this.copies}));
            
            float rotationAngle = -copyIdx * segmentAngle;
            float c = cos(rotationAngle);
            float s = sin(rotationAngle);
            vec3 rotated = vec3(
              c * q.x - s * q.y,
              s * q.x + c * q.y,
              q.z
            );
            p = fromAxisSpace * rotated;
            float d1 = ${this.children[0].shaderCode()};
            d = ${minfn};
          }
          
          return d;
        }
      `;
    } else {
      // pure domain repetition, no overlaps
      return `
        float ${this.getFunctionName()}(vec3 p) {
          vec3 axis = ${normalizedAxis.glsl()};
          float totalAngle = ${(this.angle * Math.PI / 180.0).toFixed(16)}; // Convert to radians
          float segmentAngle = totalAngle / float(${this.copies});
          float halfSegmentAngle = segmentAngle * 0.5;
          float centerOffset = ${centerAngle.toFixed(16)}; // Angle to bounding sphere center
          
          // Rotate point to align with axis
          mat3 toAxisSpace = rotateToAxis(axis);
          mat3 fromAxisSpace = transposeMatrix(toAxisSpace);
          
          // Transform to axis-aligned space (z is now along rotation axis)
          vec3 q = toAxisSpace * p;
          
          // Get angle in XY plane (around Z axis), offset by the center angle
          // and half segment to center within segment
          float angle = atan(q.y, q.x) - centerOffset + halfSegmentAngle;
          
          // Normalize angle to [0, totalAngle) without branching
          // First add enough multiples of 2π to make it positive
          angle += 2.0 * 3.14159265359 * ceil(-angle / (2.0 * 3.14159265359));
          // Then use mod to get it within [0, totalAngle)
          angle = mod(angle, totalAngle);
          
          // Map to first segment
          float segment = floor(angle / segmentAngle);
          float rotationAngle = -segment * segmentAngle;
          
          // Rotate point back to first segment
          float c = cos(rotationAngle);
          float s = sin(rotationAngle);
          q = vec3(
            c * q.x - s * q.y,
            s * q.x + c * q.y,
            q.z
          );
          
          // Transform back to original space
          p = fromAxisSpace * q;
          
          return ${this.children[0].shaderCode()};
        }
      `;
    }
  }

  generateShaderCode() {
    return `${this.getFunctionName()}(p)`;
  }

  getIcon() {
    return "🔀";
  }
}

class ExtrudeNode extends TreeNode {
  constructor(children = []) {
    super("Extrude");
    this.height = 100.0;
    this.maxChildren = 1;
    this.blendRadius = 0.0;
    this.chamfer = false;
    this.draftAngle = 0.0;
    this.addChild(children);
  }

  getExactness() {
    return TreeNode.LOWERBOUND;
  }

  properties() {
    return {"height": "float", "blendRadius": "float", "chamfer": "bool", "draftAngle": "float"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Extrude node has no child to transform");
      return this.noop();
    }
    if (!this.children[0].is2d()) {
      this.warn("Extrude node requires a 2D child");
      return this.noop();
    }
    const p2d = P.vec3(P.vecX(p), P.vecY(p), P.const(0.0));
    const d2d = this.children[0].peptide(p2d);
    const dz = P.sub(P.abs(P.vecZ(p)), P.const(this.height/2));
    const pz = P.clamp(P.add(P.vecZ(p), P.const(this.height/2)), P.const(0.0), P.const(this.height));
    const d = P.add(P.mul(d2d, P.const(Math.cos(this.draftAngle * Math.PI / 180.0))), P.mul(pz, P.const(Math.tan(this.draftAngle * Math.PI / 180.0))));
    if (this.blendRadius > 0.0) {
      // XXX: we could allow a different radius at top vs bottom by picking a different `maxfn` based on the sign of `dz`
      if (this.chamfer) {
        return P.chmax(d, dz, P.const(this.blendRadius));
      } else {
        return P.smax(d, dz, P.const(this.blendRadius));
      }
    } else {
      return P.max(d, dz);
    }
  }
  
  getIcon() {
    return "⬆️";
  }
}

class RevolveNode extends TreeNode {
  constructor(children = []) {
    super("Revolve");
    this.maxChildren = 1;
    this.addChild(children);
  }

  getExactness() {
    return TreeNode.EXACT;
  }

  properties() {
    return {"angle": "float"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Revolve node has no child to transform");
      return this.noop();
    }
    if (!this.children[0].is2d()) {
      this.warn("Revolve node requires a 2D child");
      return this.noop();
    }

    const pxz = P.vec3(P.vecX(p), P.vecZ(p), P.const(0.0));
    const py = P.vecY(p);
    const p2d = P.vec3(P.vlength(pxz), py, P.const(0.0));
    return this.children[0].peptide(p2d);
  }

  getIcon() {
    return "🔄";
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { TransformNode, DomainDeformNode, DistanceDeformNode, ThicknessNode, ScaleNode,
    TwistNode, MirrorNode, LinearPatternNode, PolarPatternNode, ExtrudeNode,
    RevolveNode };
  
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