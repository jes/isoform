// Main application
const app = {
    document: null,
    
    async init() {
        // Initialize components
        if (!await renderer.init()) return;
        camera.init(renderer.canvas);
        scene.init();
        
        // Create the scene document
        this.createDocument();
        
        // Initialize UI with the document
        ui.init(this.document);
        
        // Start the render loop
        this.render();
    },
    
    createDocument() {
        const doc = new UnionNode([], 0.5);
        const sphere = new SphereNode(1.1);
        const box = new RotateNode([Math.PI / 4, 0, 0], new RoughnessNode(0.01, 20.0, new BoxNode([1, 1, 1])));
        const torus = new TorusNode(1.0, 0.3);

        doc.addChild(torus);
        doc.addChild(new SubtractionNode([box, new TranslateNode([0, 1, 0], sphere)], 0.5));
        
        this.document = doc;
        return doc;
    },
    
    render() {
        if (this.document.dirty()) {
            renderer.createShaderProgram(renderer.vertexShaderSource, scene.generateShaderCode(this.document));
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