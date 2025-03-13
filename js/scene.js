// Scene configuration
const scene = {
    init() {
    },
    
    generateShaderCode(document, showBoundingSphere = false) {
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
        let newSceneCode = `
        float map(vec3 p) {
            p = rotatePoint(p);
            return ${document.shaderCode()};
        }
        float map_secondary(vec3 p) {
            p = rotatePoint(p);
            return ${secondaryNode ? document.secondaryShaderCode(secondaryNode, showBoundingSphere) : '1000.0'};
        }
        `;

        const mainImpls = document.allShaderImplementations();
        const secondaryImpls = document.secondaryShaderImplementations(secondaryNode, showBoundingSphere);
        
        // Filter out duplicates from secondaryImpls that are already in mainImpls
        const filteredSecondaryImpls = secondaryImpls.filter(impl => !mainImpls.includes(impl));
        
        // Combine the parts
        const impls = [...mainImpls, ...filteredSecondaryImpls];
        
        const newSource = originalSource.substring(0, startIndex) + 
                   impls.join('\n') +
                   newSceneCode +
                   originalSource.substring(endIndex);
        
        document.markClean();

        return newSource;
    }
}; 