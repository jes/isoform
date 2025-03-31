class VoxelNode extends TreeNode {
  constructor() {
    super("Voxel");
    this.size = 16; // Number of voxels along each axis
    // Default AABB from (-1,-1,-1) to (1,1,1)
    this.aabbBox = new AABB(new Vec3(-1, -1, -1), new Vec3(1, 1, 1));
    // Initialize voxels as a Texture3D object
    this.voxelTexture = new Texture3D(
      new Array(this.size * this.size * this.size).fill(0),
      [this.size, this.size, this.size]
    );
    this.maxChildren = 0; // Primitive node
  }

  static fromMesh(mesh) {
    const meshNode = new MeshNode(mesh);
    return VoxelNode.fromTreeNode(meshNode);
  }

  static fromTreeNode(treeNode) {
    const voxelNode = new VoxelNode();
    voxelNode.fillFromTreeNode(treeNode);
    return voxelNode;
  }

  texture3d() {
    return this.voxelTexture;
  }

  aabb() {
    return this.aabbBox;
  }

<<<<<<< HEAD
=======
  boxSDF(p, size) {
    // This should calculate the SDF for a box centered at the origin
    // with dimensions given by size
    const halfSize = P.vdiv(P.vconst(size), P.const(2.0));
    
    // Same formula as in BoxNode without radius
    // vec3 d = abs(p) - b/2.0;
    // return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
    const d = P.vsub(P.vabs(p), halfSize);
    return P.add(
      P.vlength(P.vmax(d, P.vconst(new Vec3(0.0)))),
      P.min(P.max(P.vecX(d), P.max(P.vecY(d), P.vecZ(d))), P.zero())
    );
  }

>>>>>>> 9ae66c6 (Start of mesh simplification)
  makePeptide(p) {
    // Get the normalized position within the AABB
    const size = this.aabb().getSize();
    const min = this.aabb().min;
    
<<<<<<< HEAD
    // Normalize position to 0-1 range for texture sampling
    // Split into component-wise division since vdiv expects a scalar second operand
=======
    // Calculate distance to the outside of the bounding box
    // This is negative inside the box, positive outside
    const outsideDist = this.boxSDF(p, size);
    
    // Normalize position to 0-1 range for texture sampling
>>>>>>> 9ae66c6 (Start of mesh simplification)
    const posMinusMin = P.vsub(p, P.vconst(min));
    const sizeVec = P.vconst(size);
    
    // Perform component-wise division
    const normalizedPos = P.vec3(
      P.div(P.vecX(posMinusMin), P.vecX(sizeVec)),
      P.div(P.vecY(posMinusMin), P.vecY(sizeVec)),
      P.div(P.vecZ(posMinusMin), P.vecZ(sizeVec))
    );
    
<<<<<<< HEAD
    // Sample the texture at the normalized position
    return P.texture3d(this.uniformTexture3d("voxelTexture"), normalizedPos);
=======
    // Sample the texture at the normalized position (inside distance)
    const insideDist = P.texture3d(this.uniformTexture3d("voxelTexture"), normalizedPos);
    
    // Return the larger of the two distances
    // This ensures correct distance both inside and outside the voxel grid
    return P.max(insideDist, outsideDist);
>>>>>>> 9ae66c6 (Start of mesh simplification)
  }

  fillFromTreeNode(treeNode) {
    const sdf = treeNode.getSDF();
    this.aabbBox = treeNode.aabb().clone();
    
    // Create a new array for the voxel data
    const voxelData = new Array(this.size * this.size * this.size).fill(0);
    
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        for (let k = 0; k < this.size; k++) {
          const index = i + j * this.size + k * this.size * this.size;
          voxelData[index] = sdf(this.voxelToWorld(i, j, k));
        }
      }
    }
    
    // Update the texture with the new data
    this.voxelTexture = new Texture3D(voxelData, [this.size, this.size, this.size]);
  }

  // Convert world coordinates to voxel grid coordinates
  worldToVoxel(worldPos) {
    // Handle both Vec3 and separate x,y,z parameters
    const pos = worldPos instanceof Vec3 ? worldPos : new Vec3(worldPos, arguments[1], arguments[2]);
    
    const size = this.aabb().getSize();
    const min = this.aabb().min;
    
    // Calculate the normalized position within the AABB (0 to 1)
    // Use the appropriate dimension for each coordinate
    const normalizedX = (pos.x - min.x) / size.x * this.size;
    const normalizedY = (pos.y - min.y) / size.y * this.size;
    const normalizedZ = (pos.z - min.z) / size.z * this.size;
    
    // Convert to voxel coordinates (0 to this.size-1)
    return {
      x: Math.floor(normalizedX),
      y: Math.floor(normalizedY),
      z: Math.floor(normalizedZ)
    };
  }
  
  // Convert voxel grid coordinates to world coordinates (returns center of voxel)
  voxelToWorld(voxelX, voxelY, voxelZ) {
    const size = this.aabb().getSize();
    const min = this.aabb().min;
    const voxelSize = size.div(this.size);
    
    // Calculate the world position (center of the voxel)
    return min.add(new Vec3(
      (voxelX + 0.5) * voxelSize.x,
      (voxelY + 0.5) * voxelSize.y,
      (voxelZ + 0.5) * voxelSize.z
    ));
  }

  // Get voxel value using world coordinates
  getVoxel(worldPos) {
    // Handle both Vec3 and separate x,y,z parameters
    const pos = worldPos instanceof Vec3 ? worldPos : new Vec3(worldPos, arguments[1], arguments[2]);
    const voxel = this.worldToVoxel(pos);
    return this.getVoxelByIndex(voxel.x, voxel.y, voxel.z);
  }
  
  // Set voxel value using world coordinates
  setVoxel(worldPos, value) {
    // Handle both Vec3 and separate x,y,z parameters
    let pos, val;
    if (worldPos instanceof Vec3) {
      pos = worldPos;
      val = value;
    } else {
      pos = new Vec3(worldPos, arguments[1], arguments[2]);
      val = arguments[3];
    }
    
    const voxel = this.worldToVoxel(pos);
    this.setVoxelByIndex(voxel.x, voxel.y, voxel.z, val);
  }
  
  // Helper method to get voxel values using voxel grid indices
  getVoxelByIndex(x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= this.size || y >= this.size || z >= this.size) {
      return 0; // Out of bounds
    }
    const index = x + y * this.size + z * this.size * this.size;
    return this.voxelTexture.data[index];
  }
  
  // Helper method to set voxel values using voxel grid indices
  setVoxelByIndex(x, y, z, value) {
    if (x < 0 || y < 0 || z < 0 || x >= this.size || y >= this.size || z >= this.size) {
      return; // Out of bounds
    }
    const index = x + y * this.size + z * this.size * this.size;
    this.voxelTexture.data[index] = value;
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { VoxelNode };
  
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

