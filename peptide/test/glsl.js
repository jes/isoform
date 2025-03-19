// GLSL test harness for Peptide
class GLSLTestHarness {
    constructor() {
        // Create a hidden canvas for WebGL rendering
        this.canvas = document.createElement('canvas');
        this.canvas.width = 4;  // Small size is sufficient for tests
        this.canvas.height = 4;
        
        // Get WebGL context
        this.gl = this.canvas.getContext('webgl2');
        if (!this.gl) {
            throw new Error('WebGL2 not supported');
        }
        
        // Create basic shader program
        this.createShaderProgram();
        
        // Create framebuffer for rendering
        this.setupFramebuffer();
    }
    
    createShaderProgram() {
        // Vertex shader - just pass through positions
        const vsSource = `#version 300 es
            in vec4 aPosition;
            in vec2 aTexCoord;
            out vec2 vTexCoord;
            
            void main() {
                gl_Position = aPosition;
                vTexCoord = aTexCoord;
            }
        `;
        
        // Fragment shader template - will be filled in for each test
        this.fsTemplate = `#version 300 es
            precision highp float;
            in vec2 vTexCoord;
            out vec4 fragColor;
            
            // Peptide-generated code will be inserted here
            {{PEPTIDE_CODE}}
            
            void main() {
                // Test code will be inserted here
                {{TEST_CODE}}
            }
        `;
        
        // Create shader program
        const vertexShader = this.compileShader(vsSource, this.gl.VERTEX_SHADER);
        this.fragmentShader = null; // Will be created for each test
        
        // Create program shell - we'll attach the fragment shader later
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
    }
    
    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const info = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error('Shader compilation error: ' + info);
        }
        
        return shader;
    }
    
    setupFramebuffer() {
        // Create texture for framebuffer
        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texImage2D(
            this.gl.TEXTURE_2D, 0, this.gl.RGBA, 
            this.canvas.width, this.canvas.height, 
            0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null
        );
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        
        // Create framebuffer and attach texture
        this.framebuffer = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
        this.gl.framebufferTexture2D(
            this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, 
            this.gl.TEXTURE_2D, this.texture, 0
        );
        
        // Check framebuffer is complete
        if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('Framebuffer setup failed');
        }
        
        // Unbind framebuffer for now
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    }
    
    setupGeometry() {
        // Create a full-screen quad
        const positions = [
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
             1.0,  1.0
        ];
        
        const texCoords = [
            0.0, 0.0,
            1.0, 0.0,
            0.0, 1.0,
            1.0, 1.0
        ];
        
        // Create and bind position buffer
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
        
        const positionAttribLocation = this.gl.getAttribLocation(this.program, 'aPosition');
        this.gl.enableVertexAttribArray(positionAttribLocation);
        this.gl.vertexAttribPointer(positionAttribLocation, 2, this.gl.FLOAT, false, 0, 0);
        
        // Create and bind texcoord buffer
        const texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);
        
        const texCoordAttribLocation = this.gl.getAttribLocation(this.program, 'aTexCoord');
        this.gl.enableVertexAttribArray(texCoordAttribLocation);
        this.gl.vertexAttribPointer(texCoordAttribLocation, 2, this.gl.FLOAT, false, 0, 0);
    }
    
    createFragmentShader(peptideCode, testCode) {
        // If there's an existing fragment shader, delete it
        if (this.fragmentShader) {
            this.gl.detachShader(this.program, this.fragmentShader);
            this.gl.deleteShader(this.fragmentShader);
        }
        
        // Create new fragment shader with the provided code
        const fsSource = this.fsTemplate
            .replace('{{PEPTIDE_CODE}}', peptideCode)
            .replace('{{TEST_CODE}}', testCode);
        
        this.fragmentShader = this.compileShader(fsSource, this.gl.FRAGMENT_SHADER);
        this.gl.attachShader(this.program, this.fragmentShader);
        this.gl.linkProgram(this.program);
        
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            const info = this.gl.getProgramInfoLog(this.program);
            throw new Error('Program linking error: ' + info);
        }
    }
    
    setUniform(name, type, value) {
        const location = this.gl.getUniformLocation(this.program, name);
        if (location === null) {
            console.warn(`Uniform ${name} not found`);
            return;
        }
        
        switch (type) {
            case 'float':
                this.gl.uniform1f(location, value);
                break;
            case 'vec2':
                this.gl.uniform2fv(location, value);
                break;
            case 'vec3':
                this.gl.uniform3fv(location, value);
                break;
            case 'vec4':
                this.gl.uniform4fv(location, value);
                break;
            default:
                throw new Error(`Unsupported uniform type: ${type}`);
        }
    }
    
    render() {
        // Bind framebuffer and set viewport
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Clear the canvas
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        // Use the program and draw
        this.gl.useProgram(this.program);
        this.setupGeometry();
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
    
    readPixels() {
        // Read pixels from framebuffer
        const pixels = new Uint8Array(this.canvas.width * this.canvas.height * 4);
        this.gl.readPixels(
            0, 0, this.canvas.width, this.canvas.height,
            this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels
        );
        return pixels;
    }
    
    // Main test method
    testExpression(peptideExpr, expectedValue, variables = {}) {
        // Compile the Peptide expression to GLSL
        const ssa = new PeptideSSA(peptideExpr);
        const returnType = peptideExpr.type;
        const glslCode = ssa.compileToGLSL(`${returnType} peptide()`);
        
        // Create uniform declarations for variables
        let uniformDeclarations = '';
        let testCode = '';
        
        // Set up uniform declarations based on variable types
        for (const [name, value] of Object.entries(variables)) {
            if (value instanceof Vec3) {
                uniformDeclarations += `uniform vec3 u_${name};\n`;
            } else if (typeof value === 'number') {
                uniformDeclarations += `uniform float u_${name};\n`;
            } else {
                throw new Error(`Unsupported variable type for ${name}`);
            }
        }
        
        // Create test code that evaluates the expression and outputs the result as a color
        if (peptideExpr.type === 'float') {
            testCode = `
                float result = peptide();
                float expected = ${expectedValue.toFixed(16)};
                
                // Output green if the result matches the expected value (within epsilon)
                // Output red if it doesn't match
                float epsilon = 0.001;
                if (abs(result - expected) < epsilon) {
                    fragColor = vec4(0.0, 1.0, 0.0, 1.0);  // Green for success
                } else {
                    fragColor = vec4(1.0, 0.0, 0.0, 1.0);  // Red for failure
                    // Encode the actual result in the alpha channel for debugging
                    fragColor.a = result / 255.0;
                }
            `;
        } else if (peptideExpr.type === 'vec3') {
            // For vector results, we need to check each component
            const expectedVec = expectedValue;
            testCode = `
                vec3 result = peptide();
                vec3 expected = vec3(${expectedVec.x.toFixed(16)}, ${expectedVec.y.toFixed(16)}, ${expectedVec.z.toFixed(16)});
                
                float epsilon = 0.001;
                if (length(result - expected) < epsilon) {
                    fragColor = vec4(0.0, 1.0, 0.0, 1.0);  // Green for success
                } else {
                    fragColor = vec4(1.0, 0.0, 0.0, 1.0);  // Red for failure
                    // Encode some debug info in the other channels
                    fragColor.a = length(result - expected) / 10.0;
                }
            `;
        } else {
            throw new Error(`Unsupported expression type: ${peptideExpr.type}`);
        }
        
        // Store the complete shader code for debugging
        const completeShaderCode = this.fsTemplate
            .replace('{{PEPTIDE_CODE}}', uniformDeclarations + glslCode)
            .replace('{{TEST_CODE}}', testCode);

        try {
            // Create and link the fragment shader
            this.createFragmentShader(uniformDeclarations + glslCode, testCode);
            
            // Set uniform values
            for (const [name, value] of Object.entries(variables)) {
                if (value instanceof Vec3) {
                    this.setUniform(`u_${name}`, 'vec3', [value.x, value.y, value.z]);
                } else if (typeof value === 'number') {
                    this.setUniform(`u_${name}`, 'float', value);
                }
            }
            
            // Render and read back pixels
            this.render();
            const pixels = this.readPixels();
            
            // Check if the test passed (first pixel should be green)
            const passed = pixels[1] > 200 && pixels[0] < 50;
            
            if (!passed) {
                // Extract the actual result from the alpha channel for debugging
                const debugValue = pixels[3] / 255.0;
                
                // Store the failed test information in a global object for later inspection
                if (!window.peptideFailedTests) {
                    window.peptideFailedTests = [];
                }
                
                window.peptideFailedTests.push({
                    expression: peptideExpr.toString ? peptideExpr.toString() : 'Expression',
                    expected: JSON.stringify(expectedValue),
                    actual: debugValue,
                    variables: JSON.stringify(variables),
                    shaderCode: completeShaderCode
                });
                
                throw new Error(`GLSL test failed. Expected: ${JSON.stringify(expectedValue)}, Debug value: ${debugValue}`);
            }
        } catch (error) {
            console.error('GLSL test error:', error);

            // Store the failed test information in a global object for later inspection
            if (!window.peptideFailedTests) {
                window.peptideFailedTests = [];
            }
            
            window.peptideFailedTests.push({
                expression: peptideExpr.toString ? peptideExpr.toString() : 'Expression',
                expected: JSON.stringify(expectedValue),
                actual: error.message,
                variables: JSON.stringify(variables),
                shaderCode: completeShaderCode
            });

            throw error;
        }
        
        return true;
    }
    
    cleanup() {
        // Clean up WebGL resources
        if (this.fragmentShader) {
            this.gl.detachShader(this.program, this.fragmentShader);
            this.gl.deleteShader(this.fragmentShader);
        }
        this.gl.deleteProgram(this.program);
        this.gl.deleteFramebuffer(this.framebuffer);
        this.gl.deleteTexture(this.texture);
    }
}

// Create a test suite for GLSL tests
const GLSLTests = new TestSuite();

// Helper function to add GLSL tests
function addGLSLTest(name, testFn) {
    GLSLTests.test(name, async () => {
        const harness = new GLSLTestHarness();
        try {
            await testFn(harness);
        } finally {
            harness.cleanup();
        }
    });
}

// GLSL Peptide tests
addGLSLTest('constant evaluation', async (harness) => {
    const p = P.const(5);
    harness.testExpression(p, 5);
});

addGLSLTest('basic arithmetic', async (harness) => {
    const a = P.const(5);
    const b = P.const(3);
    
    harness.testExpression(P.add(a, b), 8);
    harness.testExpression(P.sub(a, b), 2);
    harness.testExpression(P.mul(a, b), 15);
    harness.testExpression(P.div(a, b), 5/3);
});

addGLSLTest('variable evaluation', async (harness) => {
    const x = P.var('x');
    const expr = P.add(x, P.const(1));
    harness.testExpression(expr, 6, { x: 5 });
});

addGLSLTest('complex expression', async (harness) => {
    // (x + 1) * (y - 2)
    const expr = P.mul(
        P.add(P.var('x'), P.const(1)),
        P.sub(P.var('y'), P.const(2))
    );
    harness.testExpression(expr, 12, { x: 3, y: 5 }); // (3 + 1) * (5 - 2) = 4 * 3 = 12
});

addGLSLTest('min and max operations', async (harness) => {
    const a = P.const(5);
    const b = P.const(3);
    
    harness.testExpression(P.min(a, b), 3);
    harness.testExpression(P.max(a, b), 5);
});

addGLSLTest('power operations', async (harness) => {
    const base = P.const(2);
    const exp = P.const(3);
    
    harness.testExpression(P.pow(base, exp), 8); // 2^3 = 8
    harness.testExpression(P.sqrt(P.const(16)), 4); // √16 = 4
});

addGLSLTest('vector constant evaluation', async (harness) => {
    const v = P.vconst(new Vec3(1, 2, 3));
    harness.testExpression(v, new Vec3(1, 2, 3));
});

addGLSLTest('vector variable evaluation', async (harness) => {
    const v = P.vvar('v');
    harness.testExpression(v, new Vec3(1, 2, 3), { v: new Vec3(1, 2, 3) });
});

addGLSLTest('vector arithmetic', async (harness) => {
    const a = P.vconst(new Vec3(1, 2, 3));
    const b = P.vconst(new Vec3(4, 5, 6));
    
    harness.testExpression(P.vadd(a, b), new Vec3(5, 7, 9));
    harness.testExpression(P.vsub(a, b), new Vec3(-3, -3, -3));
    
    const c = P.const(2);
    harness.testExpression(P.vmul(a, c), new Vec3(2, 4, 6));
});

addGLSLTest('vector operations', async (harness) => {
    const a = P.vconst(new Vec3(1, 2, 3));
    const b = P.vconst(new Vec3(4, 5, 6));
    
    harness.testExpression(P.vlength(a), Math.sqrt(14));  // sqrt(1^2 + 2^2 + 3^2)
    harness.testExpression(P.vdot(a, b), 32);  // 1*4 + 2*5 + 3*6
    
    harness.testExpression(P.vcross(a, b), new Vec3(-3, 6, -3));
});

addGLSLTest('vec3 construction', async (harness) => {
    const x = P.const(1);
    const y = P.const(2);
    const z = P.const(3);
    harness.testExpression(P.vec3(x, y, z), new Vec3(1, 2, 3));
});

addGLSLTest('vector component extraction', async (harness) => {
    const v = P.vconst(new Vec3(1, 2, 3));
    
    harness.testExpression(P.vecX(v), 1);
    harness.testExpression(P.vecY(v), 2);
    harness.testExpression(P.vecZ(v), 3);
});

addGLSLTest('complex vector expression', async (harness) => {
    // (v1 + v2) · (v3 × v4)
    const v1 = P.vvar('var1');
    const v2 = P.vvar('var2');
    const v3 = P.vvar('var3');
    const v4 = P.vvar('var4');
    
    const expr = P.vdot(
        P.vadd(v1, v2),
        P.vcross(v3, v4)
    );
    
    harness.testExpression(expr, 1, {
        var1: new Vec3(1, 0, 0),
        var2: new Vec3(0, 1, 0),
        var3: new Vec3(0, 0, 1),
        var4: new Vec3(1, 0, 0)
    });
});

// Export for browser
window.PeptideGLSLTests = GLSLTests;