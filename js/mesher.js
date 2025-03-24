class Mesher {
    constructor(peptideExpr, options = {}) {
        this.peptideExpr = peptideExpr;
        this.resolution = options.resolution || 48;
        this.bounds = options.bounds || { min: new Vec3(-30, -30, -30), max: new Vec3(30, 30, 30) };
        this.isoLevel = options.isoLevel || 0.0;
        this.vertices = [];
        this.triangles = [];
        this.sdf = null;
    }

    // Evaluate the SDF at a specific point
    evaluateSDF(p) {
        if (this.peptideExpr && !this.sdf) {
            // compile to JS on first use
            const ssa = new PeptideSSA(this.peptideExpr);
            const fn = eval(ssa.compileToJS());
            this.sdf = (p) => fn({p: p});
        }

        if (this.sdf) {
            return this.sdf(p);
        }

        throw new Error("No peptide expression");
    }

    // Generate the mesh using marching cubes algorithm
    generateMesh() {
        console.log("Generating mesh...");
        const { resolution, bounds } = this;
        
        // Calculate cell size using Vec3 operations
        const cellSize = bounds.max.sub(bounds.min).div(resolution);

        // Create a 3D grid of SDF values
        const grid = new Array(resolution + 1).fill().map(() => 
            new Array(resolution + 1).fill().map(() => 
                new Array(resolution + 1).fill(0)
            )
        );

        // Fill the grid with SDF values
        console.log("Sampling SDF values...");
        for (let i = 0; i <= resolution; i++) {
            for (let j = 0; j <= resolution; j++) {
                for (let k = 0; k <= resolution; k++) {
                    const position = bounds.min.add(new Vec3(i, j, k).mul(cellSize));
                    grid[i][j][k] = this.evaluateSDF(position);
                }
            }
            
            // Progress indicator
            if (i % 10 === 0) {
                console.log(`Sampling progress: ${Math.floor((i / resolution) * 100)}%`);
            }
        }

        // Run marching cubes
        console.log("Running marching cubes algorithm...");
        this.vertices = [];
        this.triangles = [];
        
        // Process each cell in the grid
        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                for (let k = 0; k < resolution; k++) {
                    this.processCube(i, j, k, grid, cellSize);
                }
            }
            
            // Progress indicator
            if (i % 10 === 0) {
                console.log(`Marching cubes progress: ${Math.floor((i / resolution) * 100)}%`);
            }
        }
        
        console.log(`Mesh generation complete: ${this.vertices.length} vertices, ${this.triangles.length} triangles`);
        return {
            vertices: this.vertices,
            triangles: this.triangles
        };
    }

    // Process a single cube in the grid
    processCube(i, j, k, grid, cellSize) {
        // Define the 8 corners of the cube in a consistent order
        const cornerIndices = [
            [i, j, k],         // 0: bottom-left-back
            [i+1, j, k],       // 1: bottom-right-back
            [i+1, j, k+1],     // 2: bottom-right-front
            [i, j, k+1],       // 3: bottom-left-front
            [i, j+1, k],       // 4: top-left-back
            [i+1, j+1, k],     // 5: top-right-back
            [i+1, j+1, k+1],   // 6: top-right-front
            [i, j+1, k+1]      // 7: top-left-front
        ];
        
        // Get the SDF values at each corner
        const cornerValues = cornerIndices.map(idx => grid[idx[0]][idx[1]][idx[2]]);
        
        // Determine which corners are inside the surface (value <= isoLevel)
        let cubeIndex = 0;
        for (let n = 0; n < 8; n++) {
            if (cornerValues[n] <= this.isoLevel) {
                cubeIndex |= (1 << n);
            }
        }
        
        // If the cube is entirely inside or outside the surface, there's no intersection
        if (cubeIndex === 0 || cubeIndex === 255) return;
        
        // Get the edges that are intersected by the surface
        const edgeTable = MarchingCubesTables.EDGE_TABLE[cubeIndex];
        
        // Define the 12 edges of the cube
        const edgeVertices = MarchingCubesTables.EDGES;
        
        // Calculate intersection points for each edge
        const intersections = new Array(12);
        for (let e = 0; e < 12; e++) {
            if (edgeTable & (1 << e)) {
                const v0 = edgeVertices[e][0];
                const v1 = edgeVertices[e][1];
                
                const val0 = cornerValues[v0];
                const val1 = cornerValues[v1];
                
                // Skip if both values are the same (avoid division by zero)
                if (Math.abs(val1 - val0) < 1e-6) {
                    // Use midpoint if values are nearly identical
                    const t = 0.5;
                    const idx0 = cornerIndices[v0];
                    const idx1 = cornerIndices[v1];
                    
                    // Calculate world position using Vec3 operations
                    const pos0 = new Vec3(idx0[0], idx0[1], idx0[2]);
                    const pos1 = new Vec3(idx1[0], idx1[1], idx1[2]);
                    const interpolated = pos0.mul(1-t).add(pos1.mul(t));
                    const worldPos = this.bounds.min.add(interpolated.mul(cellSize));
                    
                    intersections[e] = worldPos;
                } else {
                    // Calculate interpolation factor
                    let t = (this.isoLevel - val0) / (val1 - val0);
                    // Ensure t is in [0,1]
                    t = Math.max(0, Math.min(1, t));
                    
                    const idx0 = cornerIndices[v0];
                    const idx1 = cornerIndices[v1];
                    
                    // Calculate world position using Vec3 operations
                    const pos0 = new Vec3(idx0[0], idx0[1], idx0[2]);
                    const pos1 = new Vec3(idx1[0], idx1[1], idx1[2]);
                    const interpolated = pos0.mul(1-t).add(pos1.mul(t));
                    const worldPos = this.bounds.min.add(interpolated.mul(cellSize));
                    
                    intersections[e] = worldPos;
                }
            }
        }
        
        // Create triangles using the triangle table
        const triangleTable = MarchingCubesTables.TRIANGLE_TABLE[cubeIndex];
        for (let t = 0; triangleTable[t] !== -1; t += 3) {
            const v1 = intersections[triangleTable[t]];
            const v2 = intersections[triangleTable[t+1]];
            const v3 = intersections[triangleTable[t+2]];
            
            // Skip invalid or degenerate triangles
            if (!v1 || !v2 || !v3 || 
                (v1.sub(v2).length() < 1e-6) || 
                (v2.sub(v3).length() < 1e-6) || 
                (v3.sub(v1).length() < 1e-6)) {
                console.warn("Skipping degenerate triangle");
                continue;
            }
            
            // Add vertices and triangle
            const baseIndex = this.vertices.length;
            this.vertices.push(v1, v2, v3);
            this.triangles.push([baseIndex, baseIndex+1, baseIndex+2]);
        }
    }

    // Export the mesh as an STL file
    exportSTL(filename = 'mesh.stl') {
        if (this.vertices.length === 0 || this.triangles.length === 0) {
            console.error("No mesh data to export. Call generateMesh() first.");
            return;
        }

        console.log("Generating STL data...");
        
        // STL file header (80 bytes)
        let stlData = 'solid exported\n';
        
        // Process each triangle
        for (let i = 0; i < this.triangles.length; i++) {
            const triangle = this.triangles[i];
            // Make sure we have valid indices and vertices
            if (triangle.length !== 3 || 
                !this.vertices[triangle[0]] || 
                !this.vertices[triangle[1]] || 
                !this.vertices[triangle[2]]) {
                console.warn(`Skipping invalid triangle at index ${i}`);
                continue;
            }
            
            const v1 = this.vertices[triangle[0]];
            const v2 = this.vertices[triangle[1]];
            const v3 = this.vertices[triangle[2]];
            
            // Calculate normal using Vec3 cross product and normalize
            const edge1 = v2.sub(v1);
            const edge2 = v3.sub(v1);
            const normal = edge1.cross(edge2).normalize();
            
            // Add the triangle to the STL data
            stlData += `  facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`;
            stlData += '    outer loop\n';
            stlData += `      vertex ${v1.x.toFixed(6)} ${v1.y.toFixed(6)} ${v1.z.toFixed(6)}\n`;
            stlData += `      vertex ${v2.x.toFixed(6)} ${v2.y.toFixed(6)} ${v2.z.toFixed(6)}\n`;
            stlData += `      vertex ${v3.x.toFixed(6)} ${v3.y.toFixed(6)} ${v3.z.toFixed(6)}\n`;
            stlData += '    endloop\n';
            stlData += '  endfacet\n';
        }
        
        stlData += 'endsolid exported\n';
        
        // Create a download link
        const blob = new Blob([stlData], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`STL file "${filename}" created with ${this.triangles.length} triangles`);
    }

    // Export the mesh as a binary STL file (more compact)
    exportBinarySTL(filename = 'mesh.stl') {
        if (this.vertices.length === 0 || this.triangles.length === 0) {
            console.error("No mesh data to export. Call generateMesh() first.");
            return;
        }

        console.log("Generating binary STL data...");
        
        // Count valid triangles first
        let validTriangles = 0;
        for (let i = 0; i < this.triangles.length; i++) {
            const triangle = this.triangles[i];
            if (triangle.length === 3 && 
                this.vertices[triangle[0]] && 
                this.vertices[triangle[1]] && 
                this.vertices[triangle[2]]) {
                validTriangles++;
            }
        }
        
        // Calculate buffer size: header(80) + triangle count(4) + triangles(50 each)
        const bufferSize = 84 + (validTriangles * 50);
        const buffer = new ArrayBuffer(bufferSize);
        const view = new DataView(buffer);
        
        // Fill header with spaces (80 bytes)
        for (let i = 0; i < 80; i++) {
            view.setUint8(i, 32); // 32 is ASCII for space
        }
        
        // Set triangle count
        view.setUint32(80, validTriangles, true);
        
        // Process each triangle
        let offset = 84; // Start after header and triangle count
        for (let i = 0; i < this.triangles.length; i++) {
            const triangle = this.triangles[i];
            // Skip invalid triangles
            if (triangle.length !== 3 || 
                !this.vertices[triangle[0]] || 
                !this.vertices[triangle[1]] || 
                !this.vertices[triangle[2]]) {
                continue;
            }
            
            const v1 = this.vertices[triangle[0]];
            const v2 = this.vertices[triangle[1]];
            const v3 = this.vertices[triangle[2]];
            
            // Calculate normal
            const edge1 = v2.sub(v1);
            const edge2 = v3.sub(v1);
            const normal = edge1.cross(edge2).normalize();
            
            // Write normal
            view.setFloat32(offset, normal.x, true); offset += 4;
            view.setFloat32(offset, normal.y, true); offset += 4;
            view.setFloat32(offset, normal.z, true); offset += 4;
            
            // Write vertices
            view.setFloat32(offset, v1.x, true); offset += 4;
            view.setFloat32(offset, v1.y, true); offset += 4;
            view.setFloat32(offset, v1.z, true); offset += 4;
            
            view.setFloat32(offset, v2.x, true); offset += 4;
            view.setFloat32(offset, v2.y, true); offset += 4;
            view.setFloat32(offset, v2.z, true); offset += 4;
            
            view.setFloat32(offset, v3.x, true); offset += 4;
            view.setFloat32(offset, v3.y, true); offset += 4;
            view.setFloat32(offset, v3.z, true); offset += 4;
            
            // Attribute byte count (unused, set to 0)
            view.setUint16(offset, 0, true); offset += 2;
        }
        
        // Create a download link
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`Binary STL file "${filename}" created with ${validTriangles} triangles`);
    }

    // Generate mesh from a TreeNode
    static fromTreeNode(node, options = {}) {
        // Create a Peptide expression from the node
        const p = P.vvar('p');
        const peptideExpr = node.peptide(p);
        
        // Create and return a mesher
        return new Mesher(peptideExpr, options);
    }
}

// Marching Cubes lookup tables
class MarchingCubesTables {
    // Edge table - defines which edges are intersected for each cube configuration
    static EDGE_TABLE = [
        0x0, 0x109, 0x203, 0x30a, 0x80c, 0x905, 0xa0f, 0xb06, 
        0x406, 0x50f, 0x605, 0x70c, 0xc0a, 0xd03, 0xe09, 0xf00, 
        0x190, 0x99, 0x393, 0x29a, 0x99c, 0x895, 0xb9f, 0xa96, 
        0x596, 0x49f, 0x795, 0x69c, 0xd9a, 0xc93, 0xf99, 0xe90, 
        0x230, 0x339, 0x33, 0x13a, 0xa3c, 0xb35, 0x83f, 0x936, 
        0x636, 0x73f, 0x435, 0x53c, 0xe3a, 0xf33, 0xc39, 0xd30, 
        0x3a0, 0x2a9, 0x1a3, 0xaa, 0xbac, 0xaa5, 0x9af, 0x8a6, 
        0x7a6, 0x6af, 0x5a5, 0x4ac, 0xfaa, 0xea3, 0xda9, 0xca0, 
        0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc, 0x1c5, 0x2cf, 0x3c6, 
        0xcc6, 0xdcf, 0xec5, 0xfcc, 0x4ca, 0x5c3, 0x6c9, 0x7c0, 
        0x950, 0x859, 0xb53, 0xa5a, 0x15c, 0x55, 0x35f, 0x256, 
        0xd56, 0xc5f, 0xf55, 0xe5c, 0x55a, 0x453, 0x759, 0x650, 
        0xaf0, 0xbf9, 0x8f3, 0x9fa, 0x2fc, 0x3f5, 0xff, 0x1f6, 
        0xef6, 0xfff, 0xcf5, 0xdfc, 0x6fa, 0x7f3, 0x4f9, 0x5f0, 
        0xb60, 0xa69, 0x963, 0x86a, 0x36c, 0x265, 0x16f, 0x66, 
        0xf66, 0xe6f, 0xd65, 0xc6c, 0x76a, 0x663, 0x569, 0x460, 
        0x460, 0x569, 0x663, 0x76a, 0xc6c, 0xd65, 0xe6f, 0xf66, 
        0x66, 0x16f, 0x265, 0x36c, 0x86a, 0x963, 0xa69, 0xb60, 
        0x5f0, 0x4f9, 0x7f3, 0x6fa, 0xdfc, 0xcf5, 0xfff, 0xef6, 
        0x1f6, 0xff, 0x3f5, 0x2fc, 0x9fa, 0x8f3, 0xbf9, 0xaf0, 
        0x650, 0x759, 0x453, 0x55a, 0xe5c, 0xf55, 0xc5f, 0xd56, 
        0x256, 0x35f, 0x55, 0x15c, 0xa5a, 0xb53, 0x859, 0x950, 
        0x7c0, 0x6c9, 0x5c3, 0x4ca, 0xfcc, 0xec5, 0xdcf, 0xcc6, 
        0x3c6, 0x2cf, 0x1c5, 0xcc, 0xbca, 0xac3, 0x9c9, 0x8c0, 
        0xca0, 0xda9, 0xea3, 0xfaa, 0x4ac, 0x5a5, 0x6af, 0x7a6, 
        0x8a6, 0x9af, 0xaa5, 0xbac, 0xaa, 0x1a3, 0x2a9, 0x3a0, 
        0xd30, 0xc39, 0xf33, 0xe3a, 0x53c, 0x435, 0x73f, 0x636, 
        0x936, 0x83f, 0xb35, 0xa3c, 0x13a, 0x33, 0x339, 0x230, 
        0xe90, 0xf99, 0xc93, 0xd9a, 0x69c, 0x795, 0x49f, 0x596, 
        0xa96, 0xb9f, 0x895, 0x99c, 0x29a, 0x393, 0x99, 0x190, 
        0xf00, 0xe09, 0xd03, 0xc0a, 0x70c, 0x605, 0x50f, 0x406, 
        0xb06, 0xa0f, 0x905, 0x80c, 0x30a, 0x203, 0x109, 0x0, 
    ];

    // Edge definitions - each edge is defined by its two corner indices
    static EDGES = [
        [0, 1], [1, 3], [3, 2], [2, 0],
        [4, 5], [5, 7], [7, 6], [6, 4],
        [0, 4], [1, 5], [3, 7], [2, 6]
    ];

    // Triangle table - defines which edges form triangles for each cube configuration
    static TRIANGLE_TABLE = [
        [ -1 ],
        [ 0, 3, 8, -1 ],
        [ 0, 9, 1, -1 ],
        [ 3, 8, 1, 1, 8, 9, -1 ],
        [ 2, 11, 3, -1 ],
        [ 8, 0, 11, 11, 0, 2, -1 ],
        [ 3, 2, 11, 1, 0, 9, -1 ],
        [ 11, 1, 2, 11, 9, 1, 11, 8, 9, -1 ],
        [ 1, 10, 2, -1 ],
        [ 0, 3, 8, 2, 1, 10, -1 ],
        [ 10, 2, 9, 9, 2, 0, -1 ],
        [ 8, 2, 3, 8, 10, 2, 8, 9, 10, -1 ],
        [ 11, 3, 10, 10, 3, 1, -1 ],
        [ 10, 0, 1, 10, 8, 0, 10, 11, 8, -1 ],
        [ 9, 3, 0, 9, 11, 3, 9, 10, 11, -1 ],
        [ 8, 9, 11, 11, 9, 10, -1 ],
        [ 4, 8, 7, -1 ],
        [ 7, 4, 3, 3, 4, 0, -1 ],
        [ 4, 8, 7, 0, 9, 1, -1 ],
        [ 1, 4, 9, 1, 7, 4, 1, 3, 7, -1 ],
        [ 8, 7, 4, 11, 3, 2, -1 ],
        [ 4, 11, 7, 4, 2, 11, 4, 0, 2, -1 ],
        [ 0, 9, 1, 8, 7, 4, 11, 3, 2, -1 ],
        [ 7, 4, 11, 11, 4, 2, 2, 4, 9, 2, 9, 1, -1 ],
        [ 4, 8, 7, 2, 1, 10, -1 ],
        [ 7, 4, 3, 3, 4, 0, 10, 2, 1, -1 ],
        [ 10, 2, 9, 9, 2, 0, 7, 4, 8, -1 ],
        [ 10, 2, 3, 10, 3, 4, 3, 7, 4, 9, 10, 4, -1 ],
        [ 1, 10, 3, 3, 10, 11, 4, 8, 7, -1 ],
        [ 10, 11, 1, 11, 7, 4, 1, 11, 4, 1, 4, 0, -1 ],
        [ 7, 4, 8, 9, 3, 0, 9, 11, 3, 9, 10, 11, -1 ],
        [ 7, 4, 11, 4, 9, 11, 9, 10, 11, -1 ],
        [ 9, 4, 5, -1 ],
        [ 9, 4, 5, 8, 0, 3, -1 ],
        [ 4, 5, 0, 0, 5, 1, -1 ],
        [ 5, 8, 4, 5, 3, 8, 5, 1, 3, -1 ],
        [ 9, 4, 5, 11, 3, 2, -1 ],
        [ 2, 11, 0, 0, 11, 8, 5, 9, 4, -1 ],
        [ 4, 5, 0, 0, 5, 1, 11, 3, 2, -1 ],
        [ 5, 1, 4, 1, 2, 11, 4, 1, 11, 4, 11, 8, -1 ],
        [ 1, 10, 2, 5, 9, 4, -1 ],
        [ 9, 4, 5, 0, 3, 8, 2, 1, 10, -1 ],
        [ 2, 5, 10, 2, 4, 5, 2, 0, 4, -1 ],
        [ 10, 2, 5, 5, 2, 4, 4, 2, 3, 4, 3, 8, -1 ],
        [ 11, 3, 10, 10, 3, 1, 4, 5, 9, -1 ],
        [ 4, 5, 9, 10, 0, 1, 10, 8, 0, 10, 11, 8, -1 ],
        [ 11, 3, 0, 11, 0, 5, 0, 4, 5, 10, 11, 5, -1 ],
        [ 4, 5, 8, 5, 10, 8, 10, 11, 8, -1 ],
        [ 8, 7, 9, 9, 7, 5, -1 ],
        [ 3, 9, 0, 3, 5, 9, 3, 7, 5, -1 ],
        [ 7, 0, 8, 7, 1, 0, 7, 5, 1, -1 ],
        [ 7, 5, 3, 3, 5, 1, -1 ],
        [ 5, 9, 7, 7, 9, 8, 2, 11, 3, -1 ],
        [ 2, 11, 7, 2, 7, 9, 7, 5, 9, 0, 2, 9, -1 ],
        [ 2, 11, 3, 7, 0, 8, 7, 1, 0, 7, 5, 1, -1 ],
        [ 2, 11, 1, 11, 7, 1, 7, 5, 1, -1 ],
        [ 8, 7, 9, 9, 7, 5, 2, 1, 10, -1 ],
        [ 10, 2, 1, 3, 9, 0, 3, 5, 9, 3, 7, 5, -1 ],
        [ 7, 5, 8, 5, 10, 2, 8, 5, 2, 8, 2, 0, -1 ],
        [ 10, 2, 5, 2, 3, 5, 3, 7, 5, -1 ],
        [ 8, 7, 5, 8, 5, 9, 11, 3, 10, 3, 1, 10, -1 ],
        [ 5, 11, 7, 10, 11, 5, 1, 9, 0, -1 ],
        [ 11, 5, 10, 7, 5, 11, 8, 3, 0, -1 ],
        [ 5, 11, 7, 10, 11, 5, -1 ],
        [ 6, 7, 11, -1 ],
        [ 7, 11, 6, 3, 8, 0, -1 ],
        [ 6, 7, 11, 0, 9, 1, -1 ],
        [ 9, 1, 8, 8, 1, 3, 6, 7, 11, -1 ],
        [ 3, 2, 7, 7, 2, 6, -1 ],
        [ 0, 7, 8, 0, 6, 7, 0, 2, 6, -1 ],
        [ 6, 7, 2, 2, 7, 3, 9, 1, 0, -1 ],
        [ 6, 7, 8, 6, 8, 1, 8, 9, 1, 2, 6, 1, -1 ],
        [ 11, 6, 7, 10, 2, 1, -1 ],
        [ 3, 8, 0, 11, 6, 7, 10, 2, 1, -1 ],
        [ 0, 9, 2, 2, 9, 10, 7, 11, 6, -1 ],
        [ 6, 7, 11, 8, 2, 3, 8, 10, 2, 8, 9, 10, -1 ],
        [ 7, 10, 6, 7, 1, 10, 7, 3, 1, -1 ],
        [ 8, 0, 7, 7, 0, 6, 6, 0, 1, 6, 1, 10, -1 ],
        [ 7, 3, 6, 3, 0, 9, 6, 3, 9, 6, 9, 10, -1 ],
        [ 6, 7, 10, 7, 8, 10, 8, 9, 10, -1 ],
        [ 11, 6, 8, 8, 6, 4, -1 ],
        [ 6, 3, 11, 6, 0, 3, 6, 4, 0, -1 ],
        [ 11, 6, 8, 8, 6, 4, 1, 0, 9, -1 ],
        [ 1, 3, 9, 3, 11, 6, 9, 3, 6, 9, 6, 4, -1 ],
        [ 2, 8, 3, 2, 4, 8, 2, 6, 4, -1 ],
        [ 4, 0, 6, 6, 0, 2, -1 ],
        [ 9, 1, 0, 2, 8, 3, 2, 4, 8, 2, 6, 4, -1 ],
        [ 9, 1, 4, 1, 2, 4, 2, 6, 4, -1 ],
        [ 4, 8, 6, 6, 8, 11, 1, 10, 2, -1 ],
        [ 1, 10, 2, 6, 3, 11, 6, 0, 3, 6, 4, 0, -1 ],
        [ 11, 6, 4, 11, 4, 8, 10, 2, 9, 2, 0, 9, -1 ],
        [ 10, 4, 9, 6, 4, 10, 11, 2, 3, -1 ],
        [ 4, 8, 3, 4, 3, 10, 3, 1, 10, 6, 4, 10, -1 ],
        [ 1, 10, 0, 10, 6, 0, 6, 4, 0, -1 ],
        [ 4, 10, 6, 9, 10, 4, 0, 8, 3, -1 ],
        [ 4, 10, 6, 9, 10, 4, -1 ],
        [ 6, 7, 11, 4, 5, 9, -1 ],
        [ 4, 5, 9, 7, 11, 6, 3, 8, 0, -1 ],
        [ 1, 0, 5, 5, 0, 4, 11, 6, 7, -1 ],
        [ 11, 6, 7, 5, 8, 4, 5, 3, 8, 5, 1, 3, -1 ],
        [ 3, 2, 7, 7, 2, 6, 9, 4, 5, -1 ],
        [ 5, 9, 4, 0, 7, 8, 0, 6, 7, 0, 2, 6, -1 ],
        [ 3, 2, 6, 3, 6, 7, 1, 0, 5, 0, 4, 5, -1 ],
        [ 6, 1, 2, 5, 1, 6, 4, 7, 8, -1 ],
        [ 10, 2, 1, 6, 7, 11, 4, 5, 9, -1 ],
        [ 0, 3, 8, 4, 5, 9, 11, 6, 7, 10, 2, 1, -1 ],
        [ 7, 11, 6, 2, 5, 10, 2, 4, 5, 2, 0, 4, -1 ],
        [ 8, 4, 7, 5, 10, 6, 3, 11, 2, -1 ],
        [ 9, 4, 5, 7, 10, 6, 7, 1, 10, 7, 3, 1, -1 ],
        [ 10, 6, 5, 7, 8, 4, 1, 9, 0, -1 ],
        [ 4, 3, 0, 7, 3, 4, 6, 5, 10, -1 ],
        [ 10, 6, 5, 8, 4, 7, -1 ],
        [ 9, 6, 5, 9, 11, 6, 9, 8, 11, -1 ],
        [ 11, 6, 3, 3, 6, 0, 0, 6, 5, 0, 5, 9, -1 ],
        [ 11, 6, 5, 11, 5, 0, 5, 1, 0, 8, 11, 0, -1 ],
        [ 11, 6, 3, 6, 5, 3, 5, 1, 3, -1 ],
        [ 9, 8, 5, 8, 3, 2, 5, 8, 2, 5, 2, 6, -1 ],
        [ 5, 9, 6, 9, 0, 6, 0, 2, 6, -1 ],
        [ 1, 6, 5, 2, 6, 1, 3, 0, 8, -1 ],
        [ 1, 6, 5, 2, 6, 1, -1 ],
        [ 2, 1, 10, 9, 6, 5, 9, 11, 6, 9, 8, 11, -1 ],
        [ 9, 0, 1, 3, 11, 2, 5, 10, 6, -1 ],
        [ 11, 0, 8, 2, 0, 11, 10, 6, 5, -1 ],
        [ 3, 11, 2, 5, 10, 6, -1 ],
        [ 1, 8, 3, 9, 8, 1, 5, 10, 6, -1 ],
        [ 6, 5, 10, 0, 1, 9, -1 ],
        [ 8, 3, 0, 5, 10, 6, -1 ],
        [ 6, 5, 10, -1 ],
        [ 10, 5, 6, -1 ],
        [ 0, 3, 8, 6, 10, 5, -1 ],
        [ 10, 5, 6, 9, 1, 0, -1 ],
        [ 3, 8, 1, 1, 8, 9, 6, 10, 5, -1 ],
        [ 2, 11, 3, 6, 10, 5, -1 ],
        [ 8, 0, 11, 11, 0, 2, 5, 6, 10, -1 ],
        [ 1, 0, 9, 2, 11, 3, 6, 10, 5, -1 ],
        [ 5, 6, 10, 11, 1, 2, 11, 9, 1, 11, 8, 9, -1 ],
        [ 5, 6, 1, 1, 6, 2, -1 ],
        [ 5, 6, 1, 1, 6, 2, 8, 0, 3, -1 ],
        [ 6, 9, 5, 6, 0, 9, 6, 2, 0, -1 ],
        [ 6, 2, 5, 2, 3, 8, 5, 2, 8, 5, 8, 9, -1 ],
        [ 3, 6, 11, 3, 5, 6, 3, 1, 5, -1 ],
        [ 8, 0, 1, 8, 1, 6, 1, 5, 6, 11, 8, 6, -1 ],
        [ 11, 3, 6, 6, 3, 5, 5, 3, 0, 5, 0, 9, -1 ],
        [ 5, 6, 9, 6, 11, 9, 11, 8, 9, -1 ],
        [ 5, 6, 10, 7, 4, 8, -1 ],
        [ 0, 3, 4, 4, 3, 7, 10, 5, 6, -1 ],
        [ 5, 6, 10, 4, 8, 7, 0, 9, 1, -1 ],
        [ 6, 10, 5, 1, 4, 9, 1, 7, 4, 1, 3, 7, -1 ],
        [ 7, 4, 8, 6, 10, 5, 2, 11, 3, -1 ],
        [ 10, 5, 6, 4, 11, 7, 4, 2, 11, 4, 0, 2, -1 ],
        [ 4, 8, 7, 6, 10, 5, 3, 2, 11, 1, 0, 9, -1 ],
        [ 1, 2, 10, 11, 7, 6, 9, 5, 4, -1 ],
        [ 2, 1, 6, 6, 1, 5, 8, 7, 4, -1 ],
        [ 0, 3, 7, 0, 7, 4, 2, 1, 6, 1, 5, 6, -1 ],
        [ 8, 7, 4, 6, 9, 5, 6, 0, 9, 6, 2, 0, -1 ],
        [ 7, 2, 3, 6, 2, 7, 5, 4, 9, -1 ],
        [ 4, 8, 7, 3, 6, 11, 3, 5, 6, 3, 1, 5, -1 ],
        [ 5, 0, 1, 4, 0, 5, 7, 6, 11, -1 ],
        [ 9, 5, 4, 6, 11, 7, 0, 8, 3, -1 ],
        [ 11, 7, 6, 9, 5, 4, -1 ],
        [ 6, 10, 4, 4, 10, 9, -1 ],
        [ 6, 10, 4, 4, 10, 9, 3, 8, 0, -1 ],
        [ 0, 10, 1, 0, 6, 10, 0, 4, 6, -1 ],
        [ 6, 10, 1, 6, 1, 8, 1, 3, 8, 4, 6, 8, -1 ],
        [ 9, 4, 10, 10, 4, 6, 3, 2, 11, -1 ],
        [ 2, 11, 8, 2, 8, 0, 6, 10, 4, 10, 9, 4, -1 ],
        [ 11, 3, 2, 0, 10, 1, 0, 6, 10, 0, 4, 6, -1 ],
        [ 6, 8, 4, 11, 8, 6, 2, 10, 1, -1 ],
        [ 4, 1, 9, 4, 2, 1, 4, 6, 2, -1 ],
        [ 3, 8, 0, 4, 1, 9, 4, 2, 1, 4, 6, 2, -1 ],
        [ 6, 2, 4, 4, 2, 0, -1 ],
        [ 3, 8, 2, 8, 4, 2, 4, 6, 2, -1 ],
        [ 4, 6, 9, 6, 11, 3, 9, 6, 3, 9, 3, 1, -1 ],
        [ 8, 6, 11, 4, 6, 8, 9, 0, 1, -1 ],
        [ 11, 3, 6, 3, 0, 6, 0, 4, 6, -1 ],
        [ 8, 6, 11, 4, 6, 8, -1 ],
        [ 10, 7, 6, 10, 8, 7, 10, 9, 8, -1 ],
        [ 3, 7, 0, 7, 6, 10, 0, 7, 10, 0, 10, 9, -1 ],
        [ 6, 10, 7, 7, 10, 8, 8, 10, 1, 8, 1, 0, -1 ],
        [ 6, 10, 7, 10, 1, 7, 1, 3, 7, -1 ],
        [ 3, 2, 11, 10, 7, 6, 10, 8, 7, 10, 9, 8, -1 ],
        [ 2, 9, 0, 10, 9, 2, 6, 11, 7, -1 ],
        [ 0, 8, 3, 7, 6, 11, 1, 2, 10, -1 ],
        [ 7, 6, 11, 1, 2, 10, -1 ],
        [ 2, 1, 9, 2, 9, 7, 9, 8, 7, 6, 2, 7, -1 ],
        [ 2, 7, 6, 3, 7, 2, 0, 1, 9, -1 ],
        [ 8, 7, 0, 7, 6, 0, 6, 2, 0, -1 ],
        [ 7, 2, 3, 6, 2, 7, -1 ],
        [ 8, 1, 9, 3, 1, 8, 11, 7, 6, -1 ],
        [ 11, 7, 6, 1, 9, 0, -1 ],
        [ 6, 11, 7, 0, 8, 3, -1 ],
        [ 11, 7, 6, -1 ],
        [ 7, 11, 5, 5, 11, 10, -1 ],
        [ 10, 5, 11, 11, 5, 7, 0, 3, 8, -1 ],
        [ 7, 11, 5, 5, 11, 10, 0, 9, 1, -1 ],
        [ 7, 11, 10, 7, 10, 5, 3, 8, 1, 8, 9, 1, -1 ],
        [ 5, 2, 10, 5, 3, 2, 5, 7, 3, -1 ],
        [ 5, 7, 10, 7, 8, 0, 10, 7, 0, 10, 0, 2, -1 ],
        [ 0, 9, 1, 5, 2, 10, 5, 3, 2, 5, 7, 3, -1 ],
        [ 9, 7, 8, 5, 7, 9, 10, 1, 2, -1 ],
        [ 1, 11, 2, 1, 7, 11, 1, 5, 7, -1 ],
        [ 8, 0, 3, 1, 11, 2, 1, 7, 11, 1, 5, 7, -1 ],
        [ 7, 11, 2, 7, 2, 9, 2, 0, 9, 5, 7, 9, -1 ],
        [ 7, 9, 5, 8, 9, 7, 3, 11, 2, -1 ],
        [ 3, 1, 7, 7, 1, 5, -1 ],
        [ 8, 0, 7, 0, 1, 7, 1, 5, 7, -1 ],
        [ 0, 9, 3, 9, 5, 3, 5, 7, 3, -1 ],
        [ 9, 7, 8, 5, 7, 9, -1 ],
        [ 8, 5, 4, 8, 10, 5, 8, 11, 10, -1 ],
        [ 0, 3, 11, 0, 11, 5, 11, 10, 5, 4, 0, 5, -1 ],
        [ 1, 0, 9, 8, 5, 4, 8, 10, 5, 8, 11, 10, -1 ],
        [ 10, 3, 11, 1, 3, 10, 9, 5, 4, -1 ],
        [ 3, 2, 8, 8, 2, 4, 4, 2, 10, 4, 10, 5, -1 ],
        [ 10, 5, 2, 5, 4, 2, 4, 0, 2, -1 ],
        [ 5, 4, 9, 8, 3, 0, 10, 1, 2, -1 ],
        [ 2, 10, 1, 4, 9, 5, -1 ],
        [ 8, 11, 4, 11, 2, 1, 4, 11, 1, 4, 1, 5, -1 ],
        [ 0, 5, 4, 1, 5, 0, 2, 3, 11, -1 ],
        [ 0, 11, 2, 8, 11, 0, 4, 9, 5, -1 ],
        [ 5, 4, 9, 2, 3, 11, -1 ],
        [ 4, 8, 5, 8, 3, 5, 3, 1, 5, -1 ],
        [ 0, 5, 4, 1, 5, 0, -1 ],
        [ 5, 4, 9, 3, 0, 8, -1 ],
        [ 5, 4, 9, -1 ],
        [ 11, 4, 7, 11, 9, 4, 11, 10, 9, -1 ],
        [ 0, 3, 8, 11, 4, 7, 11, 9, 4, 11, 10, 9, -1 ],
        [ 11, 10, 7, 10, 1, 0, 7, 10, 0, 7, 0, 4, -1 ],
        [ 3, 10, 1, 11, 10, 3, 7, 8, 4, -1 ],
        [ 3, 2, 10, 3, 10, 4, 10, 9, 4, 7, 3, 4, -1 ],
        [ 9, 2, 10, 0, 2, 9, 8, 4, 7, -1 ],
        [ 3, 4, 7, 0, 4, 3, 1, 2, 10, -1 ],
        [ 7, 8, 4, 10, 1, 2, -1 ],
        [ 7, 11, 4, 4, 11, 9, 9, 11, 2, 9, 2, 1, -1 ],
        [ 1, 9, 0, 4, 7, 8, 2, 3, 11, -1 ],
        [ 7, 11, 4, 11, 2, 4, 2, 0, 4, -1 ],
        [ 4, 7, 8, 2, 3, 11, -1 ],
        [ 9, 4, 1, 4, 7, 1, 7, 3, 1, -1 ],
        [ 7, 8, 4, 1, 9, 0, -1 ],
        [ 3, 4, 7, 0, 4, 3, -1 ],
        [ 7, 8, 4, -1 ],
        [ 11, 10, 8, 8, 10, 9, -1 ],
        [ 0, 3, 9, 3, 11, 9, 11, 10, 9, -1 ],
        [ 1, 0, 10, 0, 8, 10, 8, 11, 10, -1 ],
        [ 10, 3, 11, 1, 3, 10, -1 ],
        [ 3, 2, 8, 2, 10, 8, 10, 9, 8, -1 ],
        [ 9, 2, 10, 0, 2, 9, -1 ],
        [ 8, 3, 0, 10, 1, 2, -1 ],
        [ 2, 10, 1, -1 ],
        [ 2, 1, 11, 1, 9, 11, 9, 8, 11, -1 ],
        [ 11, 2, 3, 9, 0, 1, -1 ],
        [ 11, 0, 8, 2, 0, 11, -1 ],
        [ 3, 11, 2, -1 ],
        [ 1, 8, 3, 9, 8, 1, -1 ],
        [ 1, 9, 0, -1 ],
        [ 8, 3, 0, -1 ],
        [ -1 ],
    ];
}

// Export the Mesher class
(function() {
  const nodes = { Mesher, MarchingCubesTables };
  
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
