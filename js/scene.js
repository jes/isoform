// Scene configuration
const scene = {
    init() {
    },
    
    generateShaderCode(ssa) {
        const startTime = performance.now();

        const glslSrc = ssa.compileToGLSL(`float peptide(vec3 p)`);

        // Get the original shader source
        let originalSource = renderer.fragmentShaderSource;
        
        // Find the scene combination part
        const sceneStartMarker = "// begin scene";
        const sceneEndMarker = "// end scene";
        
        let startIndex = originalSource.indexOf(sceneStartMarker);
        let endIndex = originalSource.indexOf(sceneEndMarker);
        
        if (startIndex === -1 || endIndex === -1) throw new Error("Scene start/end markers not found");
        
        // Skip to the end of the start marker line
        startIndex = originalSource.indexOf('\n', startIndex) + 1;
        
        // Build the new scene combination code
        let newSceneCode = glslSrc + `
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