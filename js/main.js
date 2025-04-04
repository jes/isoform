// Main application
const app = {
    document: null,
    lastSelectedNode: null,
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
    showAABB: false, // Add this line to track AABB visualization state

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
        
        // Add AABB toggle button listener
        document.getElementById('toggle-aabb').addEventListener('click', (e) => {
            this.showAABB = !this.showAABB;
            e.target.classList.toggle('active');
            this.rebuildShaders(true);
        });
        
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
        /*const sphere = new SphereNode(11);
        const box = new TransformNode([0, 0, 0], [1, 0, 0], 45, 
                     new DistanceDeformNode(0.1, 2.0, new BoxNode([20, 20, 20], 1.0)));
        const torus = new TorusNode(10, 3);
        doc.setProperty('blendRadius', 1);

        doc.addChild(torus);
        doc.addChild(new SubtractionNode([box, new TransformNode([0, 10, 0], [0, 1, 0], 0, sphere)], 0.5));
        const extr = new ExtrudeNode(new SketchNode([ {x:0, y:0}, {x:20, y:0}, {x:20, y:20} ]));
        extr.setProperty('blendRadius', 1);
        extr.setProperty('chamfer', 1.0);
        doc.addChild(new ShellNode(1, false, extr));*/

        /*const mesh = new Mesh([
            // Base triangle (counter-clockwise when viewed from outside/below)
            [new Vec3(-10, -10, 0), new Vec3(10, 10, 0), new Vec3(10, -10, 0)],
            // Three faces connecting to apex (all counter-clockwise when viewed from outside)
            [new Vec3(-10, -10, 0), new Vec3(10, -10, 0), new Vec3(0, 0, 10)],
            [new Vec3(10, -10, 0), new Vec3(10, 10, 0), new Vec3(0, 0, 10)],
            [new Vec3(10, 10, 0), new Vec3(-10, -10, 0), new Vec3(0, 0, 10)]
        ]);
        doc.addChild(VoxelNode.fromMesh(mesh));*/
        const sphere = new SphereNode();
        const gyroid = new GyroidNode();
        const intersection = new IntersectionNode([sphere, gyroid]);
        intersection.setProperty('blendRadius', 0.1);
        doc.addChild(intersection);

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
            this.primaryShaderLayer.setUniform('float', 'uObjectUnderCursor', ui.selectedNode?.uniqueId ?? -1);
            this.primaryShaderLayer.setUniform('float', 'uSelectedObject', renderer.nodeUnderCursor?.uniqueId ?? -1);
            shaderLayers.push(this.primaryShaderLayer);
        }
        if (this.secondaryShaderLayer) {
            this.secondaryShaderLayer.setUniform('float', 'uOpacity', 0.25);
            this.secondaryShaderLayer.setUniforms(this.document.uniforms());
            this.secondaryShaderLayer.setUniform('float', 'uObjectUnderCursor', -1);
            this.secondaryShaderLayer.setUniform('float', 'uSelectedObject', -1);
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
        const currentSelectedNode = ui.selectedNode;

        if (!this.document.dirty() && currentSelectedNode === this.lastSelectedNode && !force) {
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
            const expr = P.field(this.document.peptide(P.vvar('p')), 'distance');
            if (expr) {
                console.log(`Peptide expression took ${performance.now() - startTime} ms`);
                startTime = performance.now();
                let ssa;
                [this.sdf, ssa] = this.document.getSDFAndSSA(true);
                console.log(`SSA took ${performance.now() - startTime} ms`);


                const peptide = P.field(this.document.peptide(P.vvar('p')), 'distance').derivative('p');
                const ssaNormal = P.vec3(peptide[0], peptide[1], peptide[2]).ssa();
                
                this.primaryShaderLayer = await this.createShaderLayer(ssa, ssaNormal, this.primaryShaderLayer);

            } else {
                this.primaryShaderLayer = null;
            }

            this.document.markClean();
        }

        if (currentSelectedNode !== null && !currentSelectedNode.aabb().isInfinite()) {
            let expr;
            let node;
            
            // If AABB visualization is enabled, create an AABB representation
            if (this.showAABB) {
                // TODO: instead of using TreeNodes, we could have a static shader
                // that takes the center and size as uniforms and renders a box

                // Get the AABB of the secondary node
                const nodeAABB = currentSelectedNode.aabb();
                const center = nodeAABB.getCenter();
                const size = nodeAABB.getSize();
                
                // Create a BoxNode with the size of the AABB
                const boxNode = new BoxNode([size.x, size.y, size.z], 0);
                
                // Create a TransformNode to position the box at the center of the AABB
                const transformNode = new TransformNode([center.x, center.y, center.z], [0, 1, 0], 0, boxNode);
                
                // Generate the peptide expression for the AABB representation
                startTime = performance.now();
                expr = transformNode.peptide(P.vvar('p'));
                node = transformNode;
            } else {
                // Use the normal secondary node
                startTime = performance.now();
                expr = currentSelectedNode.peptide(P.vvar('p'));
            }
        
            console.log(`Peptide expression for secondary node took ${performance.now() - startTime} ms`);
            startTime = performance.now();
            expr = P.struct({
                distance: P.field(expr, 'distance'),
                color: P.vconst(new Vec3(0.8, 0.2, 0.2))
            });
            const ssa = expr.ssa();
            const peptide = P.field(expr, 'distance').derivative('p');
            const peptideVec3 = P.vec3(peptide[0], peptide[1], peptide[2]);
            const ssaNormal = peptideVec3.ssa();
            console.log(`SSA took ${performance.now() - startTime} ms`);
            
            this.secondaryShaderLayer = await this.createShaderLayer(ssa, ssaNormal, this.secondaryShaderLayer, node?.uniforms());

            if (this.showAABB) {
                this.secondaryShaderLayer.setUniforms(node.uniforms());
            }
        } else {
            this.secondaryShaderLayer = null;
        }

        this.lastSelectedNode = currentSelectedNode;
        this.lastAdjustmentTime = Date.now();
        
        this.hideLoadingIndicator();
    },

    async createShaderLayer(ssa, ssaNormal, lastShaderLayer, uniforms = null) {
        uniforms ||= this.document.uniforms();
        const src = scene.generateShaderCode(ssa, ssaNormal, uniforms);
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

    defaultColor() {
        return P.vconst(new Vec3(0.6, 0.6, 0.6));
    },
};

// Start the application when the page loads
window.onload = function() {
    app.init();
}; 
