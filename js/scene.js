// Scene configuration
const scene = {
    init() {
    },
    
    generateShaderCode(ssa, ssaNormal, uniforms) {
        let uniformsSrc = '';
        // Sort the uniforms by their name
        const sortedUniforms = Object.entries(uniforms).sort(([nameA], [nameB]) => nameA.localeCompare(nameB));
        
        for (const [name, value] of sortedUniforms) {
            let type;
            if (typeof value === 'number') {
                type = 'float';
            } else if (value instanceof Vec3) {
                type = 'vec3';
            } else if (value instanceof Texture3D) {
                type = 'sampler3D';
            } else {
                throw new Error(`Unsupported uniform type for ${name}: ${value?.constructor?.name || typeof value}`);
            }
            uniformsSrc += `uniform ${type} ${name};\n`;
        }

        const glslSrc = ssa.compileToGLSL(`SDFResult peptide(vec3 p)`, 'SDFResult');
        const glslSrcNormal = ssaNormal.compileToGLSL(`vec3 peptideNormal(vec3 p)`);

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
        let newSceneCode = uniformsSrc + glslSrc + glslSrcNormal + `
        float map(vec3 p) {
            SDFResult result = peptide(uRotationMatrix * p);
            return result.distance;
        }
        vec3 mapNormal(vec3 p) {
            vec3 grad = peptideNormal(uRotationMatrix * p);
            return normalize(transpose(uRotationMatrix) * grad);
        }
        `;

        const newSource = originalSource.substring(0, startIndex) + 
                   newSceneCode +
                   originalSource.substring(endIndex);

        console.log(newSource);

        return newSource;
    }
}; 