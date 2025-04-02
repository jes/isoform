// UI management for tree view and property editor
const ui = {
    treeView: null,
    treeViewComponent: null,
    propertyEditor: null,
    propertyEditorComponent: null,
    sketchEditor: null,
    selectedNode: null,
    secondaryNode: null,
    clipboard: null,

    init() {
        this.treeView = document.getElementById('tree-view');
        this.propertyEditor = document.getElementById('property-editor');
        
        // Initialize the TreeView component
        this.treeViewComponent = new TreeView(this.treeView, {
            onNodeSelected: (node) => {
                this.selectNode(node);
            },
            onNodeContextMenu: (e, node) => {
                this.showContextMenu(e, node);
            },
            onTreeUpdated: () => {
                // Any additional logic needed after tree updates
            },
            onNodeDragStart: (node) => {
                // Store the dragging node
                this.draggingNode = node;
            },
            onNodeDragEnd: (node) => {
                // Clear the dragging node
                this.draggingNode = null;
                
                // Force a complete re-render of the tree
                this.renderTree();
            },
            onNodeDrop: (draggedNode, targetNode) => {
                // Handle the node drop
                this.moveNode(draggedNode, targetNode);
            },
            // Provide a way to get the document root
            getDocument: () => {
                return app.document;
            }
        });
        
        // Initialize the PropertyEditor component
        this.propertyEditorComponent = new PropertyEditor(this.propertyEditor, {
            onPropertyChanged: (node, propName) => {
                this.updateTreeIfNeeded(node, propName);
            },
            onInputFocused: (node) => {
                this.secondaryNode = node;
            },
            onInputBlurred: () => {
                // Clear the editing node when focus is lost
                this.secondaryNode = null;
            }
        });
        
        // Initialize resize functionality
        this.initResizeHandle();
        
        // Initialize display options
        this.initDisplayOptions();
        
        // Initialize view toolbar
        this.initViewToolbar();
        
        // Initial render of the tree
        this.renderTree();

        // Add dropdown menu functionality
        const appTitle = document.getElementById('app-title');
        const fileDropdown = document.getElementById('file-dropdown');

        // Toggle dropdown when clicking on the app title
        appTitle.addEventListener('click', (e) => {
            e.stopPropagation();
            fileDropdown.classList.toggle('show');
        });

        // Close dropdown when clicking elsewhere
        document.addEventListener('click', () => {
            if (fileDropdown.classList.contains('show')) {
                fileDropdown.classList.remove('show');
            }
        });

        // Set up event listeners for dropdown items
        document.getElementById('new-document').addEventListener('click', () => {
            this.createNewDocument();
            fileDropdown.classList.remove('show');
        });

        document.getElementById('open-document').addEventListener('click', () => {
            this.openDocument();
            fileDropdown.classList.remove('show');
        });

        document.getElementById('save-document').addEventListener('click', () => {
            this.saveDocument();
            fileDropdown.classList.remove('show');
        });

        // Add event listeners for undo/redo buttons
        document.getElementById('undo-action').addEventListener('click', () => {
            app.undo();
            fileDropdown.classList.remove('show');
        });

        document.getElementById('redo-action').addEventListener('click', () => {
            app.redo();
            fileDropdown.classList.remove('show');
        });
    },

    initResizeHandle() {
        const resizeHandle = document.getElementById('resize-handle');
        const uiPanel = document.getElementById('ui-panel');
        let startX, startWidth;
        
        if (!resizeHandle || !uiPanel) return;
        
        const startResize = (e) => {
            startX = e.clientX;
            startWidth = parseInt(document.defaultView.getComputedStyle(uiPanel).width, 10);
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none'; // Prevent text selection during resize
        };
        
        const resize = (e) => {
            // Calculate new width (we're resizing from the left edge now)
            const newWidth = startWidth - (startX - e.clientX);
            // Set minimum and maximum width constraints
            if (newWidth > 150 && newWidth < window.innerWidth * 0.5) {
                uiPanel.style.width = `${newWidth}px`;
                // Trigger canvas resize to update WebGL viewport
                if (renderer && renderer.resizeCanvas) {
                    renderer.resizeCanvas();
                }
            }
        };
        
        const stopResize = () => {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Recalculate tree lines after resizing
            setTimeout(() => this.adjustTreeLines(), 100);
        };
        
        resizeHandle.addEventListener('mousedown', startResize);
    },

    adjustTreeLines() {
        // Find all tree-children elements
        const treeChildrenElements = document.querySelectorAll('.tree-children');
        
        treeChildrenElements.forEach(element => {
            // Get all child nodes in this container
            const childNodes = element.querySelectorAll(':scope > .tree-node');
            
            if (childNodes.length > 0) {
                // Get the last visible child node
                const lastChild = childNodes[childNodes.length - 1];
                const lastChildLabel = lastChild.querySelector('.tree-node-label-container');
                
                if (lastChildLabel) {
                    // Calculate the position of the last child relative to the parent container
                    const parentRect = element.getBoundingClientRect();
                    const lastChildRect = lastChildLabel.getBoundingClientRect();
                    
                    // Calculate the distance from the top of the container to the middle of the last child
                    const distance = (lastChildRect.top - parentRect.top) + (lastChildRect.height / 2);
                    
                    // Set the height of the vertical line to this distance
                    element.style.setProperty('--line-height', `${distance}px`);
                }
            }
        });
    },
    
    renderTree() {
        if (!app.document || !this.treeView) return;
        
        // Use the TreeView component to render the tree
        this.treeViewComponent.render(app.document);
        
        // Check if the selected node still exists in the document tree
        if (this.selectedNode) {
            const nodeExists = this.nodeExistsInTree(this.selectedNode, app.document);
            if (!nodeExists) {
                this.selectNode(null);
            }
        }
    },
    
    updateTreeIfNeeded(node, propName) {
        // Check if the property that changed requires a tree update
        if (propName === 'displayName') {
            // Use the TreeView component to update just the node label
            this.treeViewComponent.updateNodeLabel(node);
        }
        
        // Add other properties that might require tree updates here
        // For example, if changing a property affects the hierarchy
        // or visibility of nodes, you might need to call renderTree()
    },

    replaceNode(originalNode, transformNode, addAsChild = false) {
        // Get the parent of the original node
        const parent = originalNode.parent;
        
        if (!parent) {
            console.error("Cannot transform root node");
            return;
        }

        parent.replaceChild(originalNode, transformNode);

        if (addAsChild) {
            transformNode.addChild(originalNode);
        }
       
        this.selectNode(transformNode instanceof TreeNode ? transformNode : null);
        this.renderTree();
    },

    selectNode(node) {
        app.removeGrabHandles();
        this.selectedNode = node;
        if (node) {
            this.treeViewComponent.setSelectedNode(node);
            this.propertyEditorComponent.render(node);
            Object.entries(node.grabHandles()).forEach(([name, { origin, axis, ratio, get, set, color }]) => {
                get ||= (() => node.getProperty(name));
                set ||= ((value) => node.setProperty(name, value));
                ratio ||= 1;
                app.addGrabHandle(new GrabHandle({
                    position: origin.add(axis.mul(get()*ratio)),
                    origin: origin,
                    axis: axis,
                    color: color,
                    onChange: (pos) => {
                        const length = pos.sub(origin).length();
                        set(length/ratio);
                    },
                }));
            });
        }
        if (node instanceof SketchNode) {
            this.openSketchEditor(node);
        } else {
            this.sketchEditor.close();
        }
    },

    showContextMenu(event, node) {
        // Remove any existing context menus
        const existingMenu = document.getElementById('tree-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.id = 'tree-context-menu';
        contextMenu.className = 'context-menu';
        contextMenu.style.position = 'absolute';
        
        // Initially position at click location
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.top = `${event.clientY}px`;

        // Add clipboard operations
        this.buildClipboardOptions(contextMenu, node);
        this.addMenuSeparator(contextMenu);

        // Only show combinators and modifiers if not the root node
        if (node.parent) {
            // Combinators
            this.buildCombinatorOptions(contextMenu, node);
            this.addMenuSeparator(contextMenu);
            
            // Modifiers
            this.buildModifierOptions(contextMenu, node);
            this.addMenuSeparator(contextMenu);
        }
        
        // Display properties
        this.buildDisplayOptions(contextMenu, node);
        this.addMenuSeparator(contextMenu);
        
        // Add separator if node can add children
        if (node.canAddMoreChildren()) {
            this.buildPrimitiveOptions(contextMenu, node);
            this.addMenuSeparator(contextMenu);
        }

        // Only show delete options for non-root nodes or nodes with children
        if (node.parent) {
            const infiniteChildren = node.parent.maxChildren == null;
            const canAddChildren = infiniteChildren || (node.parent.maxChildren - node.parent.children.length) >= node.children.length;
            if (node.children.length == 1 || (node.children.length > 1 && canAddChildren)) {
                this.addMenuItem(contextMenu, 'Delete this', () => {
                    this.replaceNode(node, [...node.children]);
                    this.renderTree();
                }, '🗑️');
            }
        }
        
        if (node.children.length > 0) {
            this.addMenuItem(contextMenu, 'Delete children', () => {
                // Create a copy of the children array to avoid modification issues during iteration
                const childrenToDelete = [...node.children];
                childrenToDelete.forEach(child => child.delete());
                this.renderTree();
            }, '🗑️');
        } else if (node.parent) { // Only allow deleting non-root nodes
            this.addMenuItem(contextMenu, 'Delete this', () => {
                node.delete();
                this.renderTree();
            }, '🗑️');
        }

        if (node.parent && node.children.length > 0) {
            this.addMenuItem(contextMenu, 'Delete with children', () => {
                node.delete();
                this.renderTree();
            }, '🗑️');
        }
        
        // Add the menu to the document
        document.body.appendChild(contextMenu);
        
        // Adjust position if menu would go off screen
        this.adjustContextMenuPosition(contextMenu, event);
        
        // Close the menu when clicking elsewhere
        const closeContextMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.remove();
                document.removeEventListener('mousedown', closeContextMenu);
            }
        };
        
        // Use setTimeout to avoid the menu being immediately closed by the current click event
        setTimeout(() => {
            document.addEventListener('mousedown', closeContextMenu);
        }, 0);
    },

    // Add this new method to handle context menu positioning
    adjustContextMenuPosition(menu, event) {
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Get menu dimensions
        const menuRect = menu.getBoundingClientRect();
        const menuWidth = menuRect.width;
        const menuHeight = menuRect.height;
        
        // Check if menu would go off the right edge
        if (event.clientX + menuWidth > viewportWidth) {
            menu.style.left = `${viewportWidth - menuWidth - 10}px`;
        }
        
        // Check if menu would go off the bottom edge
        if (event.clientY + menuHeight > viewportHeight) {
            // First try: position above the click point if there's enough space
            if (event.clientY - menuHeight > 0) {
                menu.style.top = `${event.clientY - menuHeight}px`;
            } else {
                // Not enough space above either - we need to handle overflow
                
                // Check if menu is too tall for the viewport
                if (menuHeight > viewportHeight - 40) { // Leave some margin
                    // Determine if we should use scrolling or columns
                    if (menuHeight > viewportHeight * 1.5) {
                        // Split into columns if very tall
                        this.convertMenuToColumns(menu);
                    } else {
                        // Make scrollable if moderately tall
                        this.makeMenuScrollable(menu, viewportHeight);
                    }
                } else {
                    // Just position at top with a small margin
                    menu.style.top = '10px';
                }
            }
        }
    },

    // Add method to make the menu scrollable
    makeMenuScrollable(menu, viewportHeight) {
        // Set a max height with some margin
        const maxHeight = viewportHeight - 40;
        menu.style.maxHeight = `${maxHeight}px`;
        menu.style.overflowY = 'auto';
        menu.style.top = '20px'; // Position near the top
    },

    // Add method to convert menu to columns
    convertMenuToColumns(menu) {
        // Get all menu items
        const items = Array.from(menu.children);
        const itemCount = items.length;
        
        // Determine number of columns (2 is usually good)
        const columns = 2;
        const itemsPerColumn = Math.ceil(itemCount / columns);
        
        // Create column containers
        const columnContainer = document.createElement('div');
        columnContainer.style.display = 'flex';
        columnContainer.style.flexDirection = 'row';
        columnContainer.style.gap = '10px';
        
        // Create columns and distribute items
        for (let i = 0; i < columns; i++) {
            const column = document.createElement('div');
            column.className = 'context-menu-column';
            
            // Add items to this column
            const startIdx = i * itemsPerColumn;
            const endIdx = Math.min(startIdx + itemsPerColumn, itemCount);
            
            for (let j = startIdx; j < endIdx; j++) {
                if (items[j]) {
                    column.appendChild(items[j]);
                }
            }
            
            columnContainer.appendChild(column);
        }
        
        // Clear the menu and add the column container
        menu.innerHTML = '';
        menu.appendChild(columnContainer);
        
        // Position near the top
        menu.style.top = '20px';
        
        // Ensure the menu doesn't get too wide
        menu.style.maxWidth = '80%';
    },

    buildCombinatorOptions(contextMenu, node) {
        // Define combinators in a simple array of objects
        const combinators = [
            { name: 'Union', constructor: UnionNode, icon: UnionNode.prototype.getIcon() },
            { name: 'Intersection', constructor: IntersectionNode, icon: IntersectionNode.prototype.getIcon() },
            { name: 'Subtraction', constructor: SubtractionNode, icon: SubtractionNode.prototype.getIcon() },
            { name: 'Interpolate', constructor: InterpolateNode, icon: InterpolateNode.prototype.getIcon() }
        ];
        
        combinators.forEach(combinator => {
            this.addMenuItem(contextMenu, combinator.name, () => {
                const newNode = new combinator.constructor();
                newNode.setUniqueName(app.document);
                this.replaceNode(node, newNode, true);
            }, combinator.icon);
        });
    },

    buildModifierOptions(contextMenu, node) {
        // Define modifiers in a simple array of objects
        const modifiers = [
            { name: 'Transform', constructor: TransformNode, icon: TransformNode.prototype.getIcon() },
            { name: 'Scale', constructor: ScaleNode, icon: ScaleNode.prototype.getIcon() },
            { name: 'Twist', constructor: TwistNode, icon: TwistNode.prototype.getIcon() },
            { name: 'Domain Deform', constructor: DomainDeformNode, icon: DomainDeformNode.prototype.getIcon() },
            { name: 'Distance Deform', constructor: DistanceDeformNode, icon: DistanceDeformNode.prototype.getIcon() },
            { name: 'Shell', constructor: ShellNode, icon: ShellNode.prototype.getIcon() },
            { name: 'Infill', constructor: InfillNode, icon: InfillNode.prototype.getIcon() },
            { name: 'Offset', constructor: OffsetNode, icon: OffsetNode.prototype.getIcon() },
            { name: 'Mirror', constructor: MirrorNode, icon: MirrorNode.prototype.getIcon() },
            { name: 'Linear Pattern', constructor: LinearPatternNode, icon: LinearPatternNode.prototype.getIcon() },
            { name: 'Polar Pattern', constructor: PolarPatternNode, icon: PolarPatternNode.prototype.getIcon() },
            { name: 'Extrude', constructor: ExtrudeNode, icon: ExtrudeNode.prototype.getIcon() },
            { name: 'Helix Extrude', constructor: HelixExtrudeNode, icon: HelixExtrudeNode.prototype.getIcon() },
            { name: 'Revolve', constructor: RevolveNode, icon: RevolveNode.prototype.getIcon() },
            { name: 'Distance Deform Inside', constructor: DistanceDeformInsideNode, icon: DistanceDeformInsideNode.prototype.getIcon() },
            { name: 'Color', constructor: ColorNode, icon: ColorNode.prototype.getIcon() },
            { name: 'Polka Dot', constructor: PolkaDotNode, icon: PolkaDotNode.prototype.getIcon() },
        ];
        
        modifiers.forEach(modifier => {
            this.addMenuItem(contextMenu, modifier.name, () => {
                const newNode = new modifier.constructor();
                newNode.setUniqueName(app.document);
                this.replaceNode(node, newNode, true);
            }, modifier.icon);
        });
    },

    buildPrimitiveOptions(contextMenu, node) {
        // Add shape creation options
        const shapes = [
            { name: 'Box', constructor: BoxNode, icon: BoxNode.prototype.getIcon() },
            { name: 'Sphere', constructor: SphereNode, icon: SphereNode.prototype.getIcon() },
            { name: 'Cylinder', constructor: CylinderNode, icon: CylinderNode.prototype.getIcon() },
            { name: 'Torus', constructor: TorusNode, icon: TorusNode.prototype.getIcon() },
            { name: 'Gyroid', constructor: GyroidNode, icon: GyroidNode.prototype.getIcon() },
            { name: 'Cubic Lattice', constructor: CubicLatticeNode, icon: CubicLatticeNode.prototype.getIcon() },
            { name: 'Sketch', constructor: SketchNode, icon: SketchNode.prototype.getIcon() }
        ];
        
        shapes.forEach(shape => {
            this.addMenuItem(contextMenu, `Add ${shape.name}`, () => {
                const newNode = new shape.constructor();
                newNode.setUniqueName(app.document);
                node.addChild(newNode);
                this.selectNode(newNode);
                this.renderTree();
            }, shape.icon);
        });
        
        // Handle STL import separately
        this.addMenuItem(contextMenu, 'Import STL', () => {
            this.importSTL(node);
        }, MeshNode.prototype.getIcon());
    },

    // Add this new method to handle STL import
    importSTL(parentNode) {
        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.stl';
        
        // Add event listener for file selection
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length === 0) return;
            
            const file = e.target.files[0];
            
            // Show a loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.innerHTML = '<div class="spinner"></div><div>Importing STL...</div>';
            document.body.appendChild(loadingIndicator);
            
            try {
                // Import the STL file
                const mesh = await STL.import(file);
                
                // Create a new VoxelNode with the imported mesh
                const voxelNode = VoxelNode.fromMesh(mesh);
                
                // Set a display name based on the file name
                const fileName = file.name.replace(/\.stl$/i, '');
                voxelNode.setProperty('displayName', fileName);
                
                // Make sure the node has a unique name
                voxelNode.setUniqueName(app.document);
                
                // Add the mesh node to the parent
                parentNode.addChild(voxelNode);
                
                // Select the new node and update the tree
                this.selectNode(voxelNode);
                this.renderTree();
                
                console.log(`Imported STL with ${mesh.vertices.length} vertices and ${mesh.triangles.length} triangles`);
            } catch (error) {
                console.error('Error importing STL:', error);
                alert(`Failed to import STL: ${error}`);
            } finally {
                // Remove the loading indicator
                loadingIndicator.remove();
            }
        });
        
        // Trigger the file dialog
        fileInput.click();
    },

    buildDisplayOptions(contextMenu, node) {
        // Add display property options
        const isDisabled = node.isDisabled === true;
        
        this.addMenuItem(contextMenu, isDisabled ? 'Enable' : 'Disable', () => {
            if (isDisabled) {
                node.enable();
            } else {
                node.disable();
            }
            this.renderTree();
        }, isDisabled ? '👁️' : '👁️‍🗨️');
        
        // Add STL export options
        this.addMenuItem(contextMenu, 'Export ASCII STL', () => {
            this.exportNodeAsSTL(node, false);
        }, '📄');
        
        this.addMenuItem(contextMenu, 'Export Binary STL', () => {
            this.exportNodeAsSTL(node, true);
        }, '📦');
        
        // Only add move options for non-root nodes
        if (node.parent) {
            // Find the index of this node in its parent's children array
            const siblings = node.parent.children;
            const nodeIndex = siblings.indexOf(node);
            
            // Add "Move Up" if not the first child
            if (nodeIndex > 0) {
                this.addMenuItem(contextMenu, 'Move Up', () => {
                    this.moveNodeInDirection(node, -1);
                }, '⬆️');
            }
            
            // Add "Move Down" if not the last child
            if (nodeIndex < siblings.length - 1) {
                this.addMenuItem(contextMenu, 'Move Down', () => {
                    this.moveNodeInDirection(node, 1);
                }, '⬇️');
            }
        }
    },

    addMenuItem(menu, text, onClick, icon = null) {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        
        if (icon) {
            // Create icon span
            const iconSpan = document.createElement('span');
            iconSpan.className = 'context-menu-icon';
            iconSpan.innerHTML = icon;
            menuItem.appendChild(iconSpan);
        }
        
        // Create text span
        const textSpan = document.createElement('span');
        textSpan.textContent = text;
        menuItem.appendChild(textSpan);
        
        // Wrap the original onClick handler to automatically remove the menu
        menuItem.addEventListener('click', (e) => {
            // Call the original handler
            onClick(e);
            
            // Automatically remove the context menu
            if (menu.parentNode) {
                menu.remove();
            }
        });
        
        menu.appendChild(menuItem);
        return menuItem;
    },

    addMenuSeparator(menu) {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        menu.appendChild(separator);
        return separator;
    },

    initDisplayOptions() {
        // Add step factor control
        const stepFactorInput = document.getElementById('step-factor');
        if (stepFactorInput) {
            // Set initial value
            stepFactorInput.value = camera.stepFactor;
            
            // Add event listener
            stepFactorInput.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value > 0) {
                    camera.stepFactor = value;
                }
            });
        }
    },

    // return the object that should be rendered as the "secondary" object, this is so that
    // you can see what you're working on when editing properties
    getSecondaryNode() {
        // Return the node being edited if there is one (original behavior)
        return this.secondaryNode;
    },

    // Add this new method to handle node movement
    moveNode(sourceNode, targetNode) {
        if (!sourceNode || !targetNode) return;
        
        // Check if the target can accept more children
        if (!targetNode.canAddMoreChildren()) {
            console.warn("Target node cannot accept more children");
            return;
        }
        
        // Check if target is not a descendant of source (would create circular reference)
        let current = targetNode;
        while (current) {
            if (current === sourceNode) {
                console.warn("Cannot move a node to its descendant");
                return;
            }
            current = current.parent;
        }
        
        // Remove the node from its current parent
        const originalParent = sourceNode.parent;
        if (originalParent) {
            originalParent.removeChild(sourceNode);
            originalParent.markDirty();
        }
        
        // Add the node to the target
        targetNode.addChild(sourceNode);
        targetNode.markDirty();
        
        // Reset the dragging state in the TreeView component
        this.treeViewComponent.draggingNode = null;
        this.treeViewComponent.dragOverNode = null;
        
        // Update the tree view - make sure this happens after all DOM operations
        setTimeout(() => {
            this.selectNode(sourceNode);
            this.renderTree();
        }, 0);
    },

    initViewToolbar() {
        // Get the view buttons
        const viewXYButton = document.getElementById('view-xy');
        const viewXZButton = document.getElementById('view-xz');
        const viewYZButton = document.getElementById('view-yz');
        
        if (!viewXYButton || !viewXZButton || !viewYZButton) return;
        
        // XY view (top view)
        viewXYButton.addEventListener('click', () => {
            // Set rotation matrix to look at XY plane (from above)
            camera.setStandardView(new Mat3(
                1, 0, 0,
                0, 1, 0,
                0, 0, -1  // Flip Z for right-handed system
            ));
        });
        
        // XZ view (front view)
        viewXZButton.addEventListener('click', () => {
            // Set rotation matrix to look at XZ plane (from front)
            camera.setStandardView(new Mat3(
                1, 0, 0,
                0, 0, -1, // Flip Z for right-handed system
                0, 1, 0
            ));
        });
        
        // YZ view (side view)
        viewYZButton.addEventListener('click', () => {
            // Set rotation matrix to look at YZ plane (from side)
            camera.setStandardView(new Mat3(
                0, 0, -1, // Flip Z for right-handed system
                0, 1, 0,
                1, 0, 0
            ));
        });

        // Get the rotation buttons
        const rotateCWButton = document.getElementById('rotate-cw');
        const rotateCCWButton = document.getElementById('rotate-ccw');

        if (rotateCWButton && rotateCCWButton) {
            // Clockwise rotation (negative angle)
            rotateCWButton.addEventListener('click', () => {
                camera.rotateAroundViewingDirection(-15);
            });
            
            // Counter-clockwise rotation (positive angle)
            rotateCCWButton.addEventListener('click', () => {
                camera.rotateAroundViewingDirection(15);
            });
        }
        
        // Add the toggle edges button functionality
        const toggleEdgesButton = document.getElementById('toggle-edges');
        if (toggleEdgesButton) {
            // Set initial state based on camera setting
            if (camera.showEdges) {
                toggleEdgesButton.classList.add('active');
            }
            
            // Add event listener
            toggleEdgesButton.addEventListener('click', () => {
                // Toggle the camera setting
                camera.showEdges = !camera.showEdges;
                
                // Update the button appearance
                if (camera.showEdges) {
                    toggleEdgesButton.classList.add('active');
                } else {
                    toggleEdgesButton.classList.remove('active');
                }
            });
        }
        
        // Add the field toggle button functionality
        const toggleFieldButton = document.getElementById('toggle-field');
        if (toggleFieldButton) {
            // Set initial state based on camera setting
            if (camera.showField) {
                toggleFieldButton.classList.add('active');
            }
            
            // Add event listener
            toggleFieldButton.addEventListener('click', () => {
                // Toggle the camera setting
                camera.showField = !camera.showField;
                
                // Update the button appearance
                if (camera.showField) {
                    toggleFieldButton.classList.add('active');
                } else {
                    toggleFieldButton.classList.remove('active');
                }
            });
        }

        // Add the steps visualization toggle button functionality
        const toggleStepsButton = document.getElementById('toggle-steps');
        if (toggleStepsButton) {
            // Set initial state based on camera setting
            if (camera.showSteps) {
                toggleStepsButton.classList.add('active');
            }
            
            // Add event listener
            toggleStepsButton.addEventListener('click', () => {
                // Toggle the camera setting
                camera.showSteps = !camera.showSteps;
                
                // Update the button appearance
                if (camera.showSteps) {
                    toggleStepsButton.classList.add('active');
                } else {
                    toggleStepsButton.classList.remove('active');
                }
            });
        }

        // Add the opacity slider functionality
        const opacitySlider = document.getElementById('opacity-slider');
        if (opacitySlider) {
            // Set initial value
            opacitySlider.value = camera.opacity;
            
            // Add event listener
            opacitySlider.addEventListener('input', (e) => {
                camera.opacity = parseFloat(e.target.value);
            });
        }

        // Initialize step factor slider
        const stepFactorSlider = document.getElementById('step-factor-slider');
        const stepFactorValue = document.getElementById('step-factor-value');

        // Update the value display and camera when the slider changes
        stepFactorSlider.addEventListener('input', function() {
            const value = parseFloat(this.value);
            stepFactorValue.textContent = value.toFixed(1);
            camera.stepFactor = value;
            app.coordinateSystemChanged();
        });

        // Initialize with default value
        stepFactorValue.textContent = stepFactorSlider.value;
        camera.stepFactor = parseFloat(stepFactorSlider.value);

        // Add help button functionality
        const helpButton = document.getElementById('help-button');
        const navigationHelp = document.getElementById('navigation-help');
        const closeHelp = document.getElementById('close-help');
        
        if (helpButton && navigationHelp && closeHelp) {
            helpButton.addEventListener('click', () => {
                navigationHelp.style.display = 'flex';
            });
            
            closeHelp.addEventListener('click', () => {
                navigationHelp.style.display = 'none';
            });
            
            // Close when clicking outside the popup content
            navigationHelp.addEventListener('click', (e) => {
                if (e.target === navigationHelp) {
                    navigationHelp.style.display = 'none';
                }
            });
            
            // Close with Escape key
            window.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && navigationHelp.style.display === 'flex') {
                    navigationHelp.style.display = 'none';
                }
            });
        }
    },

    createNewDocument() {
        if (confirm('Create a new document? Any unsaved changes will be lost.')) {
            // Create a new empty document
            const newDoc = new UnionNode([]);
            newDoc.setProperty('displayName', 'Document');
            
            // Update the application document
            app.document = newDoc;
            
            // Flush the undo stack
            app.flushUndoStack();
            
            // Update the UI
            app.document = newDoc;
            this.selectNode(newDoc);
            this.renderTree();
        }
    },

    openDocument() {
        // Open a file dialog to select an isoform file
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.isoform';
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target.result);
                        app.document = TreeNode.fromSerialized(json);
                        
                        // Flush the undo stack
                        app.flushUndoStack();
                        
                        this.selectNode(app.document);
                        this.renderTree();
                    } catch (error) {
                        console.error("Error loading document:", error);
                        alert("Error loading document. Please try again.");
                    }
                };
                reader.readAsText(file);
            }
        });
        fileInput.click();
    },

    saveDocument() {
        // Save the current document to a JSON file
        const json = JSON.stringify(app.document.serialize());
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // Create a download link
        const link = document.createElement('a');
        link.href = url;
        link.download = `${app.document.displayName}.isoform`;
        link.click();
    },

    moveNodeInDirection(node, direction) {
        if (!node || !node.parent) return;
        
        const parent = node.parent;
        const siblings = parent.children;
        const nodeIndex = siblings.indexOf(node);
        
        // Calculate target index based on direction
        const targetIndex = nodeIndex + direction;
        
        // Check bounds
        if (targetIndex < 0 || targetIndex >= siblings.length) return;
        
        // Swap with the target sibling
        const temp = siblings[nodeIndex];
        siblings[nodeIndex] = siblings[targetIndex];
        siblings[targetIndex] = temp;
        
        // Mark the parent as dirty to regenerate the shader
        parent.markDirty();
        
        this.selectNode(node);
        this.renderTree();
    },

    initSketchEditor() {
        this.sketchEditor = new SketchEditor(null, document.getElementById('canvas-container'));
        
        // Hide initially
        this.sketchEditor.close();
    },

    // Call this when a SketchNode is selected
    openSketchEditor(node) {
        if (node instanceof SketchNode) {
            this.sketchEditor.open(node);
        }
    },

    // Add this new method to handle STL export
    exportNodeAsSTL(node, binary = false) {
        // Show a loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = '<div class="spinner"></div><div>Generating mesh...</div>';
        document.body.appendChild(loadingIndicator);
        
        // Use setTimeout to allow the UI to update before starting the heavy computation
        setTimeout(() => {
            try {
                // Create a default filename based on the node's display name
                const nodeName = node.displayName || node.constructor.name;
                const filename = `${nodeName.replace(/\s+/g, '_')}.stl`;
                
                // Create mesher from the node with default options
                const mesher = Mesher.fromTreeNode(node);
                
                // Generate the mesh
                const mesh = mesher.generateMesh();
                
                // Export as STL
                if (binary) {
                    STL.exportBinary(mesh, filename);
                } else {
                    STL.export(mesh, filename);
                }
            } catch (error) {
                console.error("Error exporting STL:", error);
                alert(`Error exporting STL: ${error.message}`);
            } finally {
                // Remove the loading indicator
                loadingIndicator.remove();
            }
        }, 100);
    },

    // Add this new method to handle clipboard operations
    buildClipboardOptions(contextMenu, node) {
        // Add clipboard to the UI object if it doesn't exist
        if (!this.clipboard) {
            this.clipboard = null;
        }
        
        // Cut option (only for non-root nodes)
        if (node.parent) {
            this.addMenuItem(contextMenu, 'Cut', () => {
                this.clipboard = {
                    node: node,
                    operation: 'cut',
                    wasCollapsed: this.treeViewComponent.isCollapsed(node)
                };
                node.disable();
                this.treeViewComponent.collapseNode(node);
                this.renderTree();
            }, '✂️');
        }
        
        // Copy option
        this.addMenuItem(contextMenu, 'Copy', () => {
            this.clipboard = {
                node: node.clone(),
                operation: 'copy'
            };
        }, '📋');
        
        // Paste option (only if there's something in the clipboard and the node can accept more children)
        if (this.clipboard && node.canAddMoreChildren()) {
            this.addMenuItem(contextMenu, 'Paste', () => {
                this.pasteNode(this.clipboard, node);
            }, '📌');
        }
    },

    pasteNode(clipboard, targetNode) {
        if (!clipboard || !targetNode) return;
        
        let nodeToAdd;
        
        // Handle cut operation
        if (clipboard.operation === 'cut') {
            const sourceNode = clipboard.node;
            
            // Check if target is not a descendant of source (would create circular reference)
            let current = targetNode;
            while (current) {
                if (current === sourceNode) {
                    console.warn("Cannot move a node to its descendant");
                    return;
                }
                current = current.parent;
            }
            
            // Enable the node and restore expansion state
            sourceNode.enable();
            if (!clipboard.wasCollapsed) {
                this.treeViewComponent.expandNode(sourceNode);
            }
            
            // Remove from original parent
            const originalParent = sourceNode.parent;
            if (originalParent) {
                originalParent.removeChild(sourceNode);
            }
            
            // Use the original node
            nodeToAdd = sourceNode;
            
            // Turn the operation into a copy so that we can paste more
            this.clipboard.operation = 'copy';
        } 
        // Handle copy operation
        else {
            // Create a fresh clone for each paste operation
            nodeToAdd = clipboard.node.clone();
        }
        
        // Add the node to the target
        targetNode.addChild(nodeToAdd);
        
        // Now that the node is in the tree, set a unique name if it's a copy
        if (clipboard.operation === 'copy') {
            nodeToAdd.setUniqueName(app.document);
        }
        
        this.selectNode(nodeToAdd);
        this.renderTree();
    },

    // Helper function to check if a node exists in the tree
    nodeExistsInTree(node, rootNode) {
        if (!node || !rootNode) return false;
        
        // Check if the node is the root node
        if (node === rootNode) return true;
        
        // Recursively check all children
        for (const child of rootNode.children) {
            if (this.nodeExistsInTree(node, child)) {
                return true;
            }
        }
        
        return false;
    },
};

document.addEventListener('DOMContentLoaded', function() {
    const resizeHandle = document.getElementById('vertical-resize-handle');
    const treeViewContainer = document.getElementById('tree-view-container');
    const propertyEditorContainer = document.getElementById('property-editor-container');
    let isResizing = false;

    resizeHandle.addEventListener('mousedown', function(e) {
        isResizing = true;
        document.body.style.cursor = 'ns-resize';
    });

    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        const totalHeight = treeViewContainer.offsetHeight + propertyEditorContainer.offsetHeight;
        const newTreeHeight = e.clientY - treeViewContainer.getBoundingClientRect().top;
        const newPropertyHeight = totalHeight - newTreeHeight;

        if (newTreeHeight > 50 && newPropertyHeight > 50) { // Minimum height for each section
            treeViewContainer.style.flex = `0 0 ${newTreeHeight}px`;
            propertyEditorContainer.style.flex = `0 0 ${newPropertyHeight}px`;
        }
    });

    document.addEventListener('mouseup', function() {
        isResizing = false;
        document.body.style.cursor = 'default';
    });
});