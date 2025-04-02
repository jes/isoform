class MeshNode extends TreeNode {
  constructor(mesh) {
    super("Mesh");
    this.mesh = mesh;
    this.maxChildren = 0; // Meshes are primitives, no children
  }

  makePeptide(p) {
    // Initialize with a large positive value
    let minDist = P.const(1e10);
    // Initialize sign to 1.0
    let sign = P.const(1.0);

    for (let i = 0; i < this.mesh.triangles.length; i++) {
      const tri = this.mesh.triangles[i];
      const [dist, newSign] = this.distanceToTriangle(p, tri, sign);
      minDist = P.min(minDist, dist);
      sign = newSign;
    }

    const distance = P.mul(minDist, sign);
    return P.struct({distance});
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
    
    // Calculate barycentric coordinates directly
    // We'll use vector operations to compute them
    
    // Vectors from v1 to projected point and other vertices
    const v0 = edge1; // v2 - v1
    const v1v3 = edge2; // v3 - v1
    const vp = P.vsub(projP, v1); // projP - v1
    
    // Compute dot products for the barycentric calculation
    const d00 = P.vdot(v0, v0);
    const d01 = P.vdot(v0, v1v3);
    const d11 = P.vdot(v1v3, v1v3);
    const d20 = P.vdot(vp, v0);
    const d21 = P.vdot(vp, v1v3);
    
    // Calculate denominator for barycentric coordinates
    const denom = P.sub(P.mul(d00, d11), P.mul(d01, d01));
    
    // Calculate barycentric coordinates
    const v = P.div(P.sub(P.mul(d11, d20), P.mul(d01, d21)), denom);
    const w = P.div(P.sub(P.mul(d00, d21), P.mul(d01, d20)), denom);
    const u = P.sub(P.one(), P.add(v, w));
    
    // Point is inside if all barycentric coordinates are between 0 and 1
    const isUPositive = P.gte(u, P.zero());
    const isVPositive = P.gte(v, P.zero());
    const isWPositive = P.gte(w, P.zero());
    const isULessOne = P.lte(u, P.one());
    const isVLessOne = P.lte(v, P.one());
    const isWLessOne = P.lte(w, P.one());
    
    // Combine all conditions
    return P.and(P.and(isUPositive, isVPositive), 
                 P.and(isWPositive, 
                       P.and(isULessOne, 
                             P.and(isVLessOne, isWLessOne))));
  }

  rayIntersectsTriangle(p, v1, v2, v3) {
    // Calculate triangle normal
    const edge1 = P.vsub(v2, v1);
    const edge2 = P.vsub(v3, v1);
    const normal = P.vnormalize(P.vcross(edge1, edge2));
    
    // Ray direction (arbitrary - non-axis-aligned to avoid numerical issues)
    const rayDir = P.vconst(new Vec3(0.1246345, 0.12343434, 1234234).normalize());
    
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
    if (!this.mesh || this.mesh.triangles.length === 0) {
      return AABB.empty();
    }
    
    // Initialize min and max with first vertex
    let min = this.mesh.triangles[0][0].clone();
    let max = this.mesh.triangles[0][0].clone();
    
    // Check all vertices to find min and max coordinates
    for (let i = 0; i < this.mesh.triangles.length; i++) {
      const tri = this.mesh.triangles[i];
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
