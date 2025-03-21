// ShaderLayer class for managing shader programs and uniforms
class ShaderLayer {
    constructor(program) {
        this.program = program;
        this.uniforms = new Map();
        this.attribLocations = {}; // Store attribute locations
    }

    // Set a uniform with its type and value
    setUniform(type, name, value) {
        this.uniforms.set(name, { type, value });
        return this; // Allow chaining
    }

    // Set attribute location
    setAttribLocation(name, location) {
        this.attribLocations[name] = location;
        return this; // Allow chaining
    }
    
    // Get an attribute location
    getAttribLocation(gl, name) {
        if (!this.attribLocations[name]) {
            this.attribLocations[name] = gl.getAttribLocation(this.program, name);
        }
        return this.attribLocations[name];
    }

    // Apply all uniforms to the GL context
    applyUniforms(gl) {
        // Use the program
        gl.useProgram(this.program);
        
        // Apply each uniform based on its type
        this.uniforms.forEach((uniform, name) => {
            const location = gl.getUniformLocation(this.program, name);
            if (location === null) {
                // console.warn(`Uniform ${name} not found in shader program`);
                return;
            }
            
            switch (uniform.type) {
                case 'float':
                    gl.uniform1f(location, uniform.value);
                    break;
                case 'int':
                case 'bool':
                    gl.uniform1i(location, uniform.value);
                    break;
                case 'vec2':
                    gl.uniform2fv(location, Array.isArray(uniform.value) ? 
                        uniform.value : [uniform.value.x, uniform.value.y]);
                    break;
                case 'vec3':
                    gl.uniform3fv(location, Array.isArray(uniform.value) ? 
                        uniform.value : [uniform.value.x, uniform.value.y, uniform.value.z]);
                    break;
                case 'vec4':
                    gl.uniform4fv(location, uniform.value);
                    break;
                case 'mat3':
                    gl.uniformMatrix3fv(location, false, uniform.value);
                    break;
                case 'mat4':
                    gl.uniformMatrix4fv(location, false, uniform.value);
                    break;
                case 'sampler2D':
                    // For textures, value should be the texture unit number (0, 1, etc.)
                    gl.uniform1i(location, uniform.value);
                    break;
                default:
                    console.warn(`Unsupported uniform type: ${uniform.type}`);
            }
        });
    }
}

// Export the class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShaderLayer;
} else {
    window.ShaderLayer = ShaderLayer;
} 