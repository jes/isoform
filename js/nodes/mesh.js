class MeshNode extends TreeNode {
  constructor(triangles) {
    super("Mesh");
    this.triangles = triangles || [];
    this.maxChildren = 0; // Meshes are primitives, no children
  }

  makePeptide(p) {
    // Initialize with a large positive value
    let minDist = P.const(1e10);
    // Initialize sign to 1.0
    let sign = P.const(1.0);

    for (let i = 0; i < this.triangles.length; i++) {
      const tri = this.triangles[i];
      const [dist, newSign] = this.distanceToTriangle(p, tri, sign);
      minDist = P.min(minDist, dist);
      sign = newSign;
    }

    return P.mul(minDist, sign);
  }

  distanceToTriangle(p, tri, sign) {
    const a = P.vconst(tri[0]);
    const b = P.vconst(tri[1]);
    const c = P.vconst(tri[2]);

    // distances to vertices
    const distA = this.distanceToVertex(p, a);
    const distB = this.distanceToVertex(p, b);
    const distC = this.distanceToVertex(p, c);
    const distVertices = P.min(distA, P.min(distB, distC));

    // distances to edges
    const distAB = this.distanceToEdge(p, a, b);
    const distBC = this.distanceToEdge(p, b, c);
    const distCA = this.distanceToEdge(p, c, a);
    const distEdges = P.min(distAB, P.min(distBC, distCA));

    // distance to triangle plane
    const distPlane = this.distanceToPlane(p, a, b, c);
    const isInPlane = this.isWithinTriangle(p, a, b, c);

    // the distance to the triangle is the minimum of the distances to the
    // vertices, edges, and plane, but distance to plane is only considered
    // if the point is within the triangle
    const dist2 = P.min(distVertices, distEdges);
    const dist3 = P.min(dist2, distPlane);
    const dist = P.mix(dist2, dist3, isInPlane);

    // invert the sign if a ray from p to infinity intersects this triangle
    const rayIntersects = this.rayIntersectsTriangle(p, a, b, c);
    sign = P.mix(sign, P.neg(sign), rayIntersects);

    return [dist, sign];
  }

  distanceToVertex(p, v) {
    return P.vlength(P.vsub(p, v));
  }

  distanceToEdge(p, v1, v2) {
    const edge = P.vsub(v2, v1);
    const pv1 = P.vsub(p, v1);
    
    // Project point onto edge line
    const t = P.clamp(P.div(P.vdot(pv1, edge), P.vdot(edge, edge)), P.const(0.0), P.const(1.0));
    
    // Point on the edge
    const projection = P.vadd(v1, P.vmul(edge, t));
    
    // Distance from point to the projection on the edge
    return P.vlength(P.vsub(p, projection));
  }

  distanceToPlane(p, v1, v2, v3) {
    // Calculate triangle normal
    const edge1 = P.vsub(v2, v1);
    const edge2 = P.vsub(v3, v1);
    const normal = P.vnormalize(P.vcross(edge1, edge2));
    
    // Distance from point to plane
    return P.abs(P.vdot(P.vsub(p, v1), normal));
  }

  isWithinTriangle(p, v1, v2, v3) {
    // Calculate triangle normal
    const edge1 = P.vsub(v2, v1);
    const edge2 = P.vsub(v3, v1);
    const normal = P.vnormalize(P.vcross(edge1, edge2));
    
    // Project point onto triangle plane
    const dist = P.vdot(P.vsub(p, v1), normal);
    const projP = P.vsub(p, P.vmul(normal, dist));
    
    // Check if projected point is inside triangle using barycentric coordinates
    const area = P.vlength(P.vcross(P.vsub(v2, v1), P.vsub(v3, v1)));
    
    const area1 = P.vlength(P.vcross(P.vsub(v2, projP), P.vsub(v3, projP)));
    const area2 = P.vlength(P.vcross(P.vsub(v3, projP), P.vsub(v1, projP)));
    const area3 = P.vlength(P.vcross(P.vsub(v1, projP), P.vsub(v2, projP)));
    
    const sum = P.add(P.add(area1, area2), area3);
    
    // Allow for some floating-point error
    return P.lte(P.abs(P.sub(sum, area)), P.const(1e-5));
  }

  rayIntersectsTriangle(p, v1, v2, v3) {
    // Calculate triangle normal
    const edge1 = P.vsub(v2, v1);
    const edge2 = P.vsub(v3, v1);
    const normal = P.vnormalize(P.vcross(edge1, edge2));
    
    // Ray direction (assuming ray from point in +Z direction)
    const rayDir = P.vconst(new Vec3(0, 0, 1));
    
    // Check if ray is parallel to triangle
    const ndotray = P.vdot(normal, rayDir);
    
    // If ray is parallel to triangle, no intersection
    const isParallel = P.eq(ndotray, P.const(0.0));
    
    // Calculate intersection point
    const d = P.vdot(normal, v1);
    const t = P.div(P.sub(d, P.vdot(normal, p)), ndotray);
    
    // Check if intersection is behind the ray origin
    const isBehind = P.lte(t, P.const(0.0));
    
    // Calculate intersection point
    const intersection = P.vadd(p, P.vmul(rayDir, t));
    
    // Check if intersection point is inside triangle
    const isInside = this.isWithinTriangle(intersection, v1, v2, v3);
    
    // Ray intersects triangle if it's not parallel, not behind, and inside triangle
    return P.and(P.not(isParallel), P.and(P.not(isBehind), isInside));
  }

  aabb() {
    if (!this.triangles || this.triangles.length === 0) {
      return AABB.empty();
    }
    
    // Initialize min and max with first vertex
    let min = this.triangles[0][0].clone();
    let max = this.triangles[0][0].clone();
    
    // Check all vertices to find min and max coordinates
    for (let i = 0; i < this.triangles.length; i++) {
      const tri = this.triangles[i];
      for (let j = 0; j < 3; j++) {
        const v = tri[j];
        min.x = Math.min(min.x, v.x);
        min.y = Math.min(min.y, v.y);
        min.z = Math.min(min.z, v.z);
        
        max.x = Math.max(max.x, v.x);
        max.y = Math.max(max.y, v.y);
        max.z = Math.max(max.z, v.z);
      }
    }
    
    // Expand the AABB slightly to account for thickness
    const expand = this.thickness || 0.1;
    min.x -= expand;
    min.y -= expand;
    min.z -= expand;
    max.x += expand;
    max.y += expand;
    max.z += expand;
    
    return new AABB(min, max);
  }
}
