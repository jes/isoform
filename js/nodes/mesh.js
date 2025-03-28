class MeshNode extends TreeNode {
  constructor(triangles) {
    super("Mesh");
    this.triangles = triangles || [];
    this.maxChildren = 0; // Meshes are primitives, no children
    this.exactness = "Exact"; // Triangle distance is exact
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
    
    // Return minimum distance to any triangle
    return distances.reduce((min, current) => P.min(min, current));
  }

  distanceToTriangle(p, a, b, c) {
    // Edge vectors
    const ab = P.vsub(b, a);
    const bc = P.vsub(c, b);
    const ca = P.vsub(a, c);
    
    // Normal vector of the triangle (not normalized)
    const normal = P.vcross(ab, P.vsub(c, a));
    const normalLength = P.vlength(normal);
    
    // Normalized normal (add small epsilon to avoid division by zero)
    const normalNorm = P.vdiv(normal, P.max(normalLength, P.const(1e-10)));
    
    // Calculate signed distance to plane
    const pa = P.vsub(p, a);
    const signedDist = P.vdot(pa, normalNorm);
    
    // Project point onto triangle plane
    const projected = P.vsub(p, P.vmul(normalNorm, signedDist));
    
    // Check if point is inside the triangle using barycentric coordinates
    // We'll use a simplified approach
    
    // Calculate edge test vectors
    const e1 = P.vcross(P.vsub(projected, a), P.vsub(b, a));
    const e2 = P.vcross(P.vsub(projected, b), P.vsub(c, b));
    const e3 = P.vcross(P.vsub(projected, c), P.vsub(a, c));
    
    // Test if point is on the same side of all edges
    const d1 = P.vdot(e1, normal);
    const d2 = P.vdot(e2, normal);
    const d3 = P.vdot(e3, normal);
    
    // Check if all signs are the same (all negative or all positive)
    // Using step function: step(edge, value) returns 1 if value >= edge, 0 otherwise
    const s1 = P.step(P.const(0), d1);
    const s2 = P.step(P.const(0), d2);
    const s3 = P.step(P.const(0), d3);
    
    // Point is inside if all s values are the same (either all 0 or all 1)
    // We can test this with: s1*s2*s3 + (1-s1)*(1-s2)*(1-s3)
    const allPos = P.mul(P.mul(s1, s2), s3);
    const allNeg = P.mul(P.mul(P.sub(P.const(1), s1), P.sub(P.const(1), s2)), P.sub(P.const(1), s3));
    const isInside = P.add(allPos, allNeg);
    
    // Calculate edge distances
    const edgeDist1 = this.distanceToEdge(p, a, b);
    const edgeDist2 = this.distanceToEdge(p, b, c);
    const edgeDist3 = this.distanceToEdge(p, c, a);
    const minEdgeDist = P.min(edgeDist1, P.min(edgeDist2, edgeDist3));
    
    // If inside, use signed plane distance, otherwise use edge distance
    // mix(a, b, t) = a*(1-t) + b*t
    // So if isInside=1, we get P.abs(signedDist), otherwise we get minEdgeDist
    return P.mix(minEdgeDist, P.abs(signedDist), isInside);
  }

  distanceToEdge(p, a, b) {
    const ab = P.vsub(b, a);
    const ap = P.vsub(p, a);
    
    // Project ap onto ab
    const t = P.clamp(
      P.div(P.vdot(ap, ab), P.max(P.vdot(ab, ab), P.const(1e-10))),
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
    
    return new AABB(min, max);
  }
}
