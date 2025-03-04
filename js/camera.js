// Camera controls
const camera = {
    position: [0.0, 0.0, -5.0],
    target: [0.0, 0.0, 0.0],
    zoom: 1.0,
    rotationX: 0.0,
    rotationY: 0.0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    rotationSpeed: 0.01,
    zoomSpeed: 0.1,
    panSpeed: 0.01,
    
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
    },
    
    onMouseUp() {
        this.isDragging = false;
    },
    
    onMouseLeave() {
        this.isDragging = false;
    },
    
    onMouseMove(e) {
        if (!this.isDragging) return;
        
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;
        
        if (e.shiftKey) {
            // Pan camera in screen space
            const panX = -deltaX * this.panSpeed;
            const panY = deltaY * this.panSpeed;
            
            this.target[0] += panX;
            this.target[1] += panY;
            this.position[0] += panX;
            this.position[1] += panY;
        } else {
            // Rotate the scene
            this.rotationY += deltaX * this.rotationSpeed;
            this.rotationX += deltaY * this.rotationSpeed;
        }
        
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
    },
    
    onWheel(e) {
        e.preventDefault();
        
        // Adjust zoom based on wheel direction
        const zoomDelta = e.deltaY * this.zoomSpeed * 0.01;
        this.zoom += zoomDelta;
        
        // Clamp zoom to reasonable values
        this.zoom = Math.max(0.1, Math.min(2.0, this.zoom));
    }
}; 