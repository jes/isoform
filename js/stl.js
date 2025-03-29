class STL {
    // Export a mesh as an ASCII STL file
    static export(mesh, filename = 'mesh.stl') {
        if (mesh.triangles.length === 0) {
            console.error("No mesh data to export.");
            return;
        }

        console.log("Generating STL data...");
        
        // STL file header (80 bytes)
        let stlData = 'solid exported\n';
        
        // Process each triangle
        for (let i = 0; i < mesh.triangles.length; i++) {
            const triangle = mesh.triangles[i];
            // Make sure we have valid indices and vertices
            if (triangle.length !== 3 || 
                !triangle[0] || 
                !triangle[1] || 
                !triangle[2]) {
                console.warn(`Skipping invalid triangle at index ${i}`);
                continue;
            }
            
            const v1 = triangle[0];
            const v2 = triangle[1];
            const v3 = triangle[2];
            
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
        
        console.log(`STL file "${filename}" created with ${mesh.triangles.length} triangles`);
    }

    // Export a mesh as a binary STL file (more compact)
    static exportBinary(mesh, filename = 'mesh.stl') {
        if (mesh.vertices.length === 0 || mesh.triangles.length === 0) {
            console.error("No mesh data to export.");
            return;
        }

        console.log("Generating binary STL data...");
        
        // Count valid triangles first
        let validTriangles = 0;
        for (let i = 0; i < mesh.triangles.length; i++) {
            const triangle = mesh.triangles[i];
            if (triangle.length === 3 && 
                triangle[0] && 
                triangle[1] && 
                triangle[2]) {
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
        for (let i = 0; i < mesh.triangles.length; i++) {
            const triangle = mesh.triangles[i];
            // Skip invalid triangles
            if (triangle.length !== 3 || 
                !triangle[0] || 
                !triangle[1] || 
                !triangle[2]) {
                continue;
            }
            
            const v1 = triangle[0];
            const v2 = triangle[1];
            const v3 = triangle[2];
            
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

    // Import a mesh from an STL file (handles both ASCII and binary formats)
    static async import(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    // Detect if the file is ASCII or binary
                    const isASCII = STL.isAsciiSTL(e.target.result);
                    
                    if (isASCII) {
                        resolve(STL.parseASCII(e.target.result));
                    } else {
                        resolve(STL.parseBinary(e.target.result));
                    }
                } catch (error) {
                    reject(`Error parsing STL file: ${error.message}`);
                }
            };
            
            reader.onerror = function() {
                reject('Error reading file');
            };
            
            // Read the file based on the detected format
            reader.readAsArrayBuffer(file);
        });
    }
    
    // Check if the STL file is in ASCII format
    static isAsciiSTL(buffer) {
        // Read the first 6 bytes to check for 'solid ' prefix
        const header = new Uint8Array(buffer, 0, 6);
        const headerStr = String.fromCharCode.apply(null, header);
        return headerStr.toLowerCase().startsWith('solid ');
    }
    
    // Parse ASCII STL file
    static parseASCII(buffer) {
        const decoder = new TextDecoder();
        const text = decoder.decode(buffer);
        const lines = text.split('\n');
        
        const vertices = [];
        const triangles = [];
        let vertexIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('vertex ')) {
                const parts = line.split(' ');
                if (parts.length >= 4) {
                    const x = parseFloat(parts[1]);
                    const y = parseFloat(parts[2]);
                    const z = parseFloat(parts[3]);
                    vertices.push(new Vec3(x, y, z));
                    
                    // Create triangle when we have 3 vertices
                    if (vertices.length % 3 === 0) {
                        const idx = vertices.length;
                        triangles.push([
                            vertices[idx-3], 
                            vertices[idx-2], 
                            vertices[idx-1]
                        ]);
                    }
                }
            }
        }
        
        return { vertices, triangles };
    }
    
    // Parse binary STL file
    static parseBinary(buffer) {
        const view = new DataView(buffer);
        const vertices = [];
        const triangles = [];
        
        // Skip the header (80 bytes)
        // Read number of triangles (4 bytes)
        const triangleCount = view.getUint32(80, true);
        
        let offset = 84; // Start after header and triangle count
        
        for (let i = 0; i < triangleCount; i++) {
            // Skip normal vector (12 bytes)
            offset += 12;
            
            // Read vertices
            const v1 = new Vec3(
                view.getFloat32(offset, true),
                view.getFloat32(offset + 4, true),
                view.getFloat32(offset + 8, true)
            );
            offset += 12;
            
            const v2 = new Vec3(
                view.getFloat32(offset, true),
                view.getFloat32(offset + 4, true),
                view.getFloat32(offset + 8, true)
            );
            offset += 12;
            
            const v3 = new Vec3(
                view.getFloat32(offset, true),
                view.getFloat32(offset + 4, true),
                view.getFloat32(offset + 8, true)
            );
            offset += 12;
            
            // Add vertices
            vertices.push(v1, v2, v3);
            
            // Create triangle
            const idx = vertices.length;
            triangles.push([
                vertices[idx-3], 
                vertices[idx-2], 
                vertices[idx-1]
            ]);
            
            // Skip attribute byte count (2 bytes)
            offset += 2;
        }
        
        return { vertices, triangles };
    }
}

// Export the STLExporter class
(function() {
  const nodes = { STL };
  
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