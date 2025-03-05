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
        const doc = new UnionNode();
        const sphere = new SphereNode(1.0);
        const box = new BoxNode([1, 1, 1]);
        const torus = new TorusNode(1.0, 0.3);

        doc.addChild(new TranslateNode([0, 1, 0], sphere));
        doc.addChild(box);
        doc.addChild(torus);

        // Check if shader needs to be updated
        const newShaderCode = scene.generateShaderCode(doc);
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