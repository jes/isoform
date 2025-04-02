class TransformNode extends TreeNode {
  constructor(translation = [0, 0, 0], rotationAxis = [0, 1, 0], rotationAngle = 0, children = []) {
    super("Transform");
    this.translation = translation instanceof Vec3 ? translation : new Vec3(translation[0], translation[1], translation[2]);
    this.rotationAxis = rotationAxis instanceof Vec3 ? rotationAxis : new Vec3(rotationAxis[0], rotationAxis[1], rotationAxis[2]);
    this.rotationAngle = rotationAngle; // Angle in degrees
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
    return {
      "translation.x": {
        origin: new Vec3(0, 0, 0),
        axis: new Vec3(1, 0, 0),
        color: new Vec3(1, 0, 0),
        get: () => this.translation.x,  
        set: (value) => this.setProperty('translation', new Vec3(value, this.translation.y, this.translation.z))
      },
      "translation.y": {
        origin: new Vec3(0, 0, 0),
        axis: new Vec3(0, 1, 0),
        color: new Vec3(0, 1, 0),
        get: () => this.translation.y,
        set: (value) => this.setProperty('translation', new Vec3(this.translation.x, value, this.translation.z))
      },
      "translation.z": {
        origin: new Vec3(0, 0, 0),
        axis: new Vec3(0, 0, 1),
        color: new Vec3(0, 0, 1),
        get: () => this.translation.z,
        set: (value) => this.setProperty('translation', new Vec3(this.translation.x, this.translation.y, value))
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
  constructor(amplitude = 0.1, frequency = 1.0, children = []) {
    super("DomainDeform");
    this.amplitude = amplitude; // Controls the height of the roughness
    this.frequency = frequency; // Controls how dense the roughness pattern is
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
    const distance = P.div(P.field(child, 'distance'), P.max(P.one(), P.mul(P.const(2.0), P.mul(this.uniform('frequency'), this.uniform('amplitude')))));
    const color = P.field(child, 'color');
    const uniqueId = P.field(child, 'uniqueId');
    return P.struct({distance, color, uniqueId});
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
  constructor(amplitude = 0.1, frequency = 1.0, children = []) {
    super("DistanceDeform");
    this.amplitude = amplitude; // Controls the height of the roughness
    this.frequency = frequency; // Controls how dense the roughness pattern is
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
    const distance = P.div(P.add(P.field(child, 'distance'), P.mul(ampl, P.add(noise1, noise2))), P.max(P.one(), P.mul(P.const(2.0), P.mul(freq, ampl))));
    const color = P.field(child, 'color');
    const uniqueId = P.field(child, 'uniqueId');
    return P.struct({distance, color, uniqueId});
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
  constructor(thickness = 1.0, shellType = "outside", children = []) {
    super("Shell");
    this.thickness = thickness;
    this.shellType = shellType; // "inside", "outside", or "centered"
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
      });
    } else { // "outside" (default)
      return P.struct({
        distance: P.max(P.sub(d, this.uniform('thickness')), negD),
        color: P.field(child, 'color'),
        uniqueId: P.field(child, 'uniqueId'),
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
  constructor(thickness = 1.0, children = []) {
    super("Infill");
    this.thickness = thickness;
    this.maxChildren = 2;
    this.addChild(children);
  }

  properties() {
    return {"thickness": "float", "blendRadius": "float", "chamfer": "bool"};
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
    });
    const innerStruct = P.struct({
      distance: P.add(P.field(child1, 'distance'), this.uniform('thickness')),
      color: P.field(child1, 'color'),
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
  constructor(distance = 1.0, children = []) {
    super("Offset");
    this.distance = distance;
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
  constructor(k = 2.0, alongAxis = false, axis = new Vec3(0, 0, 1), children = []) {
    super("Scale");
    this.k = k;
    this.alongAxis = alongAxis;
    this.axis = axis instanceof Vec3 ? axis : new Vec3(axis[0], axis[1], axis[2]);
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
  constructor(height = 100.0, axis = new Vec3(0, 0, 1), children = []) {
    super("Twist");
    this.height = height;
    this.axis = axis instanceof Vec3 ? axis : new Vec3(axis[0], axis[1], axis[2]);
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
    
    // TODO: "maxScale" here should be propagated as a Lipschitz factor
    // instead of dividing (maybe?)
    return P.struct({
      distance: P.div(P.field(child, 'distance'), maxScale),
      color: P.field(child, 'color'),
      uniqueId: P.field(child, 'uniqueId'),
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
    this.blendRadius = 0.0;
    this.chamfer = false;
    this.addChild(children);
  }

  properties() {
    return {"plane": ["XY", "XZ", "YZ"], "keepOriginal": "bool", "blendRadius": "float", "chamfer": "bool"};
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
  constructor(axis = new Vec3(0, 0, 1), spacing = 100.0, copies = 2, children = []) {
    super("LinearPattern");
    this.maxChildren = 1;
    this.axis = axis instanceof Vec3 ? axis : new Vec3(axis[0], axis[1], axis[2]);
    this.spacing = spacing;
    this.copies = copies;
    this.blendRadius = 0.0;
    this.chamfer = false;
    this.addChild(children);
  }

  properties() {
    return {"axis": "vec3", "spacing": "float", "copies": "int", "blendRadius": "float", "chamfer": "bool"};
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
  constructor(copies = 2, axis = new Vec3(0, 0, 1), angle = 360.0, children = []) {
    super("PolarPattern");
    this.maxChildren = 1;
    this.copies = copies;
    this.axis = axis instanceof Vec3 ? axis : new Vec3(axis[0], axis[1], axis[2]);
    this.angle = angle;
    this.blendRadius = 0.0;
    this.chamfer = false;
    this.addChild(children);
  }

  properties() {
    return {"copies": "int", "axis": "vec3", "angle": "float", "blendRadius": "float", "chamfer": "bool"};
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
    this.blendRadius = 0.0;
    this.chamfer = false;
    this.draftAngle = 0.0;
    this.axis = new Vec3(0, 0, 1);
    this.addChild(children);
  }

  properties() {
    return {"height": "float", "axis": "vec3", "blendRadius": "float", "chamfer": "bool", "draftAngle": "float"};
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
  constructor(amplitude = 1.0, children = []) {
    super("DistanceDeformInside");
    this.amplitude = amplitude;
    this.maxChildren = 2;
    this.addChild(children);
  }

  properties() {
    return {"amplitude": "float", "blendRadius": "float", "chamfer": "bool"};
  }

  makePeptide(p) {
    if (this.children.length < 1) {
      this.warn("DistanceDeformInside node has no child to transform");
      return this.noop();
    }
    if (this.children.length == 1) {
      this.warn("DistanceDeformInside node needs a second child to specify the space to deform");
      return this.children[0].peptide(p);
    }
    const d0 = this.children[0].peptide(p);
    if (!d0) return null;
    const d1 = this.children[1].peptide(p);
    if (!d1) return d0;
    return P.struct({
      distance: P.add(P.field(d0, 'distance'), this.min(P.mul(P.field(d1, 'distance'), this.uniform('amplitude')), P.zero())),
      color: P.field(d0, 'color'),
      uniqueId: P.field(d0, 'uniqueId'),
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
    this.blendRadius = 0.0;
    this.chamfer = false;
    this.addChild(children);
  }

  properties() {
    return {
      "height": "float", 
      "radius": "float", 
      "pitch": "float", 
      "turns": "float",
      "blendRadius": "float", 
      "chamfer": "bool"
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
    });
  }
  
  getIcon() {
    return "🌀";
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { TransformNode, DomainDeformNode, DistanceDeformNode, ShellNode,
    InfillNode, OffsetNode, ScaleNode, TwistNode, MirrorNode, LinearPatternNode,
    PolarPatternNode, ExtrudeNode, RevolveNode, DistanceDeformInsideNode, HelixExtrudeNode };
  
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