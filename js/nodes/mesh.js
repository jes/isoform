class MeshNode extends TreeNode {
  constructor(triangles) {
    super("Mesh");
    this.triangles = triangles || [];
    this.maxChildren = 0; // Meshes are primitives, no children
    this.exactness = "Exact"; // Triangle distance is exact
    
    // Add property for mesh thickness/smoothing
    this.thickness = 0.1;
  }

  makePeptide(p) {
    if (!this.triangles || this.triangles.length === 0) {
      return P.const(1000); // Return large distance if no triangles
    }
    
    // Calculate distance to each triangle and take minimum
    let distances = [];
    
    for (let i = 0; i < this.triangles.length; i++) {
      const tri = this.triangles[i];
      // Triangle vertices
      const a = P.vconst(tri[0]);
      const b = P.vconst(tri[1]);
      const c = P.vconst(tri[2]);
      
      // Calculate distance to triangle
      const triDist = this.distanceToTriangle(p, a, b, c);
      distances.push(triDist);
    }
    
    // Return minimum distance to any triangle with a thickness offset
    // This helps fill small gaps between triangles
    const minDist = distances.reduce((min, current) => P.min(min, current));
    return P.sub(minDist, P.const(this.thickness));
  }

  distanceToTriangle(p, a, b, c) {
    // Edge vectors
    const ab = P.vsub(b, a);
    const bc = P.vsub(c, b);
    const ca = P.vsub(a, c);
    
    // Normal vector of the triangle
    const normal = P.vcross(ab, P.vsub(c, a));
    const normalLength = P.vlength(normal);
    
    // Normalized normal with increased epsilon to avoid division by zero
    const normalNorm = P.vdiv(normal, P.max(normalLength, P.const(1e-5)));
    
    // Calculate signed distance to plane
    const pa = P.vsub(p, a);
    const signedDist = P.vdot(pa, normalNorm);
    
    // Project point onto triangle plane
    const projected = P.vsub(p, P.vmul(normalNorm, signedDist));
    
    // Calculate edge distances
    const edgeDist1 = this.distanceToEdge(p, a, b);
    const edgeDist2 = this.distanceToEdge(p, b, c);
    const edgeDist3 = this.distanceToEdge(p, c, a);
    const minEdgeDist = P.min(edgeDist1, P.min(edgeDist2, edgeDist3));
    
    // Check if projected point is inside triangle
    // Using more robust edge tests
    const ap = P.vsub(projected, a);
    const bp = P.vsub(projected, b);
    const cp = P.vsub(projected, c);
    
    // Cross products for each edge with the projected point
    const cross1 = P.vcross(ab, ap);
    const cross2 = P.vcross(bc, bp);
    const cross3 = P.vcross(ca, cp);
    
    // Dot products with normal to check if they point in the same hemisphere
    // Use a more forgiving test with larger epsilon
    const d1 = P.vdot(cross1, normal);
    const d2 = P.vdot(cross2, normal);
    const d3 = P.vdot(cross3, normal);
    
    // Larger epsilon for more robust testing
    const s1 = P.step(P.const(-1e-4), d1);
    const s2 = P.step(P.const(-1e-4), d2);
    const s3 = P.step(P.const(-1e-4), d3);
    
    // Point is inside if all values are positive
    const isInside = P.mul(P.mul(s1, s2), s3);
    
    // Use a robust SDF that smoothly blends between the plane distance and edge distance
    // This helps prevent holes at triangle edges and corners
    const planeDist = P.abs(signedDist);
    const blendedDist = P.mix(minEdgeDist, planeDist, isInside);
    
    // Add a small bias to help close any tiny gaps between triangles
    return blendedDist;
  }

  distanceToEdge(p, a, b) {
    const ab = P.vsub(b, a);
    const ap = P.vsub(p, a);
    
    // Project ap onto ab with better numerical stability
    const t = P.clamp(
      P.div(P.vdot(ap, ab), P.max(P.vdot(ab, ab), P.const(1e-5))),
      P.const(0), P.const(1)
    );
    
    // Calculate closest point on segment
    const closest = P.vadd(a, P.vmul(ab, t));
    
    // Return distance to closest point
    return P.vlength(P.vsub(p, closest));
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
