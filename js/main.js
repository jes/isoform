// Main application
const app = {
    async init() {
        // Initialize components
        if (!await renderer.init()) return;
        camera.init(renderer.canvas);
        scene.init();
        
        // Start the render loop
        this.render();
    },
    
    render() {
        // Check if shader needs to be updated
        const newShaderCode = scene.generateShaderCode();
        if (newShaderCode) {
            renderer.createShaderProgram(renderer.vertexShaderSource, newShaderCode);
        }
        
        // Render the scene
        renderer.render();
        
        // Request next frame
        requestAnimationFrame(() => this.render());
    }
};

// Start the application when the page loads
window.onload = function() {
    app.init();
}; 