class GrabHandle {
    constructor(options = {}) {
        // Store handle properties
        this.position = options.position || new Vec3(0, 0, 0);
        this.initialPosition = this.position.clone();
        this.axis = options.axis || new Vec3(1, 0, 0); // Default to X axis
        this.axis = this.axis.normalize(); // Ensure axis is normalized
        this.color = options.color || new Vec3(1, 0.5, 0);  // Default orange
        this.radius = options.radius || 1;  // Handle size in pixels (screen space)
        this.canvas = options.canvas || document.getElementById('glCanvas');
        this.onChange = options.onChange || null;
        this.onComplete = options.onComplete || null;
        this.renderer = options.renderer || renderer; // Accept renderer reference or use global
        
        // Internal state
        this.isDragging = false;
        this.lastMousePos = null;
        this.shaderLayer = null;
        
        // Bind event handlers
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        
        // Set up event listeners
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        
        // Create shader program for rendering the handle
        if (this.renderer && this.renderer.gl) {
            this._createShaderLayer();
        } else {
            console.error('GrabHandle: No renderer or GL context provided');
        }
    }
    
    // Set or update position
    setPosition(pos) {
        this.position = pos instanceof Vec3 ? pos : new Vec3(pos[0], pos[1], pos[2]);
        // Notify onChange callback if provided
        if (this.onChange) {
            this.onChange(this.position);
        }
    }
    
    // Reset the handle to its initial position
    reset() {
        this.position = this.initialPosition.clone();
        if (this.onChange) {
            this.onChange(this.position);
        }
    }
    
    // Clean up event listeners
    destroy() {
        this.canvas.removeEventListener('mousedown', this._onMouseDown);
        document.removeEventListener('mousemove', this._onMouseMove);
        document.removeEventListener('mouseup', this._onMouseUp);
    }
    
    // Create the shader layer for rendering the handle
    _createShaderLayer() {
        const gl = this.renderer.gl;
        if (!gl) return;
        
        const fragmentShaderSource = `#version 300 es
        precision highp float;
        
        uniform vec3 uHandlePosition;
        uniform vec3 uHandleColor;
        uniform float uHandleRadius;
        uniform vec2 uResolution;
        uniform vec3 uCameraPosition;
        uniform vec3 uCameraTarget;
        uniform float uCameraZoom;
        uniform mat3 uRotationMatrix;
        out vec4 fragColor;
        
        void main() {
            // Get current fragment position in normalized coordinates
            vec2 fragCoord = gl_FragCoord.xy;
            
            // Setup camera coordinates (similar to fragment.js)
            vec3 ro = uCameraPosition;
            vec3 target = uCameraTarget;
            vec3 forward = normalize(target - ro);
            vec3 worldUp = vec3(0.0, 1.0, 0.0);
            vec3 right = normalize(cross(forward, worldUp));
            vec3 up = cross(right, forward);
            
            // Apply rotation to handle position (match the main rendering)
            vec3 rotatedHandlePos = transpose(uRotationMatrix) * uHandlePosition;
            
            // Project handle position to screen space
            // 1. Get view-space position of handle
            vec3 handleViewVec = rotatedHandlePos - ro;
            
            // 2. Project onto camera plane
            float handleProjDist = dot(forward, handleViewVec);
            
            // 3. Calculate view space coordinates
            vec2 handleViewPos = vec2(
                dot(right, handleViewVec),
                dot(up, handleViewVec)
            );
            
            // 4. Apply zoom and aspect ratio
            float aspect = uResolution.x / uResolution.y;
            handleViewPos.x *= uCameraZoom;
            handleViewPos.y *= uCameraZoom;
            handleViewPos.x /= aspect;
            
            // 5. Convert to screen coordinates
            vec2 handleScreenPos = (handleViewPos * 0.5 + 0.5) * uResolution;
            
            // Calculate distance from current fragment to handle center
            float dist = length(fragCoord - handleScreenPos);
            
            // Define handle radius in screen space
            float screenRadius = uHandleRadius * uResolution.y / 40.0;
            
            // Create a circular shape with smooth edges
            float alpha = 1.0 - smoothstep(screenRadius - 1.0, screenRadius + 1.0, dist);
            
            // Hard cutoff for areas far from the handle to ensure complete transparency
            if (dist > screenRadius + 2.0) {
                fragColor = vec4(0.0, 0.0, 0.0, 0.0);
                return;
            }
            
            // Add a highlight effect
            float highlight = smoothstep(screenRadius * 0.7, screenRadius, dist);
            vec3 color = mix(uHandleColor, vec3(1.0), highlight * 0.3);
            
            // Output fragment color with transparency
            fragColor = vec4(color, alpha);
        }`;
        
        // Use the renderer's async methods for shader compilation
        this.renderer.compileShaderProgram(fragmentShaderSource)
            .then(program => {
                if (program) {
                    this.shaderLayer = new ShaderLayer(program, fragmentShaderSource);
                } else {
                    console.error('Failed to compile grab handle shader');
                }
            });
    }
    
    setUniforms() {
        if (!this.shaderLayer) return;
        
        // Set uniforms for the shader
        camera.setUniforms(this.shaderLayer);
        this.shaderLayer.setUniform('vec3', 'uHandlePosition', this.position)
                     .setUniform('vec3', 'uHandleColor', this.color)
                     .setUniform('float', 'uHandleRadius', this.radius);
    }
    
    // Handle mouse events
    _onMouseDown(e) {
        // Ignore if modifier keys are pressed (to allow camera controls)
        if (e.shiftKey || e.altKey) return;
        
        // Convert mouse position to screen coordinates
        const mousePos = this._getMousePosition(e);
        
        // Check if the click is on the handle
        const screenPos = camera.worldToScreen(this.position);
        const distance = Math.sqrt(
            Math.pow(mousePos.x - screenPos.x, 2) + 
            Math.pow(mousePos.y - screenPos.y, 2)
        );
        
        // Use the screen-space radius for hit testing
        const hitRadius = this.radius * this.canvas.height / 100.0;
        
        // If click is on handle, start dragging
        if (distance <= hitRadius) {
            this.isDragging = true;
            this.lastMousePos = mousePos;
            document.addEventListener('mousemove', this._onMouseMove);
            document.addEventListener('mouseup', this._onMouseUp);
            e.preventDefault();
        }
    }
    
    _onMouseMove(e) {
        if (!this.isDragging) return;
        
        // Get current mouse position
        const mousePos = this._getMousePosition(e);
        
        // Calculate delta in screen space
        const deltaX = mousePos.x - this.lastMousePos.x;
        const deltaY = mousePos.y - this.lastMousePos.y;
        
        // Convert screen space delta to world space movement along axis
        this._updatePositionFromScreenDelta(deltaX, deltaY);
        
        // Update last mouse position
        this.lastMousePos = mousePos;
    }
    
    _onMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            document.removeEventListener('mousemove', this._onMouseMove);
            document.removeEventListener('mouseup', this._onMouseUp);
            
            // Notify completion callback if provided
            if (this.onComplete) {
                this.onComplete(this.position);
            }
        }
    }
    
    _getMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    _updatePositionFromScreenDelta(deltaX, deltaY) {
        // Get start and end positions in screen space
        const startScreenPos = camera.worldToScreen(this.position);
        const endScreenPos = { 
            x: startScreenPos.x + deltaX, 
            y: startScreenPos.y + deltaY 
        };
        
        // Convert screen positions to world positions
        const startWorldPos = camera.screenToWorld(startScreenPos);
        const endWorldPos = camera.screenToWorld(endScreenPos);
        
        // Calculate movement vector
        const moveVec = new Vec3(
            endWorldPos.x - startWorldPos.x,
            endWorldPos.y - startWorldPos.y,
            endWorldPos.z - startWorldPos.z
        );
        
        // Project movement onto the constraint axis
        const dot = moveVec.dot(this.axis);
        const projectedMove = this.axis.mul(dot);
        
        // Update position
        this.position = this.position.add(projectedMove);
        
        // Notify onChange callback if provided
        if (this.onChange) {
            this.onChange(this.position);
        }
    }
}
