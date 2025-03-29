class Mesh {
    constructor() {
        this.vertices = [];
        this.triangles = [];
    }

    // Add a vertex to the mesh and return its index
    addVertex(vertex) {
        this.vertices.push(vertex);
        return this.vertices.length - 1;
    }

    // Add a triangle to the mesh
    addTriangle(triangle) {
        this.triangles.push(triangle);
    }

    // Add a face using three vertices directly
    addFace(v1, v2, v3) {
        const baseIndex = this.vertices.length;
        this.vertices.push(v1, v2, v3);
        this.triangles.push([baseIndex, baseIndex + 1, baseIndex + 2]);
    }

    // Return the number of vertices
    vertexCount() {
        return this.vertices.length;
    }

    // Return the number of triangles
    triangleCount() {
        return this.triangles.length;
    }

    // Clear the mesh
    clear() {
        this.vertices = [];
        this.triangles = [];
    }
}

// Export the Mesh class
(function() {
  const nodes = { Mesh };
  
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