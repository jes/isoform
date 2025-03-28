// Main application
const app = {
    document: null,
    lastSecondaryNode: null,
    lastAdjustmentTime: 0,
    adjustmentInterval: 1000, // ms
    wasFocused: true, // Track if window was previously focused
    sketchNeedsRedraw: false,
    sdf: null,
    intervalSdf: null,
    primaryShaderLayer: null,   // Store primary shader layer
    secondaryShaderLayer: null, // Store secondary shader layer
    undoStack: [],
    undoPointer: 0,
    grabHandles: [],

    async init() {
        // Initialize components
        if (!await renderer.init()) return;
        camera.init(renderer.canvas);
        scene.init();
        
        // Create the scene document
        this.createDocument();
        
        // Initialize UI
        ui.init();
        
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
        doc.addChild(new ShellNode(1, false, extr));

        // set unique names for all nodes
        let dfs = (node) => {
            node.setUniqueName(doc);
            for (let child of node.children) {
                dfs(child);
            }
        };
        dfs(doc);

        this.document = doc;
        this.document.setProperty('displayName', 'Document');
        return doc;
    },

    addGrabHandle(grabHandle) {
        this.grabHandles.push(grabHandle);
    },

    removeGrabHandles() {
        this.grabHandles.forEach(grabHandle => grabHandle.destroy());
        this.grabHandles = [];
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
        await this.rebuildShaders();

        // Prepare shader layers for rendering
        const shaderLayers = [];
        if (this.primaryShaderLayer) {
            this.primaryShaderLayer.setUniform('float', 'uOpacity', camera.opacity);
            this.primaryShaderLayer.setUniforms(this.document.uniforms());
            shaderLayers.push(this.primaryShaderLayer);
        }
        if (this.secondaryShaderLayer) {
            this.secondaryShaderLayer.setUniform('float', 'uOpacity', 0.5);
            this.secondaryShaderLayer.setUniforms(this.document.uniforms());
            shaderLayers.push(this.secondaryShaderLayer);
        }
        for (let grabHandle of this.grabHandles) {
            grabHandle.setUniforms();
            shaderLayers.push(grabHandle.shaderLayer);
        }
        
        // Render the scene with the shader layers
        try {
            renderer.render(shaderLayers);
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

    async rebuildShaders(force = false) {
        // Track the current secondary node
        const currentSecondaryNode = ui.getSecondaryNode();

        if (!this.document.dirty() && currentSecondaryNode === this.lastSecondaryNode && !force) {
            return;
        }

        this.showLoadingIndicator();
        
        // Only rebuild primary shader if document is dirty, or force
        if (force || this.document.dirty()) {
            if (this.document.dirty()) {
                // push undo state only if the document is actually changed (i.e.
                // not if we're only rebuilding because force is true due to
                // undo/redo)
                this.pushUndoState();

                ui.propertyEditorComponent?.refresh();
            }

            let startTime = performance.now();
            const expr = this.document.peptide(P.vvar('p'));
            if (expr) {
                console.log(`Peptide expression took ${performance.now() - startTime} ms`);
                startTime = performance.now();
                const ssa = new PeptideSSA(expr);
                console.log(`SSA took ${performance.now() - startTime} ms`);
                
                this.primaryShaderLayer = await this.createShaderLayer(ssa, this.primaryShaderLayer);
                this.primaryShaderLayer.setUniform('vec3', 'uObjectColor', [0.6, 0.6, 0.6]);

                // keep hold of the compiled SDF so that we can use it for coordinate display
                const fn = eval(ssa.compileToJS());
                this.sdf = (p) => {
                    const vars = {p: p, ...this.document.uniforms()};
                    const result = fn(vars);
                    return result;
                };

                //const intervalFn = eval(ssa.compileToJSInterval());
                //this.intervalSdf = (p) => intervalFn({p: p});
            } else {
                this.primaryShaderLayer = null;
            }

            this.document.markClean();
        }

        if (currentSecondaryNode !== null) {
            let expr;
            startTime = performance.now();
            expr = currentSecondaryNode.peptide(P.vvar('p'));
            if (expr) {
                console.log(`Peptide expression for secondary node took ${performance.now() - startTime} ms`);
                startTime = performance.now();
                const ssa = new PeptideSSA(expr);
                console.log(`SSA took ${performance.now() - startTime} ms`);
                
                this.secondaryShaderLayer = await this.createShaderLayer(ssa, this.secondaryShaderLayer);
                this.secondaryShaderLayer.setUniform('vec3', 'uObjectColor', [0.8, 0.2, 0.2]);
            } else {
                this.secondaryShaderLayer = null;
            }
        } else {
            this.secondaryShaderLayer = null;
        }

        this.lastSecondaryNode = currentSecondaryNode;
        this.lastAdjustmentTime = Date.now();
        
        this.hideLoadingIndicator();
    },

    async createShaderLayer(ssa, lastShaderLayer) {
        const uniforms = this.document.uniforms();
        const src = scene.generateShaderCode(ssa, uniforms);
        if (lastShaderLayer && lastShaderLayer.src == src) {
            return lastShaderLayer;
        }
        const program = await renderer.compileShaderProgram(src);
        return new ShaderLayer(program, src);
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

    undo() {
        if (this.undoPointer > 1) { // We need at least 2 states to undo (current + previous)
            this.undoPointer--;
            const state = this.undoStack[this.undoPointer - 1]; // Get the previous state
            this.document = TreeNode.fromSerialized(state);
            this.rebuildShaders(true);
            ui.renderTree();
        }
    },

    redo() {
        if (this.undoPointer < this.undoStack.length) {
            const state = this.undoStack[this.undoPointer];
            this.document = TreeNode.fromSerialized(state);
            this.undoPointer++;
            this.rebuildShaders(true);
            ui.renderTree();
        }
    },

    pushUndoState() {
        // Save the current state to the undo stack whenever the document changes
        // Truncate the undo stack if we're not at the end (discard any redo states)
        if (this.undoPointer < this.undoStack.length) {
            this.undoStack.length = this.undoPointer;
        }
        // Add the current state to the undo stack
        this.undoStack.push(this.document.serialize());
        this.undoPointer = this.undoStack.length;
    },

    flushUndoStack() {
        this.undoStack = [];
        this.undoPointer = 0;
    },
};

// Start the application when the page loads
window.onload = function() {
    app.init();
}; 
