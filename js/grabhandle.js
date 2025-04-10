class GrabHandle {
    constructor(options = {}) {
        this.position = options.position || (() => new Vec3(0, 0, 0));
        this.origin = options.origin || (() => new Vec3(0, 0, 0));
        this.axis = options.axis || (() => new Vec3(1, 0, 0)); // Default to X axis
        this.color = options.color || (() => new Vec3(1, 0.5, 0));  // Default orange
        this.radius = options.radius || (() => 0.005);  // Handle size as percentage of minimum canvas dimension
        this.canvas = options.canvas || document.getElementById('glCanvas');
        this.onChange = options.onChange || null;
        this.onComplete = options.onComplete || null;
        this.renderer = options.renderer || renderer; // Accept renderer reference or use global

        // sanity check function properties
        const functionProps = ['position', 'origin', 'axis', 'color', 'radius'];
        for (const prop of functionProps) {
            if (typeof this[prop] !== 'function') {
                throw new Error(`GrabHandle: ${prop} must be a function, found ${typeof this[prop]}`);
            }
            const val = this[prop]();
            if (typeof val == undefined || val == null) {
                throw new Error(`GrabHandle: ${prop}() must return a value, found ${typeof val}`);
            }
        }

        // Internal state
        this.isDragging = false;
        this.isHovering = false;
        this.lastMousePos = null;
        this.shaderLayer = null;
        
        // Bind event handlers
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onMouseMoveForHover = this._onMouseMoveForHover.bind(this);
        
        // Set up event listeners
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('mousemove', this._onMouseMoveForHover);
        
        // Create shader program for rendering the handle
        if (this.renderer && this.renderer.gl) {
            this._createShaderLayer();
        } else {
            console.error('GrabHandle: No renderer or GL context provided');
        }
    }
    
    // Clean up event listeners
    destroy() {
        this.canvas.removeEventListener('mousedown', this._onMouseDown);
        this.canvas.removeEventListener('mousemove', this._onMouseMoveForHover);
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
        uniform vec3 uHandleOrigin;
        uniform vec3 uHandleColor;
        uniform float uHandleRadius;  // Now as percentage of minimum resolution dimension
        uniform vec2 uResolution;
        uniform vec3 uCameraPosition;
        uniform vec3 uCameraTarget;
        uniform float uCameraZoom;
        uniform mat3 uRotationMatrix;
        uniform bool uIsHovering;
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
            
            // Apply rotation to handle position and origin (match the main rendering)
            vec3 rotatedHandlePos = transpose(uRotationMatrix) * uHandlePosition;
            vec3 rotatedOriginPos = transpose(uRotationMatrix) * uHandleOrigin;
            
            // Project handle position to screen space
            // 1. Get view-space position of handle
            vec3 handleViewVec = rotatedHandlePos - ro;
            vec3 originViewVec = rotatedOriginPos - ro;
            
            // 2. Project onto camera plane
            float handleProjDist = dot(forward, handleViewVec);
            float originProjDist = dot(forward, originViewVec);
            
            // 3. Calculate view space coordinates
            vec2 handleViewPos = vec2(
                dot(right, handleViewVec),
                dot(up, handleViewVec)
            );
            vec2 originViewPos = vec2(
                dot(right, originViewVec),
                dot(up, originViewVec)
            );
            
            // 4. Apply zoom and aspect ratio
            float aspect = uResolution.x / uResolution.y;
            handleViewPos.x *= uCameraZoom;
            handleViewPos.y *= uCameraZoom;
            handleViewPos.x /= aspect;
            
            originViewPos.x *= uCameraZoom;
            originViewPos.y *= uCameraZoom;
            originViewPos.x /= aspect;
            
            // 5. Convert to screen coordinates
            vec2 handleScreenPos = (handleViewPos * 0.5 + 0.5) * uResolution;
            vec2 originScreenPos = (originViewPos * 0.5 + 0.5) * uResolution;
            
            // Calculate distance from current fragment to handle center
            float distToHandle = length(fragCoord - handleScreenPos);
            
            // Convert percentage radius to screen pixels
            float minDimension = min(uResolution.x, uResolution.y);
            float screenRadius = uHandleRadius * minDimension;
            
            // Calculate distance to the line segment between origin and handle
            vec2 lineDir = handleScreenPos - originScreenPos;
            float lineLength = length(lineDir);
            
            // Normalize line direction
            vec2 lineDirNorm = lineDir / max(lineLength, 0.001);
            
            // Vector from origin to current fragment
            vec2 fragVec = fragCoord - originScreenPos;
            
            // Project fragment onto line
            float projDist = dot(fragVec, lineDirNorm);
            
            // Clamp projection to line segment
            projDist = clamp(projDist, 0.0, lineLength);
            
            // Find closest point on line segment
            vec2 closestPoint = originScreenPos + lineDirNorm * projDist;
            
            // Distance from fragment to line
            float distToLine = length(fragCoord - closestPoint);
            
            // Line thickness (even thinner than before)
            float lineThickness = screenRadius * 0.25;
            
            // Create alpha for the line with smooth edges
            float lineAlpha = 1.0 - smoothstep(lineThickness - 1.0, lineThickness + 1.0, distToLine);
            lineAlpha *= 0.5; // Make line 50% opacity
            
            // Create alpha for the handle with smooth edges
            float handleAlpha = 1.0 - smoothstep(screenRadius - 1.0, screenRadius + 1.0, distToHandle);
            
            // Don't combine alphas - keep them separate
            float alpha = 0.0;
            vec3 finalColor = uHandleColor;
            
            // Apply hover effect only to the handle, not the line
            if (distToHandle <= screenRadius + 2.0) {
                // This is the handle
                alpha = handleAlpha;
                if (uIsHovering) {
                    // Slightly brighten color when hovering
                    finalColor = mix(finalColor, vec3(1.0, 1.0, 1.0), 0.5);
                }
            } else if (distToLine <= lineThickness + 2.0) {
                // This is the line
                alpha = lineAlpha;
            }
            
            // Hard cutoff for areas far from both the handle and line
            if (distToHandle > screenRadius + 2.0 && distToLine > lineThickness + 2.0) {
                fragColor = vec4(0.0, 0.0, 0.0, 0.0);
                return;
            }
            
            // Output fragment color with transparency
            fragColor = vec4(finalColor, alpha*0.75);
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
        this.shaderLayer.setUniform('vec3', 'uHandlePosition', this.position())
                     .setUniform('vec3', 'uHandleOrigin', this.origin())
                     .setUniform('vec3', 'uHandleColor', this.color())
                     .setUniform('float', 'uHandleRadius', this.radius())
                     .setUniform('bool', 'uIsHovering', this.isHovering||this.isDragging);
    }
    
    // Convert percentage radius to actual pixels
    _getPixelRadius() {
        const minDimension = Math.min(this.canvas.width, this.canvas.height);
        return this.radius() * minDimension;
    }
    
    // Handle mouse events
    _onMouseDown(e) {
        // Ignore if modifier keys are pressed (to allow camera controls)
        if (e.shiftKey || e.altKey) return;
        
        // Convert mouse position to screen coordinates
        const mousePos = this._getMousePosition(e);
        
        // Check if the click is on the handle
        const screenPos = camera.worldToScreen(this.position());
        const distance = Math.sqrt(
            Math.pow(mousePos.x - screenPos.x, 2) + 
            Math.pow(mousePos.y - screenPos.y, 2)
        );
        
        // Convert percentage radius to pixels for hit testing
        const hitRadius = this._getPixelRadius();
        
        // If click is on handle, start dragging
        if (distance <= hitRadius) {
            this.isDragging = true;
            this.lastMousePos = mousePos;
            document.addEventListener('mousemove', this._onMouseMove);
            document.addEventListener('mouseup', this._onMouseUp);
            
            // Stop propagation to prevent other handlers from firing
            e.preventDefault();
            e.stopPropagation();
            
            // Add a one-time click handler to the document to capture and suppress the click
            // that happens when the mouse is released
            const suppressClickHandler = (clickEvent) => {
                clickEvent.stopPropagation();
                clickEvent.preventDefault();
                document.removeEventListener('click', suppressClickHandler, true);
            };
            
            // Use capture phase to intercept the click before it reaches other handlers
            document.addEventListener('click', suppressClickHandler, true);
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
                this.onComplete(this.position());
            }
            
            // Prevent the mouseup from triggering other events
            e.preventDefault();
            e.stopPropagation();
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
        // We need to determine how far to move along the constraint axis
        // based on the screen-space mouse movement
        
        // 1. Calculate how the handle would appear on screen if moved a small amount along the axis
        const testOffset = 0.1; // Small test offset along the axis
        const testPos = this.position().add(this.axis().mul(testOffset));
        
        // 2. Project both current and test positions to screen space
        const currentScreenPos = camera.worldToScreen(this.position());
        const testScreenPos = camera.worldToScreen(testPos);
        
        // 3. Calculate the screen-space movement vector for our test offset
        const screenDeltaX = testScreenPos.x - currentScreenPos.x;
        const screenDeltaY = testScreenPos.y - currentScreenPos.y;
        
        // 4. Calculate the screen-space distance moved per unit of axis movement
        const screenDist = Math.sqrt(screenDeltaX * screenDeltaX + screenDeltaY * screenDeltaY);
        const screenDistPerUnit = screenDist / testOffset;
        
        if (screenDistPerUnit < 0.001) {
            // Avoid division by near-zero (happens when axis points directly into/out of screen)
            return;
        }
        
        // 5. Project the mouse movement onto the screen-space axis direction
        const screenAxisDirX = screenDeltaX / screenDist;
        const screenAxisDirY = screenDeltaY / screenDist;
        
        // Calculate how much the mouse moved along the projected axis direction
        const mouseProjection = deltaX * screenAxisDirX + deltaY * screenAxisDirY;
        
        // 6. Convert screen-space movement to world-space movement along the axis
        const axisMovement = mouseProjection / screenDistPerUnit;
        
        // 7. Update the position
        const newPosition = this.position().add(this.axis().mul(axisMovement));
        
        // Notify onChange callback if provided
        if (this.onChange) {
            this.onChange(newPosition);
        }
    }
    
    // Handle mouse move for hover detection
    _onMouseMoveForHover(e) {
        // Skip hover detection if already dragging
        if (this.isDragging) return;
        
        // Convert mouse position to screen coordinates
        const mousePos = this._getMousePosition(e);
        
        // Check if the mouse is over the handle
        const screenPos = camera.worldToScreen(this.position());
        const distance = Math.sqrt(
            Math.pow(mousePos.x - screenPos.x, 2) + 
            Math.pow(mousePos.y - screenPos.y, 2)
        );
        
        // Convert percentage radius to pixels for hit testing
        const hitRadius = this._getPixelRadius();
        
        // Update hover state
        const wasHovering = this.isHovering;
        this.isHovering = distance <= hitRadius;
        
        // Only trigger a redraw if the hover state changed
        if (wasHovering !== this.isHovering) {
            // Request a redraw to update the handle appearance
            if (this.renderer && typeof this.renderer.requestRedraw === 'function') {
                this.renderer.requestRedraw();
            }
        }
    }
}
