// WebGL setup and management
const renderer = {
    canvas: null,
    gl: null,
    programInfo: null,
    positionBuffer: null,
    startTime: Date.now(),
    vertexShaderSource: null,
    fragmentShaderSource: null,
    
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
                rotationX: this.gl.getUniformLocation(program, 'uRotationX'),
                rotationY: this.gl.getUniformLocation(program, 'uRotationY')
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
        this.gl.uniform3fv(this.programInfo.uniformLocations.cameraPosition, camera.position);
        this.gl.uniform3fv(this.programInfo.uniformLocations.cameraTarget, camera.target);
        this.gl.uniform1f(this.programInfo.uniformLocations.cameraZoom, camera.zoom);
        this.gl.uniform1f(this.programInfo.uniformLocations.rotationX, camera.rotationX);
        this.gl.uniform1f(this.programInfo.uniformLocations.rotationY, camera.rotationY);
        
        // Draw the square (as triangle strip)
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }
}; 