// WebGL setup and management
const renderer = {
    canvas: null,
    gl: null,
    programInfo: null,
    positionBuffer: null,
    startTime: Date.now(),
    vertexShaderSource: null,
    fragmentShaderSource: null,
    
    // Add these properties for FPS calculation
    frameCount: 0,
    lastFpsUpdateTime: 0,
    fpsUpdateInterval: 500, // Update FPS display every 500ms
    fpsElement: null,
    currentFps: 0,
    
    async init() {
        this.canvas = document.getElementById('glCanvas');
        this.gl = this.canvas.getContext('webgl');
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
        
        // Check if the canvas is not the same size
        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            // Update the canvas size to match its display size
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
        }
        
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    },
    
    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.warn('Shader source:', source);
            console.error('Shader compilation error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    },
    
    createShaderProgram(vsSource, fsSource) {
        const vertexShader = this.compileShader(vsSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fsSource, this.gl.FRAGMENT_SHADER);

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking error:', this.gl.getProgramInfoLog(program));
            return null;
        }
        
        // Set up program info
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
        
        return program;
    },
    
    render() {
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