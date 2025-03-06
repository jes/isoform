// Camera controls
const camera = {
    position: [0.0, 0.0, -10000.0],
    target: [0.0, 0.0, 0.0],
    zoom: 0.1,
    rotationX: 0.0,
    rotationY: 0.0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    rotationSpeed: 0.01,
    zoomSpeed: 0.1,
    panSpeed: 0.01,
    showEdges: true,
    
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
        
        // No need for clamping - we allow arbitrary zoom levels now
    }
}; 