// Main application
const app = {
    document: null,
    lastSecondaryNode: null,
    
    async init() {
        // Initialize components
        if (!await renderer.init()) return;
        camera.init(renderer.canvas);
        scene.init();
        
        // Create the scene document
        this.createDocument();
        
        // Initialize UI with the document
        ui.init(this.document);
        
        // Get references to UI elements
        this.fpsCounter = document.getElementById('fps-counter');
        this.shaderLoading = document.getElementById('shader-loading');
        
        // Start the render loop
        this.render();
    },
    
    createDocument() {
        const doc = new UnionNode([]);
        doc.setProperty('displayName', 'Document');
        const sphere = new SphereNode(11);
        const box = new TransformNode([0, 0, 0], [1, 0, 0], 45, 
                     new RoughnessNode(0.1, 2.0, new BoxNode([20, 20, 20], 1.0)));
        const torus = new TorusNode(10, 3);
        doc.setProperty('smoothK', 1);

        doc.addChild(torus);
        doc.addChild(new SubtractionNode([box, new TransformNode([0, 10, 0], [0, 1, 0], 0, sphere)], 0.5));
        
        this.document = doc;
        return doc;
    },
    
    showLoadingIndicator() {
        if (this.fpsCounter && this.shaderLoading) {
            this.fpsCounter.style.display = 'none';
            this.shaderLoading.style.display = 'flex';
        }
    },
    
    hideLoadingIndicator() {
        if (this.fpsCounter && this.shaderLoading) {
            this.fpsCounter.style.display = 'block';
            this.shaderLoading.style.display = 'none';
        }
    },
    
    async render() {
        // Track the current secondary node
        const currentSecondaryNode = ui.getSecondaryNode();
        
        // Check if document is dirty or if a new secondary node is selected
        if (this.document.dirty() || 
            (currentSecondaryNode !== null && currentSecondaryNode !== this.lastSecondaryNode)) {

            // Show loading indicator
            this.showLoadingIndicator();
            
            // Compile shaders asynchronously
            await renderer.createShaderProgram(
                renderer.vertexShaderSource, 
                scene.generateShaderCode(this.document)
            );
            
            // Hide loading indicator
            this.hideLoadingIndicator();

            // update the last secondary node reference when we recompile
            this.lastSecondaryNode = currentSecondaryNode;
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