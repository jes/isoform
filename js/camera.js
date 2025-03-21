// Camera controls
const camera = {
    position: new Vec3(0.0, 0.0, 1000.0),
    target: new Vec3(0.0, 0.0, 0.0),
    zoom: 0.015,
    // Replace flat arrays with Mat3 objects
    baseRotationMatrix: new Mat3(), // Identity matrix
    activeRotationMatrix: new Mat3(), // Identity matrix
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    zoomSpeed: 0.1,
    showEdges: true,
    stepFactor: 1.0,
    dragStartX: 0,
    dragStartY: 0,
    dragStartRotation: new Mat3(), // Identity matrix
    showField: false,
    showSteps: false,
    opacity: 1.0,
    
    init(canvas) {
        // Only need mousemove and wheel events now
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('wheel', (e) => this.onWheel(e));
        
        // Handle Alt key press/release
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Alt') {
                // Store the current rotation as the starting point
                if (!this.isDragging) {
                    this.dragStartRotation = this.baseRotationMatrix;
                    this.dragStartX = this.lastMouseX;
                    this.dragStartY = this.lastMouseY;
                    this.isDragging = true;
                }
                e.preventDefault();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === 'Alt') {
                // Store the final rotation as the new base
                this.baseRotationMatrix = this.activeRotationMatrix;
                this.isDragging = false;
                e.preventDefault();
            }
        });
    },

    setUniforms(shaderLayer) {
        shaderLayer.setUniform('vec3', 'uCameraPosition', this.position)
                   .setUniform('vec3', 'uCameraTarget', this.target)
                   .setUniform('float', 'uCameraZoom', this.zoom)
                   .setUniform('mat3', 'uRotationMatrix', new Float32Array(this.getRotationMatrixArray()))
                   .setUniform('bool', 'uShowEdges', this.showEdges ? 1 : 0)
                   .setUniform('float', 'uStepFactor', this.stepFactor)
                   .setUniform('bool', 'uShowField', this.showField ? 1 : 0)
                   .setUniform('bool', 'uShowSteps', this.showSteps ? 1 : 0)
    },
    
    // Helper function to create a rotation matrix around X axis
    createRotationMatrixX(angle) {
        return new Mat3().rotateX(angle);
    },
    
    // Helper function to create a rotation matrix around Y axis
    createRotationMatrixY(angle) {
        return new Mat3().rotateY(angle);
    },
    
    // Helper function to create a rotation matrix around Z axis
    createRotationMatrixZ(angle) {
        return new Mat3().rotateZ(angle);
    },
    
    onMouseMove(e) {
        // Get canvas dimensions for proper scaling
        const canvasWidth = renderer.canvas.width;
        const canvasHeight = renderer.canvas.height;
        
        // Calculate aspect ratio
        const aspectRatio = canvasWidth / canvasHeight;
        
        // Calculate pixel movement
        const pixelMoveX = e.movementX;
        const pixelMoveY = e.movementY;
        
        if (e.shiftKey) {
            // Pan: Move both camera position and target
            // Convert to normalized device coordinates (-1 to 1)
            const ndcMoveX = (pixelMoveX / canvasWidth) * 2.0;
            const ndcMoveY = (pixelMoveY / canvasHeight) * 2.0;
            
            // Convert to world space (accounting for aspect ratio and zoom)
            // Negate X movement to match expected direction
            const worldMoveX = -ndcMoveX * (aspectRatio / this.zoom);
            const worldMoveY = ndcMoveY * (1.0 / this.zoom);
            
            // Apply the movement to both camera position and target
            const moveVec = new Vec3(worldMoveX, worldMoveY, 0);
            this.target = this.target.add(moveVec);
            this.position = this.position.add(moveVec);
            app.coordinateSystemChanged();
        } else if (e.altKey) {
            // Rotate: Update rotation matrices
            const deltaX = (this.dragStartX - e.clientX) * 0.01;
            const deltaY = (this.dragStartY - e.clientY) * 0.01;
            
            // Create rotation matrices based on mouse movement
            const rotX = this.createRotationMatrixX(deltaY);
            const rotY = this.createRotationMatrixY(deltaX);
            
            const combinedRotation = rotY.mul(rotX);
            this.activeRotationMatrix = this.dragStartRotation.mul(combinedRotation);
            
            app.coordinateSystemChanged();
        }

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    },
    
    onWheel(e) {
        e.preventDefault();
        
        // Use multiplicative zoom factor instead of additive
        // This creates consistent percentage changes regardless of current zoom level
        const zoomFactor = 1.1; // 10% zoom change per scroll click
        
        if (e.deltaY > 0) {
            // Zoom out
            this.zoom /= zoomFactor;
        } else {
            // Zoom in
            this.zoom *= zoomFactor;
        }

        app.coordinateSystemChanged();
    },
    
    setStandardView(rotationMatrix) {
        // Set both base and active rotation matrices to the standard view
        this.baseRotationMatrix = rotationMatrix;
        this.activeRotationMatrix = rotationMatrix;
        
        // Reset any ongoing drag operation
        this.isDragging = false;
        
        // Reset the drag start rotation
        this.dragStartRotation = rotationMatrix;

        app.coordinateSystemChanged();
    },
    
    // Rotate around the viewing direction (forward axis)
    rotateAroundViewingDirection(angleDegrees) {
        // Convert angle to radians
        const angleRad = angleDegrees * Math.PI / 180.0;
        
        // Calculate the viewing direction (forward vector)
        const forward = this.target.sub(this.position);
        
        // Normalize the forward vector
        const normalizedForward = forward.normalize();
        
        // Create a rotation matrix around the viewing direction using Rodrigues' formula
        const c = Math.cos(angleRad);
        const s = Math.sin(angleRad);
        const t = 1 - c;
        
        const x = normalizedForward.x;
        const y = normalizedForward.y;
        const z = normalizedForward.z;
        
        // Create rotation matrix around arbitrary axis (viewing direction)
        const rotMatrix = new Mat3(
            t*x*x + c,    t*x*y - s*z,  t*x*z + s*y,
            t*x*y + s*z,  t*y*y + c,    t*y*z - s*x,
            t*x*z - s*y,  t*y*z + s*x,  t*z*z + c
        );
        
        // Apply rotation to the current rotation matrix
        this.baseRotationMatrix = rotMatrix.mul(this.baseRotationMatrix);
        this.activeRotationMatrix = this.baseRotationMatrix;
        
        // Reset any ongoing drag operation
        this.isDragging = false;
        
        // Reset the drag start rotation
        this.dragStartRotation = this.baseRotationMatrix;
        
        app.coordinateSystemChanged();
    },
    
    worldToScreen(worldPos) {
        worldPos.z ||= 0;
        
        // Convert to Vec3 if it's not already
        const worldPosVec = (worldPos instanceof Vec3) ? 
            worldPos : new Vec3(worldPos.x, worldPos.y, worldPos.z);
        
        // Apply the active rotation matrix to the world position
        const rotatedPos = this.activeRotationMatrix.mulVec3(worldPosVec);
        
        // 1. Build the camera basis vectors (same as in screenToWorld)
        const forward = this.target.sub(this.position);
        const fLength = forward.length();
        
        if (fLength < 1e-12) {
            return { x: Number.NaN, y: Number.NaN };
        }
        
        const forwardNorm = forward.normalize();
        const worldUp = new Vec3(0, 1, 0);
        const right = forwardNorm.cross(worldUp).normalize();
        
        if (right.length() < 1e-12) {
            return { x: Number.NaN, y: Number.NaN };
        }
        
        const up = forwardNorm.cross(right);
        
        // 2. Calculate vector from camera position to rotated world position
        const offset = rotatedPos.sub(this.position);
        
        // 3. Project offset onto right and up vectors to get view space coordinates
        const viewSpaceX = offset.dot(right);
        const viewSpaceY = offset.dot(up);
        
        // 4. Apply zoom factor
        const ndcX = viewSpaceX * this.zoom;
        const ndcY = viewSpaceY * this.zoom;
        
        // 5. Apply aspect ratio correction
        const canvas = document.getElementById('glCanvas');
        const aspectRatio = canvas.width / canvas.height;
        const correctedNdcX = ndcX / aspectRatio;
        
        // 6. Convert from NDC to screen coordinates
        const screenX = (correctedNdcX + 1.0) * 0.5 * canvas.width;
        const screenY = ((ndcY + 1.0) * 0.5) * canvas.height; // Flip Y to match screen coordinates
        
        return { x: screenX, y: screenY };
    },
    
    screenToWorld(screenPos) {
        const canvas = document.getElementById('glCanvas');
        
        // 1. Convert from screen coordinates to NDC (-1 to 1)
        const ndcX = (screenPos.x / canvas.width) * 2.0 - 1.0;
        const ndcY = 1.0 - (screenPos.y / canvas.height) * 2.0;
        
        // 2. Apply aspect ratio correction
        const aspectRatio = canvas.width / canvas.height;
        const correctedNdcX = ndcX * aspectRatio;
        
        // 3. Remove zoom factor to get view space coordinates
        const viewSpaceX = correctedNdcX / this.zoom;
        const viewSpaceY = -ndcY / this.zoom; // Flip Y axis to match worldToScreen
        
        // 4. Build camera basis vectors (right and up vectors for the view plane)
        const forward = this.target.sub(this.position);
        const forwardNorm = forward.normalize();
        
        const worldUp = new Vec3(0, 1, 0);
        const right = forwardNorm.cross(worldUp).normalize();
        const up = forwardNorm.cross(right);
        
        // 5. For orthographic projection, calculate position on the view plane
        const viewPlanePoint = this.position.add(
            right.mul(viewSpaceX).add(up.mul(viewSpaceY))
        );
        
        // 6. Cast ray from this point along the forward direction
        // Since we want Z=0, calculate where this ray intersects the Z=0 plane
        if (Math.abs(forwardNorm.z) < 1e-6) {
            // Ray is parallel to XY plane, no intersection
            return { x: Number.NaN, y: Number.NaN, z: 0 };
        }
        
        // Calculate t where ray intersects z=0 plane
        const t = -viewPlanePoint.z / forwardNorm.z;
        
        // Calculate intersection point in world space
        const worldPointRotated = viewPlanePoint.add(forwardNorm.mul(t));
        
        // 7. Since the rotation is applied to objects (not the camera view),
        // we need to apply the inverse rotation to get back to original world coordinates
        // Inverse of rotation matrix is its transpose for orthogonal matrices
        const inverseRotation = this.activeRotationMatrix.transpose();
        
        // Apply inverse rotation
        const worldPos = inverseRotation.mulVec3(worldPointRotated);
        
        return { x: worldPos.x, y: worldPos.y, z: worldPos.z };
    },
    
    // Helper method to convert Mat3 to flat array for WebGL
    getRotationMatrixArray() {
        // Convert the Mat3 to a flat array in column-major order for WebGL
        const m = this.activeRotationMatrix.m;
        return [
            m[0][0], m[1][0], m[2][0],
            m[0][1], m[1][1], m[2][1],
            m[0][2], m[1][2], m[2][2]
        ];
    }
}; 