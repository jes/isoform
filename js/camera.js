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
    panSpeed: 0.01,
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
            // Pan camera in screen space
            const panX = -(e.clientX - this.lastMouseX) * this.panSpeed;
            const panY = (e.clientY - this.lastMouseY) * this.panSpeed;
            
            this.target[0] += panX;
            this.target[1] += panY;
            this.position[0] += panX;
            this.position[1] += panY;
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
    }
}; 