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

    return P.div(this.children[0].peptide(P.vadd(p, P.vec3(P.add(px1, px2), P.add(py1, py2), P.add(pz1, pz2)))), P.const(Math.max(1.0, 2.0 * this.frequency * this.amplitude)));
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
    return P.div(P.add(d, P.mul(ampl, P.add(noise1, noise2))), P.const(Math.max(1.0, 2.0 * this.frequency * this.amplitude)));
  }

  getIcon() {
    return "〰️";
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
    
    const d = this.children[0].peptide(p);
    const negD = P.sub(P.const(0), d);
    
    if (this.shellType === "inside") {
      return P.max(d, P.sub(negD, P.const(this.thickness)));
    } else if (this.shellType === "centered") {
      const halfThickness = P.const(this.thickness / 2);
      return P.max(
        P.sub(d, halfThickness), 
        P.sub(negD, halfThickness)
      );
    } else { // "outside" (default)
      return P.max(P.sub(d, P.const(this.thickness)), negD);
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
}

class InfillNode extends TreeNode {
  constructor(thickness = 1.0, children = []) {
    super("Infill");
    this.thickness = thickness;
    this.maxChildren = 2;
    this.addChild(children);
  }

  properties() {
    return {"thickness": "float"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("Infill node has no child to transform");
      return this.noop();
    }

    const d = this.children[0].peptide(p);
    const negD = P.sub(P.const(0), d);
    const dShell = P.max(d, P.sub(negD, P.const(this.thickness)));
    if (this.children.length == 1) {
      return d;
    }

    const d2 = this.children[1].peptide(p);
    return P.min(dShell, P.max(d, d2));
  }

  getIcon() {
    return "🔍";
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

    return P.add(this.children[0].peptide(p), P.const(this.distance));
  }

  getIcon() {
    return "🔍";
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

  properties() {
    return {"height": "float", "axis": "vec3"};
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
    const angle = P.mul(P.const(-2.0 * Math.PI), P.div(P.vecZ(q), P.const(this.height)));
    const c = P.cos(angle);
    const s = P.sin(angle);
    const q2 = P.vec3(P.sub(P.mul(c, P.vecX(q)), P.mul(s, P.vecY(q))),
                      P.add(P.mul(s, P.vecX(q)), P.mul(c, P.vecY(q))),
                      P.vecZ(q));
    const p2 = P.mvmul(fromAxisSpace, q2);
    return this.children[0].peptide(p2);
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
      pMirrored = P.vec3(P.vecX(p), P.vecY(p), P.sub(P.const(0), P.vecZ(p)));
    } else if (this.plane === "XZ") {
      pMirrored = P.vec3(P.vecX(p), P.sub(P.const(0), P.vecY(p)), P.vecZ(p));
    } else {
      pMirrored = P.vec3(P.sub(P.const(0), P.vecX(p)), P.vecY(p), P.vecZ(p));
    }
    
    const mirrored = this.children[0].peptide(pMirrored);

    if (this.keepOriginal) {
      const original = this.children[0].peptide(p);
      return this.min(original, mirrored);
    } else {
      return mirrored;
    }
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
    this.blendRadius = 0.0;
    this.chamfer = false;
    this.addChild(children);
  }

  properties() {
    return {"axis": "vec3", "spacing": "float", "copies": "int", "blendRadius": "float", "chamfer": "bool"};
  }

  makePeptide(p) {
    if (!this.hasChildren()) {
      this.warn("LinearPattern node has no child");
      return this.noop();
    }
    
    if (this.copies < 1) {
      return this.noop();
    }

    const step = this.axis.normalize().mul(this.spacing);
    let d = this.children[0].peptide(p);
    for (let i = 1; i < this.copies; i++) {
      const pi = P.vsub(p, P.vconst(step.mul(i)));
      d = this.min(d, this.children[0].peptide(pi));
    }
    return d;
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

    const totalAngle = this.angle * Math.PI / 180.0; // Convert to radians
    const toAxisSpace = P.mconst(new Mat3().rotateToAxis(this.axis.normalize()));
    const fromAxisSpace = P.mtranspose(toAxisSpace);

    const q = P.mvmul(toAxisSpace, p);
    const angleIncrement = totalAngle / this.copies;
    let d = this.children[0].peptide(p);
    for (let i = 1; i < this.copies; i++) {
      const angle = angleIncrement * i;
      const c = P.cos(P.const(angle));
      const s = P.sin(P.const(angle));
      const rotated = P.vec3(
        P.sub(P.mul(c, P.vecX(q)), P.mul(s, P.vecY(q))),
        P.add(P.mul(s, P.vecX(q)), P.mul(c, P.vecY(q))),
        P.vecZ(q)
      );
      const p1 = P.mvmul(fromAxisSpace, rotated);
      d = this.min(d, this.children[0].peptide(p1));
    }
    return d;
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
      // carry on anyway
    }
    const p2d = P.vec3(P.vecX(p), P.vecY(p), P.const(0.0));
    const d2d = this.children[0].peptide(p2d);
    const dz = P.sub(P.abs(P.vecZ(p)), P.const(this.height/2));
    const pz = P.clamp(P.add(P.vecZ(p), P.const(this.height/2)), P.const(0.0), P.const(this.height));
    const d = P.add(P.mul(d2d, P.const(Math.cos(this.draftAngle * Math.PI / 180.0))), P.mul(pz, P.const(Math.tan(this.draftAngle * Math.PI / 180.0))));
    return this.max(d, dz);
  }
  
  getIcon() {
    return "⬆️";
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
    return {"amplitude": "float"};
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
    const dist = this.children[1].peptide(p);
    return P.add(this.children[0].peptide(p), P.min(P.mul(dist, P.const(this.amplitude)), P.const(0.0)));
  }
  
  getIcon() {
    return "🔍";
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

    const axis = this.axis.normalize();
    
    // Project p onto the axis to get the closest point on the axis
    const axisP = P.vconst(axis);
    const projDist = P.vdot(p, axisP);
    const projPoint = P.vmul(axisP, projDist);
    
    // Vector from the axis to the point
    const toPoint = P.vsub(p, projPoint);
    
    // Distance from the axis (radius in cylindrical coordinates)
    const radius = P.vlength(toPoint);
    
    // Create a 2D point in the XY plane where:
    // X = distance from axis (radius)
    // Y = distance along axis (height)
    const p2d = P.vec3(radius, projDist, P.const(0.0));
    
    return this.children[0].peptide(p2d);
  }

  getIcon() {
    return "🔄";
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { TransformNode, DomainDeformNode, DistanceDeformNode, ShellNode,
    InfillNode, OffsetNode, ScaleNode, TwistNode, MirrorNode, LinearPatternNode,
    PolarPatternNode, ExtrudeNode, RevolveNode, DistanceDeformInsideNode };
  
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