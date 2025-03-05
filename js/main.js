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
        const doc = new UnionNode([]);
        doc.setProperty('displayName', 'Document');
        const sphere = new SphereNode(1.1);
        const box = new RotateNode([1.0, 0, 0], 45, new RoughnessNode(0.01, 20.0, new BoxNode([2, 2, 2])));
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
        try {
            renderer.render();
        } catch (e) {
            console.error(e);
        }
        
        // Request next frame
        requestAnimationFrame(() => this.render());
    }
};

// Start the application when the page loads
window.onload = function() {
    app.init();
}; 