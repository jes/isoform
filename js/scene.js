// Scene configuration
const scene = {
    init() {
    },
    
    generateShaderCode(document, showBoundingSphere = false) {
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
        
        // Get the selected node from UI
        const secondaryNode = ui.getSecondaryNode();
        
        // Build the new scene combination code
        let newSceneCode = document.shaderCode() + `
        float map(vec3 p) {
            p = rotatePoint(p);
            return peptide(p);
        }
            float map_secondary(vec3 p) {
            return 1000.0;
        }
        `;

        const newSource = originalSource.substring(0, startIndex) + 
                   newSceneCode +
                   originalSource.substring(endIndex);

        console.log(newSource);
        
        document.markClean();

        const endTime = performance.now();
        console.log(`Shader codegen took ${endTime - startTime} ms`);

        return newSource;
    }
}; 