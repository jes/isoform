// WebGL setup and management
const renderer = {
    canvas: null,
    gl: null,
    programInfos: [], // Array to store multiple shader programs
    currentProgramIndex: 0,
    positionBuffer: null,
    startTime: Date.now(),
    vertexShaderSource: null,
    fragmentShaderSource: null,
    
    frameCount: 0,
    lastFpsUpdateTime: 0,
    fpsUpdateInterval: 500, // ms
    fpsElement: null,
    currentFps: 0,
    
    resolutionScale: 1.0, // Values > 1.0 = supersampling, < 1.0 = downsampling
    
    renderTarget: null,
    renderTexture: null,
    renderBuffer: null,
    quadBuffer: null,
    displayProgram: null,
    
    coordDisplay: null,
    
    mouseDebounceTimeout: null,
    mouseDebounceDelay: 50, // ms
    lastMousePosition: null,
    
    async init() {
        this.canvas = document.getElementById('glCanvas');
        this.coordDisplay = document.getElementById('coord-display');
        
        // Add mousemove handler for coordinate display
        this.canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
        this.canvas.addEventListener('mouseout', () => {
            if (this.coordDisplay) this.coordDisplay.style.display = 'none';
        });

        this.canvas.addEventListener('webglcontextlost', (event) => {
            console.log('WebGL context lost');
            alert('WebGL context lost! Sorry');
            event.preventDefault();
        });
        this.canvas.addEventListener('webglcontextrestored', (event) => {
            console.log('WebGL context restored');
            event.preventDefault();
        });
        this.gl = this.canvas.getContext('webgl2');
        if (!this.gl) {
            alert('Unable to initialize WebGL. Your browser may not support it.');
            return false;
        }
        
        // Create buffer for full-screen quad
        const positions = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0];
        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
        
        // Load shader sources
        try {
            this.vertexShaderSource = window.vertexShaderSource;
            this.fragmentShaderSource = window.fragmentShaderSource;
            await this.createShaderProgram([this.fragmentShaderSource]);
            
            // Initialize our program array with the default program if we only have one
            if (this.programInfos.length === 0 && this.programInfo) {
                this.programInfos.push(this.programInfo);
            }
        } catch (error) {
            console.error('Failed to load shaders:', error);
            return false;
        }
        
        // Initialize FPS counter
        this.fpsElement = document.getElementById('fps-counter');
        this.lastFpsUpdateTime = Date.now();
        
        // Create the framebuffer and texture objects (but don't initialize them yet)
        this.setupRenderTarget();
        
        // Create a simple shader program for displaying the texture
        await this.createDisplayProgram();
        
        // Now resize the canvas, which will properly initialize the render target
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        return true;
    },
    
    setupRenderTarget() {
        const gl = this.gl;
        
        // Create primary framebuffer
        this.renderTarget = gl.createFramebuffer();
        this.renderTexture = gl.createTexture();
        this.renderBuffer = gl.createRenderbuffer();
        
        // Create secondary framebuffer for ping-pong rendering
        this.secondaryRenderTarget = gl.createFramebuffer();
        this.secondaryRenderTexture = gl.createTexture();
        this.secondaryRenderBuffer = gl.createRenderbuffer();
    },
    
    async createDisplayProgram() {
        // Simple vertex shader that just passes through position and texture coordinates
        const displayVertexShader = `
            attribute vec2 position;
            varying vec2 vTexCoord;
            void main() {
                vTexCoord = position * 0.5 + 0.5;
                gl_Position = vec4(position, 0.0, 1.0);
            }
        `;
        
        // Simple fragment shader that samples from the texture
        const displayFragmentShader = `
            precision highp float;
            varying vec2 vTexCoord;
            uniform sampler2D uTexture;
            void main() {
                gl_FragColor = texture2D(uTexture, vTexCoord);
            }
        `;
        
        const vertexShader = await this.compileShader(displayVertexShader, this.gl.VERTEX_SHADER);
        const fragmentShader = await this.compileShader(displayFragmentShader, this.gl.FRAGMENT_SHADER);
        
        if (!vertexShader || !fragmentShader) {
            console.error("Failed to compile display shaders");
            return;
        }
        
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Display program linking error:', this.gl.getProgramInfoLog(program));
            return;
        }
        
        this.displayProgram = {
            program: program,
            attribLocations: {
                position: this.gl.getAttribLocation(program, 'position'),
            },
            uniformLocations: {
                texture: this.gl.getUniformLocation(program, 'uTexture'),
            }
        };
    },
    
    resizeCanvas() {
        // Get the CSS size of the canvas
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        
        // Make sure the canvas drawing buffer matches the display size
        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
        }
        
        // Calculate the render target size based on resolution scale
        const renderWidth = Math.max(1, Math.floor(displayWidth * this.resolutionScale));
        const renderHeight = Math.max(1, Math.floor(displayHeight * this.resolutionScale));
        
        const gl = this.gl;
        
        // Configure both render targets
        const configureRenderTarget = (target, texture, renderbuffer) => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, target);
            
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(
                gl.TEXTURE_2D, 0, gl.RGBA, 
                renderWidth, renderHeight, 0, 
                gl.RGBA, gl.UNSIGNED_BYTE, null
            );
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            
            gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
            gl.renderbufferStorage(
                gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, 
                renderWidth, renderHeight
            );
            
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
            
            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (status !== gl.FRAMEBUFFER_COMPLETE) {
                console.error('Framebuffer not complete:', status);
            }
        };
        
        // Configure both render targets
        configureRenderTarget(this.renderTarget, this.renderTexture, this.renderBuffer);
        configureRenderTarget(this.secondaryRenderTarget, this.secondaryRenderTexture, this.secondaryRenderBuffer);
        
        // Reset bindings
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        // Set viewport to match the canvas size
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    },
    
    // Update to allow values above 1.0
    setResolutionScale(scale) {
        if (scale > 0.1 && scale <= 8.0) {
            this.resolutionScale = scale;
            this.resizeCanvas();
        }
    },
    
    async compileShader(source, type) {
        // Create shader object
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        
        // Start compilation
        this.gl.compileShader(shader);
        
        // Use requestAnimationFrame to yield to the UI thread
        await new Promise(resolve => {
            const checkCompilation = () => {
                // Check if compilation is complete
                if (this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
                    resolve(shader);
                } else {
                    console.warn('Shader source:', source);
                    console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
                    alert('Shader compilation error:\n' + this.gl.getShaderInfoLog(shader));
                    this.gl.deleteShader(shader);
                    resolve(null);
                }
            };
            
            // Use setTimeout to give the browser a chance to compile the shader
            // without blocking the UI thread
            setTimeout(checkCompilation, 0);
        });
        
        return shader;
    },
    
    async createShaderProgram(fragmentShaders) {
        const startTime = performance.now();
        
        // Clean up existing programs first
        if (this.programInfos.length > 0) {
            for (const programInfo of this.programInfos) {
                if (programInfo && programInfo.program) {
                    // Get attached shaders before deleting the program
                    const shaders = this.gl.getAttachedShaders(programInfo.program);
                    
                    // Detach and delete all shaders
                    if (shaders) {
                        for (const shader of shaders) {
                            this.gl.detachShader(programInfo.program, shader);
                            this.gl.deleteShader(shader);
                        }
                    }
                    
                    // Delete the program itself
                    this.gl.deleteProgram(programInfo.program);
                }
            }
        }
        
        // Clear existing programs
        this.programInfos = [];
        
        // Process each shader pair (vs, fs)
        for (let i = 0; i < fragmentShaders.length; i++) {
            const fsSource = fragmentShaders[i];
            
            if (!fsSource) continue;
            
            const vertexShader = await this.compileShader(this.vertexShaderSource, this.gl.VERTEX_SHADER);
            const fragmentShader = await this.compileShader(fsSource, this.gl.FRAGMENT_SHADER);

            if (!vertexShader || !fragmentShader) {
                console.error(`Failed to compile shader pair ${i}`);
                continue;
            }

            const program = this.gl.createProgram();
            this.gl.attachShader(program, vertexShader);
            this.gl.attachShader(program, fragmentShader);
            this.gl.linkProgram(program);

            if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
                console.error('Program linking error:', this.gl.getProgramInfoLog(program));
                continue;
            }

            const programInfo = {
                program: program,
                attribLocations: {
                    vertexPosition: this.gl.getAttribLocation(program, 'aVertexPosition'),
                },
                uniformLocations: {
                    resolution: this.gl.getUniformLocation(program, 'uResolution'),
                    time: this.gl.getUniformLocation(program, 'uTime'),
                    cameraPosition: this.gl.getUniformLocation(program, 'uCameraPosition'),
                    cameraTarget: this.gl.getUniformLocation(program, 'uCameraTarget'),
                    cameraZoom: this.gl.getUniformLocation(program, 'uCameraZoom'),
                    rotationMatrix: this.gl.getUniformLocation(program, 'uRotationMatrix'),
                    showEdges: this.gl.getUniformLocation(program, 'uShowEdges'),
                    stepFactor: this.gl.getUniformLocation(program, 'stepFactor'),
                    uShowField: this.gl.getUniformLocation(program, 'uShowField'),
                    uShowSteps: this.gl.getUniformLocation(program, 'uShowSteps'),
                    opacity: this.gl.getUniformLocation(program, 'uOpacity'),
                    objectColor: this.gl.getUniformLocation(program, 'uObjectColor'),
                    // Add a new uniform for accessing the previous render output
                    previousTexture: this.gl.getUniformLocation(program, 'uPreviousTexture'),
                },
            };
            
            this.programInfos.push(programInfo);
        }
        
        // Set the main programInfo to the first one for backward compatibility
        this.programInfo = this.programInfos.length > 0 ? this.programInfos[0] : null;

        const endTime = performance.now();
        console.log(`Shader programs creation took ${(endTime - startTime).toFixed(3)} ms`);
        return this.programInfos.length > 0 ? this.programInfos[0].program : null;
    },
    
    render() {
        if (this.programInfos.length === 0 || !this.displayProgram) {
            return;
        }

        const currentTime = (Date.now() - this.startTime) / 1000;
        const gl = this.gl;
        
        // Set viewport to the render target size
        const renderWidth = Math.floor(this.canvas.width * this.resolutionScale);
        const renderHeight = Math.floor(this.canvas.height * this.resolutionScale);
        gl.viewport(0, 0, renderWidth, renderHeight);
        
        // Use a single framebuffer for all passes
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.renderTarget);
        gl.clearColor(0.0, 0.0, 0.0, 0.0); // Clear with transparent black
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        // First pass - direct rendering
        gl.disable(gl.BLEND);
        this.renderShaderPass(this.programInfos[0], currentTime, renderWidth, renderHeight, null);
        
        // For subsequent passes, just blend on top of the existing content
        if (this.programInfos.length > 1) {
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            
            for (let i = 1; i < this.programInfos.length; i++) {
                this.renderShaderPass(this.programInfos[i], currentTime, renderWidth, renderHeight, null);
            }
        }
        
        // Finally, render the result to the screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.BLEND);
        
        // Use the display program to render the final texture
        gl.useProgram(this.displayProgram.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.renderTexture);
        gl.uniform1i(this.displayProgram.uniformLocations.texture, 0);
        
        // Draw the quad
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(
            this.displayProgram.attribLocations.position,
            2, gl.FLOAT, false, 0, 0
        );
        gl.enableVertexAttribArray(this.displayProgram.attribLocations.position);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        // Update FPS counter
        this.updateFpsCounter();
    },
    
    updateFpsCounter() {
        this.frameCount++;
        
        const now = Date.now();
        const elapsed = now - this.lastFpsUpdateTime;
        
        // Update FPS display every interval
        if (elapsed >= this.fpsUpdateInterval) {
            // Calculate FPS: frames / seconds
            this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
            
            // Update display
            if (this.fpsElement) {
                this.fpsElement.textContent = `FPS: ${this.currentFps}`;
            }
            
            // Reset counters
            this.frameCount = 0;
            this.lastFpsUpdateTime = now;
        }
    },
    
    onCanvasMouseMove(e) {
        if (!this.coordDisplay || !this.programInfo) return;

        // Get canvas-relative coordinates
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Store current mouse position
        this.lastMousePosition = { x, y, clientX: e.clientX, clientY: e.clientY };

        // Clear any existing timeout
        if (this.mouseDebounceTimeout) {
            clearTimeout(this.mouseDebounceTimeout);
        }

        // Hide coordinates while moving
        this.coordDisplay.style.display = 'none';

        // Set new timeout
        this.mouseDebounceTimeout = setTimeout(() => {
            if (!this.lastMousePosition) return;
            
            // Use the last stored position for calculations
            const p = {
                x: (2.0 * this.lastMousePosition.x / this.canvas.width - 1.0) * (this.canvas.width / this.canvas.height),
                y: 1.0 - 2.0 * this.lastMousePosition.y / this.canvas.height
            };

            const forward = camera.target.sub(camera.position).normalize();
            const right = forward.cross(new Vec3(0, 1, 0)).normalize();
            const up = right.cross(forward);

            const ro = camera.position.add(
                right.mul(p.x / camera.zoom).add(up.mul(p.y / camera.zoom))
            );
            const rd = forward;

            const result = this.rayMarchFromPoint(ro, rd);

            if (result.hit) {
                const coords = result.hitPosition;
                const text = `X: ${coords.x.toFixed(3)}<br>Y: ${coords.y.toFixed(3)}<br>Z: ${coords.z.toFixed(3)}`;
                
                this.coordDisplay.innerHTML = text;
                this.coordDisplay.style.display = 'block';
                this.coordDisplay.style.left = (this.lastMousePosition.clientX + 15) + 'px';
                this.coordDisplay.style.top = (this.lastMousePosition.clientY + 15) + 'px';
            }
        }, this.mouseDebounceDelay);
    },
    
    rayMarchFromPoint(ro, rd) {
        const startTime = performance.now();

        if (!app.sdf) {
            return {
                distance: 0.0,
                minDistance: 1000000.0,
                hit: false,
                hitPosition: null,
                steps: 0
            };
        }

        const result = {
            distance: 0.0,
            minDistance: 1000000.0,
            hit: false,
            hitPosition: null,
            steps: 0
        };

        let p = ro;
        let lastD = 0.0;
        const MAX_STEPS = 500;

        for (let i = 0; i < MAX_STEPS; i++) {
            result.steps++;
            
            // Apply rotation to point before evaluating SDF
            const rotatedP = camera.activeRotationMatrix.mulVec3(p);
            const d = app.sdf(rotatedP);
            
            result.minDistance = Math.min(result.minDistance, d);

            if (d < 0.0) {
                result.hit = true;
                // p is in world space, to get object space coordinates,
                // apply the same rotation as the SDF uses
                result.hitPosition = camera.activeRotationMatrix.mulVec3(p);
                break;
            }

            const stepSize = Math.max(0.0001, d);
            p = p.add(rd.mul(stepSize));

            if (d > lastD && result.distance > 10000.0) break;
            lastD = d;
            result.distance += d;
        }

        const endTime = performance.now();
        console.log(`Raymarching took ${(endTime - startTime).toFixed(2)}ms (${result.steps} steps)`);

        return result;
    },
    
    // Helper method to render a single shader pass
    renderShaderPass(programInfo, currentTime, width, height, inputTexture) {
        const gl = this.gl;
        
        // Use the shader program
        gl.useProgram(programInfo.program);
        
        // Set up vertex attribute
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            2, gl.FLOAT, false, 0, 0
        );
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
        
        // Set common uniforms
        gl.uniform2f(programInfo.uniformLocations.resolution, width, height);
        gl.uniform1f(programInfo.uniformLocations.time, currentTime);
        gl.uniform3f(programInfo.uniformLocations.cameraPosition, 
            camera.position.x, camera.position.y, camera.position.z);
        gl.uniform3f(programInfo.uniformLocations.cameraTarget, 
            camera.target.x, camera.target.y, camera.target.z);
        gl.uniform1f(programInfo.uniformLocations.cameraZoom, camera.zoom);
        gl.uniform3f(programInfo.uniformLocations.objectColor, 0.6, 0.6, 0.6);
        gl.uniformMatrix3fv(
            programInfo.uniformLocations.rotationMatrix, 
            false, 
            new Float32Array(camera.getRotationMatrixArray())
        );
        gl.uniform1i(programInfo.uniformLocations.showEdges, camera.showEdges ? 1 : 0);
        gl.uniform1f(programInfo.uniformLocations.stepFactor, camera.stepFactor);
        gl.uniform1i(programInfo.uniformLocations.uShowField, camera.showField ? 1 : 0);
        gl.uniform1i(programInfo.uniformLocations.uShowSteps, camera.showSteps ? 1 : 0);
        gl.uniform1f(programInfo.uniformLocations.opacity, camera.opacity);
        
        // If we have a previous texture, pass it to the shader
        if (inputTexture) {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, inputTexture);
            gl.uniform1i(programInfo.uniformLocations.previousTexture, 1);
        }
        
        // Draw the quad
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
}; 