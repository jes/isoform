// WebGL setup and management
const renderer = {
    canvas: null,
    gl: null,
    programInfo: null,
    positionBuffer: null,
    startTime: Date.now(),
    vertexShaderSource: null,
    fragmentShaderSource: null,
    
    frameCount: 0,
    lastFpsUpdateTime: 0,
    fpsUpdateInterval: 500, // Update FPS display every 500ms
    fpsElement: null,
    currentFps: 0,
    
    resolutionScale: 1.0, // Values > 1.0 = supersampling, < 1.0 = downsampling
    
    async init() {
        this.canvas = document.getElementById('glCanvas');
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
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Create buffer for full-screen quad
        const positions = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0];
        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
        
        // Load shader sources
        try {
            this.vertexShaderSource = window.vertexShaderSource;
            this.fragmentShaderSource = window.fragmentShaderSource;
            this.createShaderProgram(this.vertexShaderSource, this.fragmentShaderSource);
        } catch (error) {
            console.error('Failed to load shaders:', error);
            return false;
        }
        
        // Initialize FPS counter
        this.fpsElement = document.getElementById('fps-counter');
        this.lastFpsUpdateTime = Date.now();
        
        return true;
    },
    
    resizeCanvas() {
        // Get the CSS size of the canvas
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        
        // Apply resolution scaling (allow values > 1.0 for supersampling)
        const renderWidth = Math.floor(displayWidth * this.resolutionScale);
        const renderHeight = Math.floor(displayHeight * this.resolutionScale);
        
        // Check if the canvas is not the same size
        if (this.canvas.width !== renderWidth || this.canvas.height !== renderHeight) {
            // Save the current canvas content
            let oldCanvas = document.createElement('canvas');
            oldCanvas.width = this.canvas.width;
            oldCanvas.height = this.canvas.height;
            let oldCtx = oldCanvas.getContext('2d');
            oldCtx.drawImage(this.canvas, 0, 0);
            
            // Update the canvas size to match the scaled resolution
            this.canvas.width = renderWidth;
            this.canvas.height = renderHeight;
            
            // Set viewport to new size
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw the old content stretched to the new size to prevent flickering
            // This will be replaced by the next render call
            this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            
            // Force an immediate render to prevent seeing the blank canvas
            this.render();
        } else {
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    },
    
    // Update to allow values above 1.0
    setResolutionScale(scale) {
        if (scale > 0.1) {
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
    
    async createShaderProgram(vsSource, fsSource) {
        const startTime = performance.now();

        const vertexShader = await this.compileShader(vsSource, this.gl.VERTEX_SHADER);
        const fragmentShader = await this.compileShader(fsSource, this.gl.FRAGMENT_SHADER);

        if (!vertexShader || !fragmentShader) {
            return null;
        }

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking error:', this.gl.getProgramInfoLog(program));
            return null;
        }

        this.programInfo = {
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
                showSecondary: this.gl.getUniformLocation(program, 'uShowSecondary'),
                stepFactor: this.gl.getUniformLocation(program, 'stepFactor'),
            },
        };

        const endTime = performance.now();
        console.log(`Shader program creation took ${(endTime - startTime).toFixed(3)} ms`);
        return program;
    },
    
    render() {
        if (!this.programInfo) {
            return;
        }

        const currentTime = (Date.now() - this.startTime) / 1000;
        
        // Clear the canvas
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        
        // Use our shader program
        this.gl.useProgram(this.programInfo.program);
        
        // Set up vertex attribute
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.vertexAttribPointer(
            this.programInfo.attribLocations.vertexPosition,
            2, this.gl.FLOAT, false, 0, 0
        );
        this.gl.enableVertexAttribArray(this.programInfo.attribLocations.vertexPosition);
        
        // Set uniforms
        this.gl.uniform2f(this.programInfo.uniformLocations.resolution, this.canvas.width, this.canvas.height);
        this.gl.uniform1f(this.programInfo.uniformLocations.time, currentTime);
        
        // Add camera uniforms
        this.gl.uniform3f(this.programInfo.uniformLocations.cameraPosition, 
            camera.position[0], camera.position[1], camera.position[2]);
        this.gl.uniform3f(this.programInfo.uniformLocations.cameraTarget, 
            camera.target[0], camera.target[1], camera.target[2]);
        this.gl.uniform1f(this.programInfo.uniformLocations.cameraZoom, camera.zoom);
        
        // Pass rotation matrix instead of Euler angles
        this.gl.uniformMatrix3fv(
            this.programInfo.uniformLocations.rotationMatrix, 
            false, 
            new Float32Array(camera.activeRotationMatrix)
        );
        
        this.gl.uniform1i(this.programInfo.uniformLocations.showEdges, camera.showEdges ? 1 : 0);
        
        // Set showSecondary uniform based on whether a node is selected
        this.gl.uniform1i(this.programInfo.uniformLocations.showSecondary, ui.getSecondaryNode() ? 1 : 0);
        
        // Set stepFactor uniform
        this.gl.uniform1f(this.programInfo.uniformLocations.stepFactor, camera.stepFactor);
        
        // Draw the quad
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        
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
    }
}; 