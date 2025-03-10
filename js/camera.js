// Camera controls
const camera = {
    position: [0.0, 0.0, -1000.0],
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
    rotationSpeed: 0.01,
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
    msaaSamples: 2, // Default to 2x2 MSAA (4 samples)
    
    init(canvas) {
        // Mouse event handlers
        canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        canvas.addEventListener('mouseup', () => this.onMouseUp());
        canvas.addEventListener('mouseleave', () => this.onMouseLeave());
        canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        canvas.addEventListener('wheel', (e) => this.onWheel(e));
    },
    
    onMouseDown(e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        // Store the initial mouse position for this drag operation
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        // Save the base rotation at the start of the drag
        this.dragStartRotation = [...this.baseRotationMatrix];
    },
    
    onMouseUp() {
        this.isDragging = false;
        // Update base rotation matrix to current active matrix
        this.baseRotationMatrix = [...this.activeRotationMatrix];
    },
    
    onMouseLeave() {
        this.isDragging = false;
        // Update base rotation matrix to current active matrix
        this.baseRotationMatrix = [...this.activeRotationMatrix];
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
        if (!this.isDragging) return;
        
        // Calculate delta from the start of the drag, not just from the last frame
        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;
        
        if (e.shiftKey) {
            // Get canvas dimensions for proper scaling
            const canvasWidth = renderer.canvas.width;
            const canvasHeight = renderer.canvas.height;
            
            // Calculate aspect ratio
            const aspectRatio = canvasWidth / canvasHeight;
            
            // Convert pixel movement to normalized device coordinates (-1 to 1)
            // and then to world space units
            const pixelMoveX = e.clientX - this.lastMouseX;
            const pixelMoveY = e.clientY - this.lastMouseY;
            
            // Scale based on canvas size (2.0 represents the full NDC range from -1 to 1)
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
        } else {
            // Create rotation matrices based on total mouse movement from drag start
            const rotX = this.createRotationMatrixX(-deltaY * this.rotationSpeed);
            const rotY = this.createRotationMatrixY(-deltaX * this.rotationSpeed);
            
            // Apply rotations to the drag start rotation matrix
            const combinedRotation = this.multiplyMatrices(rotX, rotY);
            this.activeRotationMatrix = this.multiplyMatrices(combinedRotation, this.dragStartRotation);
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
    },
    
    setStandardView(rotationMatrix) {
        // Set both base and active rotation matrices to the standard view
        this.baseRotationMatrix = [...rotationMatrix];
        this.activeRotationMatrix = [...rotationMatrix];
        
        // Reset any ongoing drag operation
        this.isDragging = false;
        
        // Reset the drag start rotation
        this.dragStartRotation = [...rotationMatrix];
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
    }
}; 