class TransformNode extends TreeNode {
  constructor(children = []) {
    super("Transform");
    this.translation = new Vec3(0, 0, 0);
    this.rotationAxis = new Vec3(0, 1, 0);
    this.rotationAngle = 0; // Angle in degrees
    this.maxChildren = 1;
    this.addChild(children);
  }

  is2d() {
    return this.children.length > 0 && this.children[0].is2d();
  }

  properties() {
    return {
      "translation": "vec3", 
      "rotationAxis": "vec3", 
      "rotationAngle": "float"
    };
  }

  grabHandles() {
    // Define a fixed length for the handles (5 units as suggested)
    const handleLength = () => 0.25 / camera.zoom;
    
    return {
        "translation.x": {
            // Use getOrigin instead of origin for dynamic updates
            getOrigin: () => this.translation,
            axis: new Vec3(1, 0, 0),
            color: new Vec3(1, 0, 0),
            position: () => this.translation.add(new Vec3(handleLength(), 0, 0)),
            get: () => handleLength(),  // Fixed length
            set: (value) => {
                // Calculate new translation based on drag position
                const newX = this.translation.x + (value - handleLength());
                this.setProperty('translation', new Vec3(newX, this.translation.y, this.translation.z));
            }
        },
        "translation.y": {
            getOrigin: () => this.translation,
            axis: new Vec3(0, 1, 0),
            color: new Vec3(0, 1, 0),
            position: () => this.translation.add(new Vec3(0, handleLength(), 0)),
            get: () => handleLength(),
            set: (value) => {
                const newY = this.translation.y + (value - handleLength());
                this.setProperty('translation', new Vec3(this.translation.x, newY, this.translation.z));
            }
        },
        "translation.z": {
            getOrigin: () => this.translation,
            axis: new Vec3(0, 0, 1),
            color: new Vec3(0, 0, 1),
            position: () => this.translation.add(new Vec3(0, 0, handleLength())),
            get: () => handleLength(),
            set: (value) => {
                const newZ = this.translation.z + (value - handleLength());
                this.setProperty('translation', new Vec3(this.translation.x, this.translation.y, newZ));
            }
        },
    };
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Transform node has no child to transform");
      return this.noop();
    }
    
    let expr = P.vsub(p, this.vuniform('translation'));

    const angleRad = this.rotationAngle * Math.PI / 180.0;
    if (Math.abs(angleRad) > 0.000001) {
      // Rodrigues rotation formula
      const axis = P.vdiv(this.vuniform('rotationAxis'), P.vlength(this.vuniform('rotationAxis')));
      const angleRad = P.mul(P.const(Math.PI), P.div(this.uniform('rotationAngle'), P.const(180.0)));
      const cosA = P.cos(angleRad);
      const sinA = P.sin(angleRad);
      const k = P.sub(P.one(), cosA);
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

  aabb() {
    if (this.children.length === 0) {
        return AABB.empty();
    }

    // Get the child's AABB
    let childAABB = this.children[0].aabb();
    
    // Apply rotation if needed
    if (Math.abs(this.rotationAngle) > 0.000001) {
        const angleRad = this.rotationAngle * Math.PI / 180.0;
        const axis = this.rotationAxis.normalize();
        childAABB = childAABB.getRotatedAABB(axis, angleRad);
    }
    
    // Apply translation
    return new AABB(
        childAABB.min.add(this.translation),
        childAABB.max.add(this.translation)
    );
  }
}

class DomainDeformNode extends TreeNode {
  constructor(children = []) {
    super("DomainDeform");
    this.amplitude = 0.1; // Controls the height of the roughness
    this.frequency = 1.0; // Controls how dense the roughness pattern is
    this.maxChildren = 1;
    this.addChild(children);
  }

  properties() {
    return {"amplitude": "float", "frequency": "float"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("DomainDeform node has no child to transform");
      return this.noop();
    }

    const px1 = P.mul(P.sin(P.mul(P.vecY(p), this.uniform('frequency'))), this.uniform('amplitude'));
    const py1 = P.mul(P.sin(P.mul(P.vecZ(p), this.uniform('frequency'))), this.uniform('amplitude'));
    const pz1 = P.mul(P.sin(P.mul(P.vecX(p), this.uniform('frequency'))), this.uniform('amplitude'));

    const px2 = P.mul(P.const(0.5), P.mul(P.cos(P.mul(P.add(P.add(P.vecZ(p), P.vecY(p)), P.one()), this.uniform('frequency'))), this.uniform('amplitude')));
    const py2 = P.mul(P.const(0.5), P.mul(P.cos(P.mul(P.add(P.add(P.vecX(p), P.vecZ(p)), P.const(2.42)), this.uniform('frequency'))), this.uniform('amplitude')));
    const pz2 = P.mul(P.const(0.5), P.mul(P.cos(P.mul(P.add(P.add(P.vecY(p), P.vecX(p)), P.const(14.5)), this.uniform('frequency'))), this.uniform('amplitude')));

    const child = this.children[0].peptide(P.vadd(p, P.vec3(P.add(px1, px2), P.add(py1, py2), P.add(pz1, pz2))));
    if (!child) return null;
    const distance = P.field(child, 'distance');
    const lipschitz = P.mul(P.field(child, 'lipschitz'), P.max(P.one(), P.mul(P.const(2.0), P.mul(P.abs(this.uniform('frequency')), P.abs(this.uniform('amplitude'))))));
    const color = P.field(child, 'color');
    const uniqueId = P.field(child, 'uniqueId');
    return P.struct({distance, color, uniqueId, lipschitz});
  }

  getIcon() {
    return "〰️";
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }

    const childAABB = this.children[0].aabb();
    return new AABB(
      childAABB.min.sub(new Vec3(this.amplitude, this.amplitude, this.amplitude)),
      childAABB.max.add(new Vec3(this.amplitude, this.amplitude, this.amplitude))
    );
  }
}

class DistanceDeformNode extends TreeNode {
  constructor(children = []) {
    super("DistanceDeform");
    this.amplitude = 0.1; // Controls the height of the roughness
    this.frequency = 1.0; // Controls how dense the roughness pattern is
    this.maxChildren = 1;
    this.addChild(children);
  }

  properties() {
    return {"amplitude": "float", "frequency": "float"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("DistanceDeform node has no child to transform");
      return this.noop();
    }
    
    const child = this.children[0].peptide(p);
    if (!child) return null;

    const freq = this.uniform('frequency');
    const ampl = this.uniform('amplitude');

    const noise1X = P.sin(P.mul(P.vecX(p), freq));
    const noise1Y = P.sin(P.mul(P.vecY(p), freq));
    const noise1Z = P.sin(P.mul(P.vecZ(p), freq));
    const noise1XYZ = P.sin(P.mul(P.add(P.add(P.vecX(p), P.vecY(p)), P.vecZ(p)), P.mul(P.const(1.5), freq)));
    const noise1 = P.mul(noise1X, P.mul(noise1Y, P.mul(noise1Z, noise1XYZ)));

    const noise2X = P.sin(P.mul(P.vecX(p), P.mul(P.const(2.0), freq)));
    const noise2Y = P.sin(P.mul(P.vecY(p), P.mul(P.const(2.0), freq)));
    const noise2Z = P.sin(P.mul(P.vecZ(p), P.mul(P.const(2.0), freq)));
    const noise2 = P.mul(P.const(0.5), P.mul(noise2X, P.mul(noise2Y, noise2Z)));
    const distance = P.add(P.field(child, 'distance'), P.mul(ampl, P.add(noise1, noise2)));
    const color = P.field(child, 'color');
    const uniqueId = P.field(child, 'uniqueId');
    const lipschitz = P.mul(P.field(child, 'lipschitz'), P.add(P.one(), P.mul(P.abs(this.uniform('frequency')), P.abs(this.uniform('amplitude')))));
    return P.struct({distance, color, uniqueId, lipschitz});
  }

  getIcon() {
    return "〰️";
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }

    const childAABB = this.children[0].aabb();
    return new AABB(
      childAABB.min.sub(new Vec3(this.amplitude, this.amplitude, this.amplitude)),
      childAABB.max.add(new Vec3(this.amplitude, this.amplitude, this.amplitude))
    );
  }
}

class ShellNode extends TreeNode {
  constructor(children = []) {
    super("Shell");
    this.thickness = 1.0;
    this.shellType = "outside"; // "inside", "outside", or "centered"
    this.maxChildren = 1;
    this.addChild(children);
  }

  properties() {
    return {
      "thickness": "float", 
      "shellType": ["outside", "inside", "centered"]
    };
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Shell node has no child to transform");
      return this.noop();
    }
    
    const child = this.children[0].peptide(p);
    if (!child) return null;
    const d = P.field(child, 'distance');
    const negD = P.neg(d);
    
    if (this.shellType === "inside") {
      return P.struct({
        distance: P.max(d, P.sub(negD, this.uniform('thickness'))),
        color: P.field(child, 'color'),
        uniqueId: P.field(child, 'uniqueId'),
        lipschitz: P.field(child, 'lipschitz'),
      });
    } else if (this.shellType === "centered") {
      const halfThickness = P.div(this.uniform('thickness'), P.const(2.0));
      return P.struct({
        distance: P.max(
          P.sub(d, halfThickness), 
          P.sub(negD, halfThickness)
        ),
        color: P.field(child, 'color'),
        uniqueId: P.field(child, 'uniqueId'),
        lipschitz: P.field(child, 'lipschitz'),
      });
    } else { // "outside" (default)
      return P.struct({
        distance: P.max(P.sub(d, this.uniform('thickness')), negD),
        color: P.field(child, 'color'),
        uniqueId: P.field(child, 'uniqueId'),
        lipschitz: P.field(child, 'lipschitz'),
      });
    }
  }

  getIcon() {
    if (this.shellType === "inside") {
      return "🔍";
    } else if (this.shellType === "centered") {
      return "↔️";
    } else {
      return "🔍";
    }
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }

    const childAABB = this.children[0].aabb();
    if (this.shellType === "inside") {
      return childAABB;
    } else if (this.shellType === "centered") {
      return new AABB(
        childAABB.min.sub(new Vec3(this.thickness/2.0, this.thickness/2.0, this.thickness/2.0)),
        childAABB.max.add(new Vec3(this.thickness/2.0, this.thickness/2.0, this.thickness/2.0))
      );
    } else {
      return new AABB(
        childAABB.min.sub(new Vec3(this.thickness, this.thickness, this.thickness)),
        childAABB.max.add(new Vec3(this.thickness, this.thickness, this.thickness))
      );
    }
  }
}

class InfillNode extends TreeNode {
  constructor(children = []) {
    super("Infill");
    this.thickness = 1.0;
    this.maxChildren = 2;
    this.addChild(children);
  }

  properties() {
    return {"thickness": "float", "blendRadius": "float", "chamfer": "float"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Infill node has no child to transform");
      return this.noop();
    }

    const child1 = this.children[0].peptide(p);
    if (this.children.length == 1) {
      return child1;
    }
    if (!child1) return null;

    const child2 = this.children[1].peptide(p);
    if (!child2) return child1;

    const negD = P.neg(P.field(child1, 'distance'));
    const dShell = P.max(P.field(child1, 'distance'), P.sub(negD, this.uniform('thickness')));

    const shellStruct = P.struct({
      distance: dShell,
      color: P.field(child1, 'color'),
      uniqueId: P.field(child1, 'uniqueId'),
      lipschitz: P.field(child1, 'lipschitz'),
    });
    const innerStruct = P.struct({
      distance: P.add(P.field(child1, 'distance'), this.uniform('thickness')),
      color: P.field(child1, 'color'),
      uniqueId: P.field(child1, 'uniqueId'),
      lipschitz: P.field(child1, 'lipschitz'),
    });
    return this.structmin(shellStruct, this.structmax(innerStruct, child2));
  }
  getIcon() {
    return "🔍";
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }

    return this.children[0].aabb();
  }
}

class OffsetNode extends TreeNode {
  constructor(children = []) {
    super("Offset");
    this.distance = 1.0;
    this.maxChildren = 1;
    this.addChild(children);
  }

  properties() {
    return {"distance": "float"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Offset node has no child to transform");
      return this.noop();
    }

    const child = this.children[0].peptide(p);
    if (!child) return null;
    return P.struct({
      distance: P.add(P.field(child, 'distance'), this.uniform('distance')),
      color: P.field(child, 'color'),
      uniqueId: P.field(child, 'uniqueId'),
      lipschitz: P.field(child, 'lipschitz'),
    });
  }

  getIcon() {
    return "🔍";
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }

    const childAABB = this.children[0].aabb();
    return new AABB(
      childAABB.min.sub(new Vec3(this.distance, this.distance, this.distance)),
      childAABB.max.add(new Vec3(this.distance, this.distance, this.distance))
    );
  }
}

class ScaleNode extends TreeNode {
  constructor(children = []) {
    super("Scale");
    this.k = 2.0;
    this.alongAxis = false;
    this.axis = new Vec3(0, 0, 1);
    this.maxChildren = 1;
    this.addChild(children);
  }

  is2d() {
    return this.children.length > 0 && this.children[0].is2d();
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
      const child = this.children[0].peptide(P.vdiv(p, this.uniform('k')));
      if (!child) return null;
      return P.struct({
        distance: P.mul(P.field(child, 'distance'), this.uniform('k')),
        color: P.field(child, 'color'),
        uniqueId: P.field(child, 'uniqueId'),
        lipschitz: P.field(child, 'lipschitz'),
      });
    }

    const axis = P.vdiv(this.vuniform('axis'), P.vlength(this.vuniform('axis')));
    const projLength = P.vdot(p, axis);
    const projVec = P.vmul(axis, projLength);
    const perpVec = P.vsub(p, projVec);
    const scaledP = P.vadd(perpVec, P.vdiv(projVec, this.uniform('k')));

    const child = this.children[0].peptide(scaledP);
    if (!child) return null;

    if (this.k > 1.0) {
      return child;
    } else {
      return P.struct({
        distance: P.mul(P.field(child, 'distance'), this.uniform('k')),
        color: P.field(child, 'color'),
        uniqueId: P.field(child, 'uniqueId'),
        lipschitz: P.field(child, 'lipschitz'),
      });
    }
  }

  getIcon() {
    return "⇲";
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }

    const childAABB = this.children[0].aabb();
    
    if (!this.alongAxis) {
      // Simple uniform scaling
      return new AABB(
        childAABB.min.mul(this.k),
        childAABB.max.mul(this.k)
      );
    } else {
      // Create a transformation matrix for the axis-aligned scaling
      const axis = this.axis.normalize();
      const scaleMatrix = new Mat3().makeAxisScale(axis, this.k);
      return childAABB.getTransformedAABB(scaleMatrix);
    }
  }
}

class TwistNode extends TreeNode {
  constructor(children = []) {
    super("Twist");
    this.height = 100.0;
    this.axis = new Vec3(0, 0, 1);
    this.maxChildren = 1;
    this.addChild(children);
  }

  properties() {
    return {"height": "float", "axis": "vec3"};
  }

  grabHandles() {
    return {
      "height": { origin: new Vec3(0, 0, 0), axis: new Vec3(0, 0, 1), ratio: 0.5, color: new Vec3(0, 0, 1) },
    };
  }
  
  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Twist node has no child to transform");
      return this.noop();
    }

    if (this.height == 0.0) {
      return this.children[0].peptide(p);
    }

    const axis = this.axis.normalize();
    const toAxisSpace = P.mconst(new Mat3().rotateToAxis(axis));
    const fromAxisSpace = P.mtranspose(toAxisSpace);

    const q = P.mvmul(toAxisSpace, p);
    const angle = P.mul(P.const(-2.0 * Math.PI), P.div(P.vecZ(q), this.uniform('height')));
    const c = P.cos(angle);
    const s = P.sin(angle);
    const q2 = P.vec3(P.sub(P.mul(c, P.vecX(q)), P.mul(s, P.vecY(q))),
                      P.add(P.mul(s, P.vecX(q)), P.mul(c, P.vecY(q))),
                      P.vecZ(q));
    const p2 = P.mvmul(fromAxisSpace, q2);
    
    // Calculate the maximum scaling factor to preserve distance metric
    // The scaling is largest at the maximum distance from the axis
    const distFromAxis = P.vlength(P.vec3(P.vecX(q), P.vecY(q), P.zero()));
    const twistRate = P.div(P.const(2.0 * Math.PI), this.uniform('height'));
    const maxScale = P.add(P.one(), P.mul(distFromAxis, twistRate));
    
    // Get the SDF value from the child
    const child = this.children[0].peptide(p2);
    if (!child) return null;
    
    return P.struct({
      distance: P.field(child, 'distance'),
      color: P.field(child, 'color'),
      uniqueId: P.field(child, 'uniqueId'),
      lipschitz: P.mul(P.field(child, 'lipschitz'), maxScale),
    });
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
    this.keepOriginal = true;
    this.addChild(children);
  }

  properties() {
    return {"plane": ["XY", "XZ", "YZ"], "keepOriginal": "bool", "blendRadius": "float", "chamfer": "float"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Mirror node has no child to transform");
      return this.noop();
    }

    let pMirrored = p;

    if (this.plane === "XY") {
      pMirrored = P.vec3(P.vecX(p), P.vecY(p), P.neg(P.vecZ(p)));
    } else if (this.plane === "XZ") {
      pMirrored = P.vec3(P.vecX(p), P.neg(P.vecY(p)), P.vecZ(p));
    } else {
      pMirrored = P.vec3(P.neg(P.vecX(p)), P.vecY(p), P.vecZ(p));
    }
    
    const mirrored = this.children[0].peptide(pMirrored);

    if (this.keepOriginal) {
      const original = this.children[0].peptide(p);
      return this.structmin(original, mirrored);
    } else {
      return mirrored;
    }
  }

  getIcon() {
    return "🪞";
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }

    const childAABB = this.children[0].aabb();
    
    // Create the mirrored AABB based on the plane
    let mirroredMin, mirroredMax;
    
    if (this.plane === "XY") {
      // Mirror across z-axis (flip z coordinates)
      mirroredMin = new Vec3(childAABB.min.x, childAABB.min.y, -childAABB.max.z);
      mirroredMax = new Vec3(childAABB.max.x, childAABB.max.y, -childAABB.min.z);
    } else if (this.plane === "XZ") {
      // Mirror across y-axis (flip y coordinates)
      mirroredMin = new Vec3(childAABB.min.x, -childAABB.max.y, childAABB.min.z);
      mirroredMax = new Vec3(childAABB.max.x, -childAABB.min.y, childAABB.max.z);
    } else { // YZ plane
      // Mirror across x-axis (flip x coordinates)
      mirroredMin = new Vec3(-childAABB.max.x, childAABB.min.y, childAABB.min.z);
      mirroredMax = new Vec3(-childAABB.min.x, childAABB.max.y, childAABB.max.z);
    }
    
    const mirroredAABB = new AABB(mirroredMin, mirroredMax);
    
    if (this.keepOriginal) {
      // Use the built-in union method
      return childAABB.getUnion(mirroredAABB);
    } else {
      // Just the mirrored AABB
      return mirroredAABB;
    }
  }
}

class LinearPatternNode extends TreeNode {
  constructor(children = []) {
    super("LinearPattern");
    this.maxChildren = 1;
    this.axis = new Vec3(0, 0, 1);
    this.spacing = 100.0;
    this.copies = 2;
    this.addChild(children);
  }

  properties() {
    return {"axis": "vec3", "spacing": "float", "copies": "int", "blendRadius": "float", "chamfer": "float"};
  }

  grabHandles() {
    return {
      "spacing": { origin: new Vec3(0, 0, 0), axis: this.axis },
    };
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("LinearPattern node has no child");
      return this.noop();
    }
    
    if (this.copies < 1) {
      return this.noop();
    }

    const axis = P.vdiv(this.vuniform('axis'), P.vlength(this.vuniform('axis')));
    const step = P.vmul(axis, this.uniform('spacing'));
    let d = this.children[0].peptide(p);
    for (let i = 1; i < this.copies; i++) {
      const pi = P.vsub(p, P.vmul(step, P.const(i)));
      d = this.structmin(d, this.children[0].peptide(pi));
    }
    return d;
  }

  getIcon() {
    return "🔀";
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }
    
    if (this.copies < 1) {
      return AABB.empty();
    }
    
    // Get the child's AABB
    const childAABB = this.children[0].aabb();
    
    // Calculate the total displacement for all copies
    const normalizedAxis = this.axis.normalize();
    const totalDisplacement = normalizedAxis.mul(this.spacing * (this.copies - 1));
    
    // Create a result AABB
    let result = childAABB.clone();
    
    // For the last copy's AABB
    const lastCopyAABB = new AABB(
      childAABB.min.add(totalDisplacement),
      childAABB.max.add(totalDisplacement)
    );
    
    // Expand to include the last copy
    result = result.getUnion(lastCopyAABB);
    
    return result;
  }
}

class PolarPatternNode extends TreeNode {
  constructor(children = []) {
    super("PolarPattern");
    this.maxChildren = 1;
    this.copies = 2;
    this.axis = new Vec3(0, 0, 1);
    this.angle = 360.0;
    this.addChild(children);
  }

  properties() {
    return {"copies": "int", "axis": "vec3", "angle": "float", "blendRadius": "float", "chamfer": "float"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("PolarPattern node has no child to transform");
      return this.noop();
    }
    
    if (this.copies < 1) {
      return this.noop();
    }

    const totalAngle = P.mul(this.uniform('angle'), P.const(Math.PI / 180.0));
    const toAxisSpace = P.mconst(new Mat3().rotateToAxis(this.axis.normalize()));
    const fromAxisSpace = P.mtranspose(toAxisSpace);

    const q = P.mvmul(toAxisSpace, p);
    const angleIncrement = P.div(totalAngle, P.const(this.copies));
    let d = this.children[0].peptide(p);
    for (let i = 1; i < this.copies; i++) {
      const angle = P.mul(angleIncrement, P.const(i));
      const c = P.cos(angle);
      const s = P.sin(angle);
      const rotated = P.vec3(
        P.sub(P.mul(c, P.vecX(q)), P.mul(s, P.vecY(q))),
        P.add(P.mul(s, P.vecX(q)), P.mul(c, P.vecY(q))),
        P.vecZ(q)
      );
      const p1 = P.mvmul(fromAxisSpace, rotated);
      d = this.structmin(d, this.children[0].peptide(p1));
    }
    return d;
  }

  getIcon() {
    return "🔀";
  }

  aabb() {
    if (this.children.length === 0 || this.copies < 1) {
        return AABB.empty();
    }
    
    // Get the child's AABB
    const childAABB = this.children[0].aabb();
    
    // If only one copy or zero rotation angle, return the child's AABB
    if (this.copies === 1 || Math.abs(this.angle) < 0.001) {
        return childAABB;
    }
    
    // Initialize result with the first copy's AABB
    let result = childAABB.clone();
    
    // Get the normalized rotation axis and angle increment
    const axis = this.axis.normalize();
    const angleIncrement = (this.angle * Math.PI / 180.0) / this.copies;
    
    // For each copy (after the first one)
    for (let i = 1; i < this.copies; i++) {
        const angle = angleIncrement * i;
        const copyAABB = childAABB.getRotatedAABB(axis, angle);
        result = result.getUnion(copyAABB);
    }
    
    return result;
  }
}

class ExtrudeNode extends TreeNode {
  constructor(children = []) {
    super("Extrude");
    this.height = 100.0;
    this.maxChildren = 1;
    this.draftAngle = 0.0;
    this.axis = new Vec3(0, 0, 1);
    this.addChild(children);
  }

  properties() {
    return {"height": "float", "axis": "vec3", "blendRadius": "float", "chamfer": "float", "draftAngle": "float"};
  }

  grabHandles() {
    return {
      "height": { origin: new Vec3(0, 0, 0), axis: new Vec3(0, 0, 1), ratio: 0.5, color: new Vec3(0, 0, 1) },
      "draftAngle": { origin: new Vec3(0, 0, 0), axis: new Vec3(0, 0, 1) },
      "blendRadius": { origin: new Vec3(0, 0, 0), axis: new Vec3(0, 0, 1) },
    };
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Extrude node has no child to transform");
      return this.noop();
    }
    if (!this.children[0].is2d()) {
      this.warn("Extrude node requires a 2D child");
      // carry on anyway
    }
    if (this.axis.z == 0){
      this.warn("Extrude axis must have non-zero Z component");
      return this.noop();
    }
    const axis = P.vnormalize(this.vuniform('axis'));
    const t = P.div(P.vecZ(p), P.vecZ(axis));
    const p2d = P.vsub(p, P.vmul(axis, t));
    const child = this.children[0].peptide(p2d);
    if (!child) return null;
    const halfHeight = P.div(this.uniform('height'), P.const(2.0));
    const dz = P.sub(P.abs(P.vecZ(p)), halfHeight);
    const pz = P.clamp(P.add(P.vecZ(p), halfHeight), P.zero(), this.uniform('height'));
    const draftAngleRad = P.mul(this.uniform('draftAngle'), P.const(Math.PI / 180.0));
    const d = P.add(P.mul(P.field(child, 'distance'), P.cos(draftAngleRad)), P.mul(pz, P.tan(draftAngleRad)));
    return P.struct({
      distance: this.max(d, dz),
      color: P.field(child, 'color'),
      uniqueId: P.field(child, 'uniqueId'),
      lipschitz: P.field(child, 'lipschitz'),
    });
  }
  
  getIcon() {
    return "⬆️";
  }

  aabb() {
    if (this.children.length === 0) {
      return AABB.empty();
    }
    const childAABB = this.children[0].aabb();
    return new AABB(
      childAABB.min.sub(new Vec3(0, 0, this.height / 2)),
      childAABB.max.add(new Vec3(0, 0, this.height / 2))
    );
  }
}

class DistanceDeformInsideNode extends TreeNode {
  constructor(children = []) {
    super("DistanceDeformInside");
    this.amplitude = 1.0;
    this.maxDisplacement = 1.0;
    this.maxChildren = 2;
    this.addChild(children);
  }

  makeNormalised() {
    this.secondChild = this.children[1];
    return super.makeNormalised();
  }

  properties() {
    return {"amplitude": "float", "maxDisplacement": "float", "blendRadius": "float", "chamfer": "float"};
  }

  makePeptide(p) {
    const child0 = this.children[0];
    let child1 = this.children[1];
    if (!child0) {
      this.warn("DistanceDeformInside node has no child to transform");
      return this.noop();
    }
    if (!child1) {
      // Hack: the TreeRewriter loses out reference to our second child, so we stash it in makeNormalised() and put it back here
      if (this.secondChild) {
        this.children.push(this.secondChild);
        child1 = this.secondChild;
      } else {
        this.warn("DistanceDeformInside node needs a second child to specify the space to deform");
        return child0.peptide(p);
      }
    }
    const d0 = child0.peptide(p);
    if (!d0) return null;
    const d1 = child1.peptide(p);
    if (!d1) return d0;

    const dist0 = P.field(d0, 'distance');
    const dist1 = P.field(d1, 'distance');
    const distInside = P.min(dist1, P.zero());
    const scaledDistInside = P.mul(distInside, this.uniform('amplitude'));
    const clampedScaledDist = P.clamp(scaledDistInside, P.neg(this.uniform('maxDisplacement')), this.uniform('maxDisplacement'));
    const distance = P.add(dist0, clampedScaledDist);

    return P.struct({
      distance: distance,
      color: P.field(d0, 'color'),
      uniqueId: P.field(d0, 'uniqueId'),
      lipschitz: P.add(P.field(d0, 'lipschitz'), P.field(d1, 'lipschitz')),
    });
  }
  
  getIcon() {
    return "🔍";
  }

  aabb() {
    if (this.children.length < 1) {
      return AABB.empty();
    }
    return this.children[0].aabb();
  }
}
class RevolveNode extends TreeNode {
  constructor(children = []) {
    super("Revolve");
    this.axis = new Vec3(0, 0, 1);
    this.maxChildren = 1;
    this.addChild(children);
  }

  properties() {
    return {"axis": "vec3"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Revolve node has no child to transform");
      return this.noop();
    }
    if (!this.children[0].is2d()) {
      this.warn("Revolve node requires a 2D child");
      // carry on anyway
    }

    const axis = P.vdiv(this.vuniform('axis'), P.vlength(this.vuniform('axis')));
    
    // Project p onto the axis to get the closest point on the axis
    const projDist = P.vdot(p, axis);
    const projPoint = P.vmul(axis, projDist);
    
    // Vector from the axis to the point
    const toPoint = P.vsub(p, projPoint);
    
    // Distance from the axis (radius in cylindrical coordinates)
    const radius = P.vlength(toPoint);
    
    // Create a 2D point in the XY plane where:
    // X = distance from axis (radius)
    // Y = distance along axis (height)
    const p2d = P.vec3(radius, projDist, P.zero());
    
    return this.children[0].peptide(p2d);
  }

  getIcon() {
    return "🔄";
  }
}

class HelixExtrudeNode extends TreeNode {
  constructor(children = []) {
    super("HelixExtrude");
    this.height = 100.0;
    this.radius = 20.0;
    this.pitch = 50.0;
    this.turns = 2.0;
    this.maxChildren = 1;
    this.addChild(children);
  }

  properties() {
    return {
      "height": "float", 
      "radius": "float", 
      "pitch": "float", 
      "turns": "float",
      "blendRadius": "float", 
      "chamfer": "float"
    };
  }

  grabHandles() {
    return {
      "height": { origin: new Vec3(0, 0, 0), axis: new Vec3(0, 0, 1) },
      "radius": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 0, 0) },
      "pitch": { origin: new Vec3(0, 0, 0), axis: new Vec3(0, 0, 1) },
      "blendRadius": { origin: new Vec3(0, 0, 0), axis: new Vec3(1, 1, 0) },
    };
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("HelixExtrude node has no child to transform");
      return this.noop();
    }
    if (!this.children[0].is2d()) {
      this.warn("HelixExtrude node requires a 2D child");
      // carry on anyway
    }

    // Calculate total height based on turns and pitch
    const totalHeight = P.mul(this.uniform('pitch'), this.uniform('turns'));
    
    // Get coordinates
    const x = P.vecX(p);
    const y = P.vecY(p);
    const z = P.vecZ(p);
    
    // Find closest point on the helix
    // This is an approximation - we find the closest point on the z-axis
    // and then use that to determine where on the helix we are
    
    // Calculate the z-parameter for the helix
    const t = P.div(z, this.uniform('pitch'));
    
    // Calculate the corresponding point on the helix
    const hx = P.mul(this.uniform('radius'), P.cos(P.mul(t, P.const(2.0 * Math.PI))));
    const hy = P.mul(this.uniform('radius'), P.sin(P.mul(t, P.const(2.0 * Math.PI))));
    const hz = z;
    
    // Vector from point on helix to our point
    const dx = P.sub(x, hx);
    const dy = P.sub(y, hy);
    
    // Distance from point to helix in XY plane
    const dr = P.vlength(P.vec3(dx, dy, P.zero()));
    
    // Create a 2D point for the cross-section
    // X = distance from helix centerline (radial)
    // Y = position along helix (we use z directly)
    const p2d = P.vec3(dr, P.zero(), P.zero());
    
    // Get the SDF from the 2D child
    const child = this.children[0].peptide(p2d);
    if (!child) return null;
    
    // Limit the helix to the specified height
    const heightLimit = P.sub(P.abs(z), totalHeight);
    
    // Return the maximum of the 2D SDF and the height limit
    return P.struct({
      distance: this.max(P.field(child, 'distance'), heightLimit),
      color: P.field(child, 'color'),
      uniqueId: P.field(child, 'uniqueId'),
      lipschitz: P.field(child, 'lipschitz'),
    });
  }
  
  getIcon() {
    return "🌀";
  }
}

// NegateNode is not exposed in the UI (should it be?), it is just used to
// implement SubtractionNode
class NegateNode extends TreeNode {
  constructor(children = []) {
    super("Negate");
    this.maxChildren = 1;
    this.addChild(children);
  }

  makePeptide(p) {
    if (this.children.length < 1) {
      this.warn("Negate node has no child to transform");
      return this.noop();
    }
    const child = this.children[0].peptide(p);
    if (!child) return null;
    return P.struct({
      distance: P.neg(P.field(child, 'distance')),
      color: P.field(child, 'color'),
      uniqueId: P.field(child, 'uniqueId'),
      lipschitz: P.field(child, 'lipschitz'),
    });
  }

  getIcon() {
    return "🔄";
  }
}

// a BlendNode doesn't actually apply a blend itself, it is just a convenient
// object to store in the document tree; the BlendNodes are collected up in
// the TreeRewriter to apply the blends
class BlendNode extends TreeNode {
  constructor(document, id1, id2, blendRadius = 1.0, chamfer = 0.0) {
    super("Blend");
    this.document = document;
    this.ids = [id1, id2];
    this.blendRadius = blendRadius;
    this.chamfer = chamfer;
  }

  properties() {
    return {
      "blendRadius": "float",
      "chamfer": "float",
    };
  }

  markDirty() {
    this.document.markDirty();
  }

  delete() {
    this.markDirty();

    let nodes = this.ids.map(id => this.document.findNodeById(id));

    // Remove this blend from each node's blends array
    nodes.forEach(node => {
      // Find the index of this blend in the node's blends array
      const index = node.blends.indexOf(this);
      // If found, remove it from the array
      if (index !== -1) {
        node.blends.splice(index, 1);
      }
    });
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { TransformNode, DomainDeformNode, DistanceDeformNode, ShellNode,
    InfillNode, OffsetNode, ScaleNode, TwistNode, MirrorNode, LinearPatternNode,
    PolarPatternNode, ExtrudeNode, RevolveNode, DistanceDeformInsideNode, HelixExtrudeNode,
    NegateNode, BlendNode };
  
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