// Scene configuration
const scene = {
    init() {
    },
    
    generateShaderCode(code, showBoundingSphere = false) {
        const startTime = performance.now();
        // Get the original shader source
        let originalSource = renderer.fragmentShaderSource;
        
        // Find the scene combination part
        const sceneStartMarker = "// begin scene";
        const sceneEndMarker = "// end scene";
        
        let startIndex = originalSource.indexOf(sceneStartMarker);
        let endIndex = originalSource.indexOf(sceneEndMarker);
        
        if (startIndex === -1 || endIndex === -1) return null;
        
        // Skip to the end of the start marker line
        startIndex = originalSource.indexOf('\n', startIndex) + 1;
        
        // Build the new scene combination code
        let newSceneCode = code + `
        float map(vec3 p) {
            return peptide(uRotationMatrix * p);
        }
        `;

        const newSource = originalSource.substring(0, startIndex) + 
                   newSceneCode +
                   originalSource.substring(endIndex);

        const endTime = performance.now();
        console.log(`Shader codegen took ${endTime - startTime} ms`);

        return newSource;
    }
}; 