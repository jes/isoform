// Main application
const app = {
    document: null,
    lastSecondaryNode: null,
    lastAdjustmentTime: 0,
    adjustmentInterval: 1000, // ms
    wasFocused: true, // Track if window was previously focused
    sketchNeedsRedraw: false,
    lastBoundingSphereState: false,

    async init() {
        // Initialize components
        if (!await renderer.init()) return;
        camera.init(renderer.canvas);
        scene.init();
        
        // Create the scene document
        this.createDocument();
        
        // Initialize UI with the document
        ui.init(this.document);
        
        // Initialize sketch editor
        ui.initSketchEditor();
        
        // Get references to UI elements
        this.fpsCounter = document.getElementById('fps-counter');
        this.shaderLoading = document.getElementById('shader-loading');
        
        // Add focus/blur event listeners
        window.addEventListener('focus', this.onWindowFocus.bind(this));
        window.addEventListener('blur', this.onWindowBlur.bind(this));
        
        // Start the render loop
        this.render();
    },
    
    onWindowFocus() {
        // Reset the adjustment time when window regains focus
        this.lastAdjustmentTime = Date.now();
        this.wasFocused = true;
    },
    
    onWindowBlur() {
        this.wasFocused = false;
    },
    
    createDocument() {
        const doc = new UnionNode([]);
        doc.setProperty('displayName', 'Document');
        const sphere = new SphereNode(11);
        const box = new TransformNode([0, 0, 0], [1, 0, 0], 45, 
                     new DistanceDeformNode(0.1, 2.0, new BoxNode([20, 20, 20], 1.0)));
        const torus = new TorusNode(10, 3);
        doc.setProperty('blendRadius', 1);

        doc.addChild(torus);
        doc.addChild(new SubtractionNode([box, new TransformNode([0, 10, 0], [0, 1, 0], 0, sphere)], 0.5));
        const extr = new ExtrudeNode(new SketchNode([ {x:0, y:0}, {x:20, y:0}, {x:20, y:20} ]));
        extr.setProperty('blendRadius', 1);
        extr.setProperty('chamfer', true);
        doc.addChild(new ThicknessNode(1, false, extr));

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

    coordinateSystemChanged() {
        this.sketchNeedsRedraw = true;
    },
    
    async render() {
        // Track the current secondary node
        const currentSecondaryNode = ui.getSecondaryNode();
        
        // Check if document is dirty or if a new secondary node is selected
        // or if bounding sphere visibility has changed while having a secondary node
        if (this.document.dirty() || 
            (currentSecondaryNode !== null && currentSecondaryNode !== this.lastSecondaryNode) ||
            (currentSecondaryNode !== null && ui.showBoundingSphere !== this.lastBoundingSphereState)) {

            // Show loading indicator
            this.showLoadingIndicator();
            
            // Compile shaders asynchronously
            await renderer.createShaderProgram(
                renderer.vertexShaderSource, 
                scene.generateShaderCode(this.document, ui.showBoundingSphere)
            );
            
            // Hide loading indicator
            this.hideLoadingIndicator();

            // update the last secondary node reference when we recompile
            if (currentSecondaryNode !== null) {
                this.lastSecondaryNode = currentSecondaryNode;
            }
            
            // Update last bounding sphere state
            this.lastBoundingSphereState = ui.showBoundingSphere;

            this.lastAdjustmentTime = Date.now();
        }
        
        // Render the scene
        try {
            renderer.render();
        } catch (e) {
            console.error(e);
        }
        
        this.controlQuality();

        if (this.sketchNeedsRedraw) {
            if (ui.sketchEditor) {
                ui.sketchEditor.render();
            }
            this.sketchNeedsRedraw = false;
        }
       
        // Request next frame
        requestAnimationFrame(() => this.render());
    },

    controlQuality() {
        // Only adjust quality when the window is focused
        if (!this.wasFocused) return;
        
        const timeSinceLastAdjustment = Date.now() - this.lastAdjustmentTime;
        if (timeSinceLastAdjustment > this.adjustmentInterval) {
            const fpsRatio = renderer.currentFps / 45;
            if (fpsRatio > 1.1 || fpsRatio < 0.9) {
                renderer.setResolutionScale(renderer.resolutionScale * Math.sqrt(fpsRatio));
                document.getElementById('resolution-scale').textContent = renderer.resolutionScale.toFixed(3);
                this.lastAdjustmentTime = Date.now();
            }
        }
    },
};

// Start the application when the page loads
window.onload = function() {
    app.init();
}; 
