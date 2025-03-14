// Camera controls
const camera = {
    position: [0.0, 0.0, 1000.0],
    target: [0.0, 0.0, 0.0],
    zoom: 0.05,
    // Replace Euler angles with rotation matrices
    baseRotationMatrix: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    ],
    activeRotationMatrix: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    ],
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    zoomSpeed: 0.1,
    showEdges: true,
    stepFactor: 1.0,
    dragStartX: 0,
    dragStartY: 0,
    dragStartRotation: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
    ],
    
    init(canvas) {
        // Only need mousemove and wheel events now
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('wheel', (e) => this.onWheel(e));
        
        // Handle Alt key press/release
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Alt') {
                // Store the current rotation as the starting point
                if (!this.isDragging) {
                    this.dragStartRotation = [...this.baseRotationMatrix];
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
                this.baseRotationMatrix = [...this.activeRotationMatrix];
                this.isDragging = false;
                e.preventDefault();
            }
        });
    },
    
    // Helper function to create a rotation matrix around X axis
    createRotationMatrixX(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            1, 0, 0,
            0, cos, -sin,
            0, sin, cos
        ];
    },
    
    // Helper function to create a rotation matrix around Y axis
    createRotationMatrixY(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            cos, 0, sin,
            0, 1, 0,
            -sin, 0, cos
        ];
    },
    
    // Helper function to multiply two 3x3 matrices
    multiplyMatrices(a, b) {
        return [
            a[0]*b[0] + a[1]*b[3] + a[2]*b[6], a[0]*b[1] + a[1]*b[4] + a[2]*b[7], a[0]*b[2] + a[1]*b[5] + a[2]*b[8],
            a[3]*b[0] + a[4]*b[3] + a[5]*b[6], a[3]*b[1] + a[4]*b[4] + a[5]*b[7], a[3]*b[2] + a[4]*b[5] + a[5]*b[8],
            a[6]*b[0] + a[7]*b[3] + a[8]*b[6], a[6]*b[1] + a[7]*b[4] + a[8]*b[7], a[6]*b[2] + a[7]*b[5] + a[8]*b[8]
        ];
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
            this.target[0] += worldMoveX;
            this.target[1] += worldMoveY;
            this.position[0] += worldMoveX;
            this.position[1] += worldMoveY;
            app.coordinateSystemChanged();
        } else if (e.altKey) {
            // Rotate: Update rotation matrices
            const deltaX = (e.clientX - this.dragStartX) * 0.01;
            const deltaY = (e.clientY - this.dragStartY) * 0.01;
            
            // Create rotation matrices based on mouse movement
            const rotX = this.createRotationMatrixX(deltaY);
            const rotY = this.createRotationMatrixY(deltaX);
            
            // Apply rotations to the drag start rotation matrix
            const combinedRotation = this.multiplyMatrices(rotX, rotY);
            this.activeRotationMatrix = this.multiplyMatrices(combinedRotation, this.dragStartRotation);
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
        this.baseRotationMatrix = [...rotationMatrix];
        this.activeRotationMatrix = [...rotationMatrix];
        
        // Reset any ongoing drag operation
        this.isDragging = false;
        
        // Reset the drag start rotation
        this.dragStartRotation = [...rotationMatrix];

        app.coordinateSystemChanged();
    },
    
    // Helper function to create a rotation matrix around Z axis
    createRotationMatrixZ(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return [
            cos, -sin, 0,
            sin, cos, 0,
            0, 0, 1
        ];
    },
    
    // Rotate around the viewing direction (forward axis)
    rotateAroundViewingDirection(angleDegrees) {
        // Convert angle to radians
        const angleRad = angleDegrees * Math.PI / 180.0;
        
        // Calculate the viewing direction (forward vector)
        const forward = [
            this.target[0] - this.position[0],
            this.target[1] - this.position[1],
            this.target[2] - this.position[2]
        ];
        
        // Normalize the forward vector
        const length = Math.sqrt(
            forward[0] * forward[0] + 
            forward[1] * forward[1] + 
            forward[2] * forward[2]
        );
        
        const normalizedForward = [
            forward[0] / length,
            forward[1] / length,
            forward[2] / length
        ];
        
        // Create a rotation matrix around the viewing direction
        // Using Rodrigues' rotation formula
        const c = Math.cos(angleRad);
        const s = Math.sin(angleRad);
        const t = 1 - c;
        
        const x = normalizedForward[0];
        const y = normalizedForward[1];
        const z = normalizedForward[2];
        
        // Create rotation matrix around arbitrary axis (viewing direction)
        const rotMatrix = [
            t*x*x + c,    t*x*y - s*z,  t*x*z + s*y,
            t*x*y + s*z,  t*y*y + c,    t*y*z - s*x,
            t*x*z - s*y,  t*y*z + s*x,  t*z*z + c
        ];
        
        // Apply rotation to the current rotation matrix
        this.baseRotationMatrix = this.multiplyMatrices(rotMatrix, this.baseRotationMatrix);
        this.activeRotationMatrix = [...this.baseRotationMatrix];
        
        // Reset any ongoing drag operation
        this.isDragging = false;
        
        // Reset the drag start rotation
        this.dragStartRotation = [...this.baseRotationMatrix];
    },
    
    worldToScreen(worldPos) {
        worldPos.z ||= 0;
        
        // Apply the active rotation matrix to the world position
        const rotatedPos = {
            x: this.activeRotationMatrix[0] * worldPos.x + this.activeRotationMatrix[1] * worldPos.y + this.activeRotationMatrix[2] * worldPos.z,
            y: this.activeRotationMatrix[3] * worldPos.x + this.activeRotationMatrix[4] * worldPos.y + this.activeRotationMatrix[5] * worldPos.z,
            z: this.activeRotationMatrix[6] * worldPos.x + this.activeRotationMatrix[7] * worldPos.y + this.activeRotationMatrix[8] * worldPos.z
        };
        
        // 1. Build the camera basis vectors (same as in screenToWorld)
        const forward = {
            x: this.target[0] - this.position[0],
            y: this.target[1] - this.position[1],
            z: this.target[2] - this.position[2]
        };
        const fLength = Math.sqrt(forward.x*forward.x + forward.y*forward.y + forward.z*forward.z);
        if (fLength < 1e-12) {
            return { x: Number.NaN, y: Number.NaN };
        }
        forward.x /= fLength;
        forward.y /= fLength;
        forward.z /= fLength;
        
        const worldUp = { x: 0, y: 1, z: 0 };
        const right = {
            x: forward.y * worldUp.z - forward.z * worldUp.y,
            y: forward.z * worldUp.x - forward.x * worldUp.z,
            z: forward.x * worldUp.y - forward.y * worldUp.x
        };
        const rLength = Math.sqrt(right.x*right.x + right.y*right.y + right.z*right.z);
        if (rLength < 1e-12) {
            return { x: Number.NaN, y: Number.NaN };
        }
        right.x /= rLength;
        right.y /= rLength;
        right.z /= rLength;
        
        const up = {
            x: forward.y * right.z - forward.z * right.y,
            y: forward.z * right.x - forward.x * right.z,
            z: forward.x * right.y - forward.y * right.x
        };
        
        // 2. Calculate vector from camera position to rotated world position
        const offset = {
            x: rotatedPos.x - this.position[0],
            y: rotatedPos.y - this.position[1],
            z: rotatedPos.z - this.position[2]
        };
        
        // 3. Project offset onto right and up vectors to get view space coordinates
        const viewSpaceX = offset.x * right.x + offset.y * right.y + offset.z * right.z;
        const viewSpaceY = offset.x * up.x + offset.y * up.y + offset.z * up.z;
        
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
        const forward = {
            x: this.target[0] - this.position[0],
            y: this.target[1] - this.position[1],
            z: this.target[2] - this.position[2]
        };
        const fLength = Math.sqrt(forward.x*forward.x + forward.y*forward.y + forward.z*forward.z);
        forward.x /= fLength;
        forward.y /= fLength;
        forward.z /= fLength;
        
        const worldUp = { x: 0, y: 1, z: 0 };
        const right = {
            x: forward.y * worldUp.z - forward.z * worldUp.y,
            y: forward.z * worldUp.x - forward.x * worldUp.z,
            z: forward.x * worldUp.y - forward.y * worldUp.x
        };
        const rLength = Math.sqrt(right.x*right.x + right.y*right.y + right.z*right.z);
        right.x /= rLength;
        right.y /= rLength;
        right.z /= rLength;
        
        const up = {
            x: forward.y * right.z - forward.z * right.y,
            y: forward.z * right.x - forward.x * right.z,
            z: forward.x * right.y - forward.y * right.x
        };
        
        // 5. For orthographic projection, calculate position on the view plane
        const viewPlanePoint = {
            x: this.position[0] + viewSpaceX * right.x + viewSpaceY * up.x,
            y: this.position[1] + viewSpaceX * right.y + viewSpaceY * up.y,
            z: this.position[2] + viewSpaceX * right.z + viewSpaceY * up.z
        };
        
        // 6. Cast ray from this point along the forward direction
        // Since we want Z=0, calculate where this ray intersects the Z=0 plane
        if (Math.abs(forward.z) < 1e-6) {
            // Ray is parallel to XY plane, no intersection
            return { x: Number.NaN, y: Number.NaN, z: 0 };
        }
        
        // Calculate t where ray intersects z=0 plane
        const t = -viewPlanePoint.z / forward.z;
        
        // Calculate intersection point in world space
        const worldPointRotated = {
            x: viewPlanePoint.x + t * forward.x,
            y: viewPlanePoint.y + t * forward.y,
            z: 0  // Exactly 0 by construction
        };
        
        // 7. Since the rotation is applied to objects (not the camera view),
        // we need to apply the inverse rotation to get back to original world coordinates
        // Inverse of rotation matrix is its transpose for orthogonal matrices
        const inverseRotation = [
            this.activeRotationMatrix[0], this.activeRotationMatrix[3], this.activeRotationMatrix[6],
            this.activeRotationMatrix[1], this.activeRotationMatrix[4], this.activeRotationMatrix[7],
            this.activeRotationMatrix[2], this.activeRotationMatrix[5], this.activeRotationMatrix[8]
        ];
        
        // Apply inverse rotation
        const worldPos = {
            x: inverseRotation[0] * worldPointRotated.x + inverseRotation[1] * worldPointRotated.y + inverseRotation[2] * worldPointRotated.z,
            y: inverseRotation[3] * worldPointRotated.x + inverseRotation[4] * worldPointRotated.y + inverseRotation[5] * worldPointRotated.z,
            z: inverseRotation[6] * worldPointRotated.x + inverseRotation[7] * worldPointRotated.y + inverseRotation[8] * worldPointRotated.z
        };
        
        return worldPos;
    }
}; 