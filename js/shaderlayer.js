// ShaderLayer class for managing shader programs and uniforms
class ShaderLayer {
    constructor(program, src) {
        this.program = program;
        this.src = src;
        this.uniforms = new Map();
        this.attribLocations = {}; // Store attribute locations
        this.setAttribLocation('aVertexPosition', 
            renderer.gl.getAttribLocation(this.program, 'aVertexPosition'));
    }

    setUniforms(uniforms) {
        for (const [name, value] of Object.entries(uniforms)) {
            let type;
            if (typeof value === 'number') {
                type = 'float';
            } else if (value instanceof Vec3) {
                type = 'vec3';
            } else if (value instanceof Texture3D) {
                type = 'sampler3D';
            } else if (value instanceof Texture2D) {
                type = 'sampler2D';
            } else {
                throw new Error(`Unsupported uniform type for ${name}: ${value?.constructor?.name || typeof value}`);
            }
            this.setUniform(type, name, value);
        }
        return this;
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
        
        // Track texture units used
        let textureUnit = 0;
        
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
                    // For 2D textures
                    gl.activeTexture(gl.TEXTURE0 + textureUnit);
                    
                    // Create and configure the WebGL texture if it doesn't exist
                    if (!uniform.value.glTexture) {
                        uniform.value.glTexture = gl.createTexture();
                        gl.bindTexture(gl.TEXTURE_2D, uniform.value.glTexture);
                        
                        // Set texture parameters
                        const filterMode = uniform.value.interpolation === 'linear' ? gl.LINEAR : gl.NEAREST;
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filterMode);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filterMode);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                        
                        // Upload the texture data
                        const [width, height] = uniform.value.dimensions;
                        
                        // Determine the appropriate format and type based on the data
                        let format, internalFormat, type;
                        
                        if (uniform.value.data instanceof Float32Array) {
                            // For float data, use floating point texture format
                            format = uniform.value.format || gl.RED;
                            internalFormat = uniform.value.internalFormat || gl.R16F;
                            type = gl.FLOAT;
                        } else {
                            // Default for other data types (like Uint8Array)
                            format = uniform.value.format || gl.RGBA;
                            internalFormat = uniform.value.internalFormat || gl.RGBA;
                            type = uniform.value.type || gl.UNSIGNED_BYTE;
                        }
                        
                        gl.texImage2D(
                            gl.TEXTURE_2D,
                            0,                  // level
                            internalFormat,     // internalformat
                            width,
                            height,
                            0,                  // border
                            format,             // format
                            type,               // type
                            uniform.value.data
                        );
                    } else {
                        // Just bind the existing texture
                        gl.bindTexture(gl.TEXTURE_2D, uniform.value.glTexture);
                    }
                    
                    // Set the uniform to use this texture unit
                    gl.uniform1i(location, textureUnit);
                    
                    // Increment texture unit for next texture
                    textureUnit++;
                    break;
                case 'sampler3D':
                    // For 3D textures, we need to:
                    // 1. Activate a texture unit
                    gl.activeTexture(gl.TEXTURE0 + textureUnit);
                    
                    // 2. Create and configure the WebGL texture if it doesn't exist
                    if (!uniform.value.glTexture) {
                        uniform.value.glTexture = gl.createTexture();
                        gl.bindTexture(gl.TEXTURE_3D, uniform.value.glTexture);
                        
                        // Set texture parameters based on the interpolation mode
                        const filterMode = uniform.value.interpolation === 'linear' ? gl.LINEAR : gl.NEAREST;
                        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, filterMode);
                        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, filterMode);
                        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
                        
                        // Upload the texture data
                        const [width, height, depth] = uniform.value.dimensions;
                        
                        // Use R16F format (16-bit float, single channel)
                        // This format supports linear filtering in WebGL2
                        gl.texImage3D(
                            gl.TEXTURE_3D,
                            0,                  // level
                            gl.R16F,            // internalformat - 16-bit float, single channel
                            width,
                            height,
                            depth,
                            0,                  // border
                            gl.RED,             // format - single channel
                            gl.FLOAT,           // type
                            new Float32Array(uniform.value.data)
                        );
                    } else {
                        // Just bind the existing texture
                        gl.bindTexture(gl.TEXTURE_3D, uniform.value.glTexture);
                    }
                    
                    // 3. Set the uniform to use this texture unit
                    gl.uniform1i(location, textureUnit);
                    
                    // 4. Increment texture unit for next texture
                    textureUnit++;
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