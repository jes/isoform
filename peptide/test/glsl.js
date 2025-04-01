// GLSL test harness for Peptide
class GLSLTestHarness {
    constructor(name, intervalMode = false) {
        this.name = name;
        this.intervalMode = intervalMode;
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
out vec4 fragColor;

// begin glslIntervalLibrary
{{GLSL_INTERVAL_LIBRARY}}
// end glslIntervalLibrary

// begin peptideCode
{{PEPTIDE_CODE}}
// end peptideCode

void main() {
    // begin testCode
{{TEST_CODE}}
    // end testCode
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
        if (positionAttribLocation !== -1) {
            this.gl.enableVertexAttribArray(positionAttribLocation);
            this.gl.vertexAttribPointer(positionAttribLocation, 2, this.gl.FLOAT, false, 0, 0);
        }
        
        // Create and bind texcoord buffer
        const texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);
        
        const texCoordAttribLocation = this.gl.getAttribLocation(this.program, 'aTexCoord');
        if (texCoordAttribLocation !== -1) {
            this.gl.enableVertexAttribArray(texCoordAttribLocation);
            this.gl.vertexAttribPointer(texCoordAttribLocation, 2, this.gl.FLOAT, false, 0, 0);
        }
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
            .replace('{{TEST_CODE}}', testCode)
            .replace('{{GLSL_INTERVAL_LIBRARY}}', this.intervalMode ? glslIntervalLibrary : '');
        
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
                if (this.intervalMode) {
                    this.gl.uniform2fv(location, [value, value]);
                } else {
                    this.gl.uniform1f(location, value);
                }
                break;
            case 'vec3':
                if (this.intervalMode) {
                    // For interval mode, pass vec3 as mat3 where each column is (value, value, 0)
                    this.gl.uniformMatrix3fv(location, false, [
                        value[0], value[0], 0,
                        value[1], value[1], 0,
                        value[2], value[2], 0
                    ]);
                } else {
                    this.gl.uniform3fv(location, value);
                }
                break;
            case 'mat3':
                this.gl.uniformMatrix3fv(location, false, value);
                break;
            default:
                throw new Error(`Unsupported uniform type: ${type}`);
        }
    }
    
    render(variables = {}) {
        // Bind framebuffer and set viewport
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Clear the canvas
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        // Use the program BEFORE setting uniforms
        this.gl.useProgram(this.program);

        // Set uniform values
        for (const [name, value] of Object.entries(variables)) {
            if (value instanceof Vec3) {
                this.setUniform(name, 'vec3', [value.x, value.y, value.z]);
            } else if (typeof value === 'number') {
                this.setUniform(name, 'float', value);
            } else if (value instanceof Mat3) {
                this.setUniform(name, 'mat3', [
                    value.m[0][0], value.m[1][0], value.m[2][0],
                    value.m[0][1], value.m[1][1], value.m[2][1],
                    value.m[0][2], value.m[1][2], value.m[2][2]
                ]);
            }
        }
        
        // Setup geometry and draw
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
        
        // Use interval or direct code based on mode
        const glslCode = this.intervalMode ? 
            ssa.compileToGLSLInterval(`${this.getIntervalReturnType(returnType)} peptide()`) :
            ssa.compileToGLSL(`${returnType} peptide()`);
        
        // Create uniform declarations for variables
        let uniformDeclarations = '';
        let testCode = '';
        
        // Set up uniform declarations based on variable types and mode
        for (const [name, value] of Object.entries(variables)) {
            if (value instanceof Vec3) {
                uniformDeclarations += this.intervalMode ?
                    `uniform ivec3 ${name};\n` :
                    `uniform vec3 ${name};\n`;
            } else if (typeof value === 'number') {
                uniformDeclarations += this.intervalMode ?
                    `uniform ifloat ${name};\n` :
                    `uniform float ${name};\n`;
            } else if (value instanceof Mat3) {
                uniformDeclarations += this.intervalMode ?
                    `uniform mat3 ${name};\n` : // For now, matrices stay as mat3
                    `uniform mat3 ${name};\n`;
            }
        }
        
        // Create test code based on mode and type
        if (this.intervalMode) {
            testCode = this.createIntervalTestCode(peptideExpr.type, expectedValue);
        } else {
            testCode = this.createDirectTestCode(peptideExpr.type, expectedValue);
        }

        // Store the complete shader code for debugging
        const completeShaderCode = this.fsTemplate
            .replace('{{PEPTIDE_CODE}}', uniformDeclarations + glslCode)
            .replace('{{TEST_CODE}}', testCode)
            .replace('{{GLSL_INTERVAL_LIBRARY}}', this.intervalMode ? glslIntervalLibrary : '');

        const storeFailedTest = (actual) => {
            if (!window.peptideFailedTests) {
                window.peptideFailedTests = [];
            }
            
            window.peptideFailedTests.push({
                name: this.name,
                expected: JSON.stringify(expectedValue),
                actual,
                variables: variables,
                shaderCode: completeShaderCode
            });
        };

        try {
            // Create and link the fragment shader
            this.createFragmentShader(uniformDeclarations + glslCode, testCode);
        } catch (error) {
            console.error('GLSL test error:', error);
            storeFailedTest(error.message);
            throw error;
        }

        // Render and read back pixels - pass variables to render
        this.render(variables);
        const pixels = this.readPixels();
        
        // Check if the test passed (first pixel should be green)
        const passed = pixels[1] > 200 && pixels[0] < 50;
        
        if (!passed) {
            const debugValue = pixels[3];
            storeFailedTest(debugValue);
            throw new Error(`GLSL test failed. Expected: ${JSON.stringify(expectedValue)}, Debug value: ${debugValue}`);
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

    getIntervalReturnType(type) {
        return type === 'float' ? 'ifloat' : 'ivec3';
    }

    createDirectTestCode(type, expectedValue) {
        if (type === 'float') {
            return `
                float result = peptide();
                float expected = ${expectedValue.toFixed(16)};
                float epsilon = 0.001;
                if (abs(result - expected) < epsilon) {
                    fragColor = vec4(0.0, 1.0, 0.0, 1.0);
                } else {
                    fragColor = vec4(1.0, 0.0, 0.0, 1.0);
                    fragColor.a = result / 255.0;
                }
            `;
        } else if (type === 'vec3') {
            const expectedVec = expectedValue;
            return `
                vec3 result = peptide();
                vec3 expected = vec3(${expectedVec.x.toFixed(16)}, ${expectedVec.y.toFixed(16)}, ${expectedVec.z.toFixed(16)});
                float epsilon = 0.001;
                if (length(result - expected) < epsilon) {
                    fragColor = vec4(0.0, 1.0, 0.0, 1.0);
                } else {
                    fragColor = vec4(1.0, 0.0, 0.0, 1.0);
                    fragColor.a = length(result - expected) / 255.0;
                }
            `;
        }
    }

    createIntervalTestCode(type, expectedValue) {
        if (type === 'float') {
            return `
                ifloat result = peptide();
                float expected = ${expectedValue.toFixed(16)};
                float epsilon = 0.001;
                // Test if expected value is within the interval
                if (abs(result.x - expected) < epsilon && abs(result.y - expected) < epsilon) {
                    fragColor = vec4(0.0, 1.0, 0.0, 1.0);
                } else {
                    fragColor = vec4(1.0, 0.0, 0.0, 1.0);
                    fragColor.a = result.x / 255.0;
                }
            `;
        } else if (type === 'vec3') {
            const expectedVec = expectedValue;
            return `
                ivec3 result = peptide();
                vec3 expected = vec3(${expectedVec.x.toFixed(16)}, ${expectedVec.y.toFixed(16)}, ${expectedVec.z.toFixed(16)});
                float epsilon = 0.001;
                // Test if expected vector components are within their intervals
                bool withinBounds = 
                    abs(result[0].x - expected.x) < epsilon && abs(result[0].y - expected.x) < epsilon &&
                    abs(result[1].x - expected.y) < epsilon && abs(result[1].y - expected.y) < epsilon &&
                    abs(result[2].x - expected.z) < epsilon && abs(result[2].y - expected.z) < epsilon;
                
                if (withinBounds) {
                    fragColor = vec4(0.0, 1.0, 0.0, 1.0);
                } else {
                    fragColor = vec4(1.0, 0.0, 0.0, 1.0);
                    fragColor.a = result[0].x / 255.0;
                }
            `;
        }
    }
}

// Create a test suite for GLSL tests
const GLSLTests = new TestSuite();

// Helper function to add GLSL tests
function addGLSLTest(name, testFn) {
    GLSLTests.test(`${name} (direct)`, async () => {
        const harness = new GLSLTestHarness(name, false); // false = direct mode
        try {
            await testFn(harness);
        } finally {
            harness.cleanup();
        }
    });

    GLSLTests.test(`${name} (interval)`, async () => {
        const harness = new GLSLTestHarness(name, true); // true = interval mode
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
    const x = P.var('u_x');
    const expr = P.add(x, P.const(1));
    harness.testExpression(expr, 6, { u_x: 5 });
});

addGLSLTest('complex expression', async (harness) => {
    // (x + 1) * (y - 2)
    const expr = P.mul(
        P.add(P.var('u_x'), P.const(1)),
        P.sub(P.var('u_y'), P.const(2))
    );
    harness.testExpression(expr, 12, { u_x: 3, u_y: 5 }); // (3 + 1) * (5 - 2) = 4 * 3 = 12
});

addGLSLTest('min and max operations', async (harness) => {
    const a = P.const(5);
    const b = P.const(3);
    
    harness.testExpression(P.min(a, b), 3);
    harness.testExpression(P.max(a, b), 5);
});

addGLSLTest('vector constant evaluation', async (harness) => {
    const v = P.vconst(new Vec3(1, 2, 3));
    harness.testExpression(v, new Vec3(1, 2, 3));
});

addGLSLTest('vector variable evaluation', async (harness) => {
    const v = P.vvar('u_v');
    harness.testExpression(v, new Vec3(1, 2, 3), { u_v: new Vec3(1, 2, 3) });
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
    const v1 = P.vvar('u_v1');
    const v2 = P.vvar('u_v2');
    const v3 = P.vvar('u_v3');
    const v4 = P.vvar('u_v4');
    
    const expr = P.vdot(
        P.vadd(v1, v2),
        P.vcross(v3, v4)
    );
    
    harness.testExpression(expr, 1, {
        u_v1: new Vec3(1, 0, 0),
        u_v2: new Vec3(0, 1, 0),
        u_v3: new Vec3(0, 0, 1),
        u_v4: new Vec3(1, 0, 0)
    });
});

addGLSLTest('vector division', async (harness) => {
    const v = P.vconst(new Vec3(2, 4, 6));
    const s = P.const(2);
    harness.testExpression(P.vdiv(v, s), new Vec3(1, 2, 3));
});

addGLSLTest('vector normalization', async (harness) => {
    const v = P.vconst(new Vec3(3, 0, 0));
    harness.testExpression(P.vlength(v), 3);
});

addGLSLTest('vector component extraction with variables', async (harness) => {
    const v = P.vvar('u_v');
    
    harness.testExpression(P.vecX(v), 1, { u_v: new Vec3(1, 2, 3) });
    harness.testExpression(P.vecY(v), 2, { u_v: new Vec3(1, 2, 3) });
    harness.testExpression(P.vecZ(v), 3, { u_v: new Vec3(1, 2, 3) });
});

addGLSLTest('complex arithmetic expression', async (harness) => {
    // Testing ((a + b) * (c - d)) / e
    const a = P.var('u_a');
    const b = P.var('u_b');
    const c = P.var('u_c');
    const d = P.var('u_d');
    const e = P.var('u_e');
    
    const expr = P.div(
        P.mul(
            P.add(a, b),
            P.sub(c, d)
        ),
        e
    );
    
    // With values: ((2 + 3) * (10 - 4)) / 2 = 15
    harness.testExpression(expr, 15, {
        u_a: 2,
        u_b: 3,
        u_c: 10,
        u_d: 4,
        u_e: 2
    });
});

addGLSLTest('nested vector operations', async (harness) => {
    // Testing (v1 × v2) + (v3 × v4)
    const v1 = P.vvar('u_v1');
    const v2 = P.vvar('u_v2');
    const v3 = P.vvar('u_v3');
    const v4 = P.vvar('u_v4');
    
    const expr = P.vadd(
        P.vcross(v1, v2),
        P.vcross(v3, v4)
    );
    
    harness.testExpression(expr, new Vec3(0, 0, 2), {
        u_v1: new Vec3(1, 0, 0),
        u_v2: new Vec3(0, 1, 0),
        u_v3: new Vec3(0, 1, 0),
        u_v4: new Vec3(-1, 0, 0)
    });
});

addGLSLTest('mixed scalar and vector operations', async (harness) => {
    // Testing (v1 · v2) * s + (v3 · v4)
    const v1 = P.vvar('u_v1');
    const v2 = P.vvar('u_v2');
    const v3 = P.vvar('u_v3');
    const v4 = P.vvar('u_v4');
    const s = P.var('u_s');
    
    const expr = P.add(
        P.mul(P.vdot(v1, v2), s),
        P.vdot(v3, v4)
    );
    
    harness.testExpression(expr, 7, {
        u_v1: new Vec3(1, 0, 0),
        u_v2: new Vec3(2, 0, 0),
        u_s: 3,
        u_v3: new Vec3(0, 1, 0),
        u_v4: new Vec3(0, 1, 0)
    }); // (2 * 3) + 1 = 7
});

addGLSLTest('vector absolute value', async (harness) => {
    const v = P.vconst(new Vec3(-1, -2, 3));
    harness.testExpression(P.vabs(v), new Vec3(1, 2, 3));
});

addGLSLTest('vector minimum', async (harness) => {
    const v1 = P.vconst(new Vec3(1, 4, 3));
    const v2 = P.vconst(new Vec3(2, 1, 5));
    harness.testExpression(P.vmin(v1, v2), new Vec3(1, 1, 3));
});

addGLSLTest('vector maximum', async (harness) => {
    const v1 = P.vconst(new Vec3(1, 4, 3));
    const v2 = P.vconst(new Vec3(2, 1, 5));
    harness.testExpression(P.vmax(v1, v2), new Vec3(2, 4, 5));
});

addGLSLTest('vector min/max with variables', async (harness) => {
    const v1 = P.vvar('u_v1');
    const v2 = P.vvar('u_v2');
    
    harness.testExpression(P.vmin(v1, v2), new Vec3(1, 1, 3), {
        u_v1: new Vec3(1, 4, 3),
        u_v2: new Vec3(2, 1, 5)
    });
    
    harness.testExpression(P.vmax(v1, v2), new Vec3(2, 4, 5), {
        u_v1: new Vec3(1, 4, 3),
        u_v2: new Vec3(2, 1, 5)
    });
});

addGLSLTest('clamp operations', async (harness) => {
    const x = P.const(5);
    const min = P.const(2);
    const max = P.const(4);
    
    harness.testExpression(P.clamp(x, min, max), 4); // 5 clamped between 2 and 4
    harness.testExpression(P.clamp(P.const(1), min, max), 2); // 1 clamped between 2 and 4
    harness.testExpression(P.clamp(P.const(3), min, max), 3); // 3 stays between 2 and 4
    
    // Test with variables
    const vx = P.var('u_x');
    const vmin = P.var('u_min');
    const vmax = P.var('u_max');
    
    harness.testExpression(P.clamp(vx, vmin, vmax), 4, {
        u_x: 5,
        u_min: 2,
        u_max: 4
    });
});

addGLSLTest('mix operations', async (harness) => {
    const a = P.const(0);
    const b = P.const(10);
    const t = P.const(0.3);
    
    harness.testExpression(P.mix(a, b, t), 3); // mix(0, 10, 0.3) = 3
    harness.testExpression(P.mix(a, b, P.const(0)), 0); // mix(0, 10, 0) = 0
    harness.testExpression(P.mix(a, b, P.const(1)), 10); // mix(0, 10, 1) = 10
    
    // Test with variables
    const va = P.var('u_a');
    const vb = P.var('u_b');
    const vt = P.var('u_t');
    
    harness.testExpression(P.mix(va, vb, vt), 25, {
        u_a: 0,
        u_b: 100,
        u_t: 0.25
    }); // mix(0, 100, 0.25) = 25
});

addGLSLTest('smin operations', async (harness) => {
    // Test with k=0 (should be exactly like min)
    harness.testExpression(P.smin(P.const(5), P.const(3), P.const(0)), 3, {}, '==');
    
    // Test that smin in GLSL behaves the same as in JavaScript
    const a = P.const(11);
    const b = P.const(10);
    const k = P.const(5);
    
    const expr1 = P.smin(a, b, k);

    const expected = expr1.evaluate({});
    
    harness.testExpression(expr1, expected, {});
    
    // Test with variables
    const va = P.var('u_a');
    const vb = P.var('u_b');
    const vk = P.var('u_k');

    const values = {
        u_a: 11,
        u_b: 10,
        u_k: 5
    };

    const expr2 = P.smin(va, vb, vk);
    const expected2 = expr2.evaluate(values);
    
    // Test that result is less than the regular min
    harness.testExpression(expr2, expected2, values);
});

addGLSLTest('smax operations', async (harness) => {
    // Test with k=0 (should be exactly like max)
    harness.testExpression(P.smax(P.const(5), P.const(3), P.const(0)), 5);
    
    // Test that smax in GLSL behaves the same as in JavaScript
    const a = P.const(10);
    const b = P.const(11);
    const k = P.const(5);
    
    const expr1 = P.smax(a, b, k);
    const expected = expr1.evaluate({});
    
    harness.testExpression(expr1, expected, {});
    
    // Test with variables
    const va = P.var('u_a');
    const vb = P.var('u_b');
    const vk = P.var('u_k');

    const values = {
        u_a: 10,
        u_b: 11,
        u_k: 5
    };

    const expr2 = P.smax(va, vb, vk);
    const expected2 = expr2.evaluate(values);
    
    // Test that result is greater than the regular max
    harness.testExpression(expr2, expected2, values);
});

addGLSLTest('chmin operations', async (harness) => {
    const a = P.const(5);
    const b = P.const(3);
    const k = P.const(2);
    
    // Test basic chmin
    harness.testExpression(P.chmin(a, b, k), 3);
    
    // Test with close values
    const c = P.const(1.1);
    const d = P.const(1.0);
    const k2 = P.const(0.5);
    const expr = P.chmin(c, d, k2);
    const expected = expr.evaluate({}); // Use JS evaluation as reference
    harness.testExpression(expr, expected);
    
    // Test with variables
    const va = P.var('u_x');
    const vb = P.var('u_y');
    const vk = P.var('u_k');
    const varExpr = P.chmin(va, vb, vk);
    harness.testExpression(varExpr, 3, {
        u_x: 5,
        u_y: 3,
        u_k: 2
    });
});

addGLSLTest('chmax operations', async (harness) => {
    const a = P.const(5);
    const b = P.const(3);
    const k = P.const(2);
    
    // Test basic chmax
    const expected = 5;
    harness.testExpression(P.chmax(a, b, k), expected);
    
    // Test with close values
    const c = P.const(1.0);
    const d = P.const(1.1);
    const k2 = P.const(0.5);
    const expr = P.chmax(c, d, k2);
    const expected2 = expr.evaluate({}); // Use JS evaluation as reference
    harness.testExpression(expr, expected2);
    
    // Test with variables
    const va = P.var('u_x');
    const vb = P.var('u_y');
    const vk = P.var('u_k');
    const varExpr = P.chmax(va, vb, vk);
    harness.testExpression(varExpr, 5, {
        u_x: 5,
        u_y: 3,
        u_k: 2
    });
});

addGLSLTest('chmin/chmax with varying k', async (harness) => {
    const a = P.const(1);
    const b = P.const(2);
    
    // Test with different k values
    const kValues = [0, 0.5, 1, 2];
    
    for (const k of kValues) {
        const chminExpr = P.chmin(a, b, P.const(k));
        const chmaxExpr = P.chmax(a, b, P.const(k));
        
        const expectedChmin = chminExpr.evaluate({});
        const expectedChmax = chmaxExpr.evaluate({});
        
        harness.testExpression(chminExpr, expectedChmin);
        harness.testExpression(chmaxExpr, expectedChmax);
    }
});

addGLSLTest('step operations', async (harness) => {
    // Test when first argument is less than second
    const a1 = P.const(2);
    const b1 = P.const(5);
    harness.testExpression(P.step(a1, b1), 1.0); // 2 <= 5, should return 1.0
    
    // Test when first argument equals second
    const a2 = P.const(3);
    const b2 = P.const(3);
    harness.testExpression(P.step(a2, b2), 1.0); // 3 <= 3, should return 1.0
    
    // Test when first argument is greater than second
    const a3 = P.const(7);
    const b3 = P.const(4);
    harness.testExpression(P.step(a3, b3), 0.0); // 7 > 4, should return 0.0
    
    // Test with variables
    const va = P.var('u_x');
    const vb = P.var('u_y');
    const stepVar = P.step(va, vb);
    harness.testExpression(stepVar, 1.0, { u_x: 1, u_y: 2 }); // 1 <= 2
    harness.testExpression(stepVar, 0.0, { u_x: 3, u_y: 2 }); // 3 > 2
});

addGLSLTest('trigonometric functions', async (harness) => {
    // Test sin
    const angle = P.const(Math.PI / 2);
    const sinExpr = P.sin(angle);
    harness.testExpression(sinExpr, 1.0);
    
    // Test cos
    const cosExpr = P.cos(angle);
    harness.testExpression(cosExpr, 0.0);
    
    // Test with variables
    const x = P.var('u_x');
    const sinVar = P.sin(x);
    const cosVar = P.cos(x);
    
    harness.testExpression(sinVar, 0.0, { u_x: 0 }); // sin(0) = 0
    harness.testExpression(cosVar, 1.0, { u_x: 0 }); // cos(0) = 1
    
    // Test composition of sin and cos
    const composed = P.add(
        P.mul(P.sin(x), P.sin(x)),
        P.mul(P.cos(x), P.cos(x))
    );
    harness.testExpression(composed, 1.0, { u_x: 1.234 }); // sin²(x) + cos²(x) = 1
});

addGLSLTest('vector modulo operations', async (harness) => {
    // Test with constant vector and scalar
    const v = P.vconst(new Vec3(7, -8, 9));
    const s = P.const(4);
    const mod = P.vmod(v, s);
    harness.testExpression(mod, new Vec3(3, 0, 1));
    
    // Test with variables
    const vv = P.vvar('u_v');
    const sv = P.var('u_s');
    const modVar = P.vmod(vv, sv);
    harness.testExpression(modVar, new Vec3(1, 1, 0), {
        u_v: new Vec3(10, -11, 12),
        u_s: 3
    });
});

addGLSLTest('absolute value', async (harness) => {
    // Test with positive constant
    const pos = P.const(5);
    harness.testExpression(P.abs(pos), 5);
    
    // Test with negative constant
    const neg = P.const(-3);
    harness.testExpression(P.abs(neg), 3);
    
    // Test with variable
    const x = P.var('u_x');
    const absVar = P.abs(x);
    harness.testExpression(absVar, 7, { u_x: -7 });
    harness.testExpression(absVar, 4, { u_x: 4 });
    
    // Test with expression
    const expr = P.abs(P.sub(P.const(3), P.const(5)));
    harness.testExpression(expr, 2); // abs(3 - 5) = 2
});

addGLSLTest('matrix constant evaluation', async (harness) => {
    // Create a test matrix
    const m = new Mat3(
        1, 2, 3,
        4, 5, 6,
        7, 8, 9
    );
    const matExpr = P.mconst(m);
    
    // Test that the matrix is correctly passed to GLSL
    // We'll test by multiplying with a known vector and checking the result
    const vecExpr = P.vconst(new Vec3(1, 1, 1));
    const result = P.mvmul(matExpr, vecExpr);
    
    // 1*1 + 2*1 + 3*1 = 6
    // 4*1 + 5*1 + 6*1 = 15
    // 7*1 + 8*1 + 9*1 = 24
    harness.testExpression(result, new Vec3(6, 15, 24));
});

addGLSLTest('matrix-vector multiplication', async (harness) => {
    // Create a rotation matrix (90 degrees around Z axis)
    const rotZ90 = new Mat3(
        0, -1, 0,
        1, 0, 0,
        0, 0, 1
    );
    const matExpr = P.mconst(rotZ90);
    
    // Test vectors
    const vecX = P.vconst(new Vec3(1, 0, 0));
    const vecY = P.vconst(new Vec3(0, 1, 0));
    
    // Rotating (1,0,0) by 90 degrees around Z should give (0,1,0)
    harness.testExpression(P.mvmul(matExpr, vecX), new Vec3(0, 1, 0));
    
    // Rotating (0,1,0) by 90 degrees around Z should give (-1,0,0)
    harness.testExpression(P.mvmul(matExpr, vecY), new Vec3(-1, 0, 0));
    
    // Test with variables
    const matVar = P.mvar('u_mat');
    const vecVar = P.vvar('u_vec');
    const mulExpr = P.mvmul(matVar, vecVar);
    
    // Test rotation of (0,1,0) by 90 degrees around Z
    harness.testExpression(mulExpr, new Vec3(-1, 0, 0), {
        u_mat: rotZ90,
        u_vec: new Vec3(0, 1, 0)
    });
});

addGLSLTest('matrix-matrix multiplication', async (harness) => {
    // Create two rotation matrices
    const rotX90 = new Mat3(
        1, 0, 0,
        0, 0, -1,
        0, 1, 0
    );
    const rotZ90 = new Mat3(
        0, -1, 0,
        1, 0, 0,
        0, 0, 1
    );
    
    const matX = P.mconst(rotX90);
    const matZ = P.mconst(rotZ90);
    
    // Multiply matrices
    const combined = P.mmul(matZ, matX);
    
    // Test the combined rotation on a vector
    const vecX = P.vconst(new Vec3(1, 0, 0));
    const result = P.mvmul(combined, vecX);
    
    // Rotating (1,0,0) first by 90° around X, then by 90° around Z
    // (1,0,0) -> (1,0,0) -> (0,1,0)
    harness.testExpression(result, new Vec3(0, 1, 0));
    
    // Test with variables
    const matA = P.mvar('u_matA');
    const matB = P.mvar('u_matB');
    const mmulExpr = P.mmul(matA, matB);
    const vecTest = P.vconst(new Vec3(0, 1, 0));
    
    // Test combined rotation on (0,1,0)
    harness.testExpression(P.mvmul(mmulExpr, vecTest), new Vec3(0, 0, 1), {
        u_matA: rotZ90,
        u_matB: rotX90
    });
});

addGLSLTest('matrix transpose', async (harness) => {
    // Create a test matrix
    const m = new Mat3(
        1, 2, 3,
        4, 5, 6,
        7, 8, 9
    );
    
    const matExpr = P.mconst(m);
    const transposed = P.mtranspose(matExpr);
    
    // Test the transposed matrix by multiplying with a vector
    const vecTest = P.vconst(new Vec3(1, 1, 1));
    const result = P.mvmul(transposed, vecTest);
    
    // Transposed matrix should be:
    // [ 1 4 7 ]
    // [ 2 5 8 ]
    // [ 3 6 9 ]
    // Multiplying by (1,1,1) gives (12, 15, 18)
    harness.testExpression(result, new Vec3(12, 15, 18));
    
    // Test with variables
    const matVar = P.mvar('u_mat');
    const transposeExpr = P.mtranspose(matVar);
    
    harness.testExpression(P.mvmul(transposeExpr, vecTest), new Vec3(12, 15, 18), {
        u_mat: m
    });
});

addGLSLTest('matrix rotation around axes', async (harness) => {
    // Test rotation around X axis
    const vecY = P.vconst(new Vec3(0, 1, 0));
    const vecZ = P.vconst(new Vec3(0, 0, 1));
    
    // Create rotation matrices using Peptide
    const rotX90 = P.mconst(new Mat3(
        1, 0, 0,
        0, 0, -1,
        0, 1, 0
    ));
    
    // Rotating (0,1,0) by 90° around X should give (0,0,1)
    harness.testExpression(P.mvmul(rotX90, vecY), new Vec3(0, 0, 1));
    
    // Rotating (0,0,1) by 90° around X should give (0,-1,0)
    harness.testExpression(P.mvmul(rotX90, vecZ), new Vec3(0, -1, 0));
    
    // Test rotation around Y axis
    const vecX = P.vconst(new Vec3(1, 0, 0));
    
    const rotY90 = P.mconst(new Mat3(
        0, 0, 1,
        0, 1, 0,
        -1, 0, 0
    ));
    
    // Rotating (1,0,0) by 90° around Y should give (0,0,-1)
    harness.testExpression(P.mvmul(rotY90, vecX), new Vec3(0, 0, -1));
    
    // Rotating (0,0,1) by 90° around Y should give (1,0,0)
    harness.testExpression(P.mvmul(rotY90, vecZ), new Vec3(1, 0, 0));
});

addGLSLTest('matrix rotateToAxis', async (harness) => {
    // Test the rotateToAxis function with a simple axis
    const rotMatrix = P.mconst(new Mat3().rotateToAxis(new Vec3(0, 0, 1)));
    
    // Test by applying to unit vectors
    const vecX = P.vconst(new Vec3(1, 0, 0));
    const vecY = P.vconst(new Vec3(0, 1, 0));
    
    // For Z axis, X and Y should remain unchanged
    harness.testExpression(P.mvmul(rotMatrix, vecX), new Vec3(1, 0, 0));
    harness.testExpression(P.mvmul(rotMatrix, vecY), new Vec3(0, 1, 0));
    
    // Test with a non-axis-aligned vector
    const customRotMatrix = P.mconst(new Mat3().rotateToAxis(new Vec3(1, 1, 1).normalize()));
    
    // The Z axis of the resulting matrix should be the normalized input axis
    const vecZ = P.vconst(new Vec3(0, 0, 1));
    const transformedZ = P.mvmul(customRotMatrix, vecZ);
    
    // Should be approximately (1,1,1)/√3
    const expectedNorm = new Vec3(1, 1, 1).normalize();
    harness.testExpression(transformedZ, expectedNorm);
});

addGLSLTest('tan function', async (harness) => {
    // Test tan with constants
    const angle = P.const(Math.PI / 4); // 45 degrees
    const tanExpr = P.tan(angle);
    harness.testExpression(tanExpr, 1.0); // tan(45°) = 1.0

    // Test with variables
    const x = P.var('u_x');
    const tanVar = P.tan(x);
    
    harness.testExpression(tanVar, 0.0, { u_x: 0 }); // tan(0) = 0
    harness.testExpression(tanVar, 1.0, { u_x: Math.PI / 4 }); // tan(π/4) = 1
    
    // Test relationship with sin and cos: tan(x) = sin(x)/cos(x)
    const angle2 = P.const(0.5);
    const sinDiv = P.div(P.sin(angle2), P.cos(angle2));
    const tanSame = P.tan(angle2);
    
    // Both expressions should produce the same result
    const expected = Math.tan(0.5);
    harness.testExpression(sinDiv, expected);
    harness.testExpression(tanSame, expected);
});

addGLSLTest('absBevelC2 and rampBevelC2 functions', async (harness) => {
    // Test absBevelC2 with positive value
    const abs1 = P.absBevelC2(P.const(5), P.const(1), P.const(0.9));
    harness.testExpression(abs1, 5.0);
    
    // Test absBevelC2 with negative value
    const abs2 = P.absBevelC2(P.const(-3), P.const(1), P.const(0.9));
    harness.testExpression(abs2, 3.0);
    
    // Test absBevelC2 with value near zero
    const abs3 = P.absBevelC2(P.const(0), P.const(1), P.const(0.9));
    // Use the JS evaluation as reference to ensure consistent results
    const jsResult = abs3.evaluate({});
    harness.testExpression(abs3, jsResult);
    
    // Test rampBevelC2 with positive value
    const ramp1 = P.rampBevelC2(P.const(5), P.const(1), P.const(0.9));
    harness.testExpression(ramp1, 5.0);
    
    // Test rampBevelC2 with negative value
    const ramp2 = P.rampBevelC2(P.const(-3), P.const(1), P.const(0.9));
    harness.testExpression(ramp2, 0.0);
    
    // Test rampBevelC2 with value near zero
    const ramp3 = P.rampBevelC2(P.const(0), P.const(1), P.const(0.9));
    // Use the JS evaluation as reference
    const jsResult2 = ramp3.evaluate({});
    harness.testExpression(ramp3, jsResult2);
    
    // Test with variables
    const x = P.var('u_x');
    const w = P.var('u_w');
    const s = P.var('u_s');
    
    const absVar = P.absBevelC2(x, w, s);
    const rampVar = P.rampBevelC2(x, w, s);
    
    harness.testExpression(absVar, 3.0, { u_x: -3, u_w: 1, u_s: 0.9 });
    harness.testExpression(rampVar, 0.0, { u_x: -3, u_w: 1, u_s: 0.9 });
});

addGLSLTest('enhanced vector normalization', async (harness) => {
    // Test normalization of different vectors
    const v1 = P.vconst(new Vec3(3, 0, 0));
    const norm1 = P.vnormalize(v1);
    harness.testExpression(norm1, new Vec3(1, 0, 0));
    
    const v2 = P.vconst(new Vec3(1, 1, 1));
    const norm2 = P.vnormalize(v2);
    const expected = new Vec3(1, 1, 1).normalize();
    harness.testExpression(norm2, expected);
    
    // Test with variables
    const v = P.vvar('u_v');
    const norm = P.vnormalize(v);
    
    // Test unit vector remains unit
    harness.testExpression(norm, new Vec3(1, 0, 0), { u_v: new Vec3(1, 0, 0) });
    
    // Test normalization of variable vector
    harness.testExpression(norm, expected, { u_v: new Vec3(1, 1, 1) });
    
    // Test that |normalize(v)| = 1 by checking length of normalized vector
    const normLength = P.vlength(norm);
    harness.testExpression(normLength, 1.0, { u_v: new Vec3(5, 7, -3) });
});

addGLSLTest('vector component-wise operations', async (harness) => {
    // Test component-wise vector operations
    const v1 = P.vconst(new Vec3(2, 3, 4));
    const v2 = P.vconst(new Vec3(1, 2, 3));
    
    // Component-wise multiplication
    const vmul = P.vmulv(v1, v2);
    harness.testExpression(vmul, new Vec3(2, 6, 12)); // (2*1, 3*2, 4*3)
    
    // Test with variables
    const va = P.vvar('u_va');
    const vb = P.vvar('u_vb');
    
    const vmulVar = P.vmulv(va, vb);
    
    harness.testExpression(vmulVar, new Vec3(2, 6, 12), { 
        u_va: new Vec3(2, 3, 4), 
        u_vb: new Vec3(1, 2, 3) 
    });
});

// Export for browser
window.PeptideGLSLTests = GLSLTests;