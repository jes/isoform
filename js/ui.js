// UI management for tree view and property editor
const ui = {
    treeView: null,
    propertyEditor: null,
    selectedNode: null,
    document: null,
    collapsedNodeIds: new Set(),
    scrollPosition: 0,
    
    init(doc) {
        this.document = doc;
        this.treeView = document.getElementById('tree-view');
        this.propertyEditor = document.getElementById('property-editor');
        
        // Initialize resize functionality
        this.initResizeHandle();
        
        // Initialize display options
        this.initDisplayOptions();
        
        // Initial render of the tree
        this.renderTree();
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
        if (!this.document || !this.treeView) return;
        
        // Save scroll position before rebuilding
        this.scrollPosition = this.treeView.scrollTop;
        
        // Clear the tree view
        this.treeView.innerHTML = '';
        
        // Create the tree structure
        const treeRoot = this.createTreeNode(this.document, 0, this.document.isDisabled);
        this.treeView.appendChild(treeRoot);

        // Restore scroll position and adjust tree lines
        setTimeout(() => {
            this.treeView.scrollTop = this.scrollPosition;
            this.adjustTreeLines();
            
            // Restore selection if the selected node still exists
            if (this.selectedNode) {
                const nodeLabel = document.querySelector(`.tree-node-label[data-node-id="${this.selectedNode.uniqueId}"]`);
                if (nodeLabel) {
                    nodeLabel.classList.add('selected');
                    this.highlightChildNodes(this.selectedNode, true);
                }
            }
        }, 0);
    },
    
    createTreeNode(node, level, disabledParent = false) {
        const container = document.createElement('div');
        container.className = 'tree-node';
        
        // Create the node label container with toggle and label
        const labelContainer = document.createElement('div');
        labelContainer.className = 'tree-node-label-container';
        
        // Create toggle button for collapsing/expanding if node has children
        const hasChildren = node.children && node.children.length > 0;
        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'tree-toggle';
        // Check if this node was previously collapsed
        if (this.collapsedNodeIds.has(node.uniqueId)) {
            toggleBtn.innerHTML = '►';
        } else {
            toggleBtn.innerHTML = '▼';
        }
        labelContainer.appendChild(toggleBtn);
        
        // Create node icon
        const nodeIcon = document.createElement('span');
        nodeIcon.className = 'tree-node-icon';
        nodeIcon.innerHTML = node.getIcon ? node.getIcon() : '📄';
        labelContainer.appendChild(nodeIcon);

        // Create the node label
        const label = document.createElement('div');
        label.className = 'tree-node-label';
        label.textContent = node.displayName;
        label.dataset.nodeId = node.uniqueId || Math.random().toString(36).substr(2, 9);
        
        // Add strikethrough style if node is disabled
        if (node.isDisabled === true) {
            label.style.textDecoration = 'line-through';
            label.style.opacity = '0.7';
        }
        
        // Add greyed out style if any parent is disabled (without strikethrough)
        if (disabledParent) {
            label.style.opacity = '0.5';
        }
        
        labelContainer.appendChild(label);
        container.appendChild(labelContainer);
        
        // Add click handler to select the node
        label.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Remove selected class from all nodes
            const selectedLabels = document.querySelectorAll('.tree-node-label.selected');
            selectedLabels.forEach(el => el.classList.remove('selected'));
            
            // Remove child highlight from all nodes
            const childHighlightLabels = document.querySelectorAll('.tree-node-label.child-of-selected');
            childHighlightLabels.forEach(el => el.classList.remove('child-of-selected'));
            
            // Add selected class to this node
            label.classList.add('selected');
            
            // Highlight all children of this node
            this.highlightChildNodes(node, true);
            
            // Update the property editor
            this.selectedNode = node;
            this.renderPropertyEditor();
        });
        
        // Add context menu functionality
        labelContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, node);
            
            // Also select the node on right-click
            const selectedLabels = document.querySelectorAll('.tree-node-label.selected');
            selectedLabels.forEach(el => el.classList.remove('selected'));
            
            // Remove child highlight from all nodes
            const childHighlightLabels = document.querySelectorAll('.tree-node-label.child-of-selected');
            childHighlightLabels.forEach(el => el.classList.remove('child-of-selected'));
            
            label.classList.add('selected');
            this.selectedNode = node;
            
            // Highlight all children of this node
            this.highlightChildNodes(node, true);
            
            // Mark the document as dirty to regenerate the shader
            if (app.document) {
                app.document.markDirty();
            }
        });
        
        // Add toggle functionality
        if (hasChildren) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const childrenContainer = container.querySelector('.tree-children');
                const isCollapsed = toggleBtn.innerHTML === '►';
                
                // Toggle the children visibility
                if (isCollapsed) {
                    toggleBtn.innerHTML = '▼';
                    childrenContainer.style.display = 'block';
                    // Remove from collapsed set
                    this.collapsedNodeIds.delete(node.uniqueId);
                    
                    // Recalculate line heights when expanding
                    setTimeout(() => this.adjustTreeLines(), 0);
                } else {
                    toggleBtn.innerHTML = '►';
                    childrenContainer.style.display = 'none';
                    // Add to collapsed set
                    this.collapsedNodeIds.add(node.uniqueId);
                }
            });
        }
        
        // Recursively add children
        if (hasChildren) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            
            node.children.forEach((child, index) => {
                // Set parent reference for connection lines
                child.parent = node;
                child.isLastChild = index === node.children.length - 1;
                const childNode = this.createTreeNode(child, level + 1, disabledParent || node.isDisabled);
                childrenContainer.appendChild(childNode);
            });
            
            container.appendChild(childrenContainer);
            
            // Apply collapsed state if needed
            if (this.collapsedNodeIds.has(node.uniqueId)) {
                childrenContainer.style.display = 'none';
            }
        }
        
        return container;
    },
    
    renderPropertyEditor() {
        if (!this.selectedNode || !this.propertyEditor) return;
        
        // Clear the property editor
        this.propertyEditor.innerHTML = '';
        
        // Add a heading showing the node type
        const nodeTypeHeading = document.createElement('h3');
        nodeTypeHeading.className = 'node-type-heading';
        nodeTypeHeading.textContent = (this.selectedNode.name || 'Unknown Node') + ' (' + this.selectedNode.getExactness() + ')';
        this.propertyEditor.appendChild(nodeTypeHeading);
        
        // Get the generic properties first (if the method exists)
        const genericProperties = this.selectedNode.genericProperties ? this.selectedNode.genericProperties() : {};
        
        // Get the specific properties for this node
        const specificProperties = this.selectedNode.properties();
        
        // Track the first input element to focus it later
        let firstInput = null;
        
        // Create form elements for generic properties first
        if (Object.keys(genericProperties).length > 0) {
            for (const [propName, propType] of Object.entries(genericProperties)) {
                const propValue = this.selectedNode.getProperty(propName);
                const input = this.createPropertyInput(propName, propType, propValue);
                
                // Store the first input element we create
                if (!firstInput && input && (input.tagName === 'INPUT' || input.querySelector('input'))) {
                    firstInput = input.tagName === 'INPUT' ? input : input.querySelector('input');
                }
            }
            
            // Add a separator if we have both generic and specific properties
            if (Object.keys(specificProperties).length > 0) {
                const separator = document.createElement('hr');
                separator.className = 'property-separator';
                this.propertyEditor.appendChild(separator);
            }
        }
        
        // Create form elements for specific properties
        for (const [propName, propType] of Object.entries(specificProperties)) {
            const propValue = this.selectedNode.getProperty(propName);
            const input = this.createPropertyInput(propName, propType, propValue);
            
            // Store the first input element if we haven't found one yet
            if (!firstInput && input && (input.tagName === 'INPUT' || input.querySelector('input'))) {
                firstInput = input.tagName === 'INPUT' ? input : input.querySelector('input');
            }
        }
        
        // Focus the first input element if one exists
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 0);
        }
    },

    createPropertyInput(propName, propType, propValue) {
        const propContainer = document.createElement('div');
        propContainer.className = 'property-item';
        
        const propLabel = document.createElement('label');
        propLabel.textContent = propName;
        propContainer.appendChild(propLabel);
        
        // Create appropriate input based on property type
        let input;
        
        if (propType === 'float') {
            input = document.createElement('input');
            input.type = 'text'; // Changed from 'number' to 'text' to allow expressions
            input.value = propValue;
            
            // Handle both blur and Enter key for evaluation
            const evaluateAndUpdate = () => {
                try {
                    const result = this.evaluateExpression(input.value);
                    if (!isNaN(result)) {
                        input.value = result; // Update the input with the evaluated result
                        this.selectedNode.setProperty(propName, result);
                        this.updateTreeIfNeeded(propName);
                        this.updateNodeTypeHeading(); // Update heading to reflect new exactness
                    }
                } catch (e) {
                    console.warn('Error evaluating expression:', e);
                }
            };
            
            input.addEventListener('blur', evaluateAndUpdate);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    evaluateAndUpdate();
                }
            });
        } 
        else if (propType === 'bool') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = propValue === true;
            
            input.addEventListener('change', () => {
                this.selectedNode.setProperty(propName, input.checked);
                this.updateTreeIfNeeded(propName);
                this.updateNodeTypeHeading(); // Update heading to reflect new exactness
            });
            
            // Adjust styling for checkbox
            propContainer.style.display = 'flex';
            propContainer.style.alignItems = 'center';
            propLabel.style.marginRight = 'auto';
        }
        else if (propType === 'string') {
            input = document.createElement('input');
            input.type = 'text';
            input.value = propValue || '';
            
            input.addEventListener('change', () => {
                this.selectedNode.setProperty(propName, input.value);
                this.updateTreeIfNeeded(propName);
                this.updateNodeTypeHeading(); // Update heading to reflect new exactness
            });
        }
        else if (propType === 'vec3') {
            // Create a container for the vector inputs
            input = document.createElement('div');
            input.className = 'vector-input';
            input.style.display = 'flex';
            input.style.flexDirection = 'column';
            input.style.gap = '4px';
            
            // Create inputs for each component
            ['x', 'y', 'z'].forEach((component, index) => {
                const componentContainer = document.createElement('div');
                componentContainer.style.display = 'flex';
                componentContainer.style.alignItems = 'center';
                
                const componentInput = document.createElement('input');
                componentInput.type = 'text'; // Changed from 'number' to 'text' to allow expressions
                componentInput.value = propValue[index];
                componentInput.style.flex = '1';
                
                // Add more subtle, professional colored borders for each component (red, green, blue)
                const colors = ['rgba(220, 53, 69, 0.5)', 'rgba(40, 167, 69, 0.5)', 'rgba(0, 123, 255, 0.5)']; // Muted red, green, blue
                componentInput.style.borderColor = colors[index];
                componentInput.style.borderWidth = '1px';
                
                // Handle both blur and Enter key for evaluation
                const evaluateAndUpdate = () => {
                    try {
                        const result = this.evaluateExpression(componentInput.value);
                        if (!isNaN(result)) {
                            componentInput.value = result; // Update the input with the evaluated result
                            const newValue = [...this.selectedNode.getProperty(propName)];
                            newValue[index] = result;
                            this.selectedNode.setProperty(propName, newValue);
                            this.updateTreeIfNeeded(propName);
                            this.updateNodeTypeHeading(); // Update heading to reflect new exactness
                        }
                    } catch (e) {
                        console.warn('Error evaluating expression:', e);
                    }
                };
                
                componentInput.addEventListener('blur', evaluateAndUpdate);
                componentInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        evaluateAndUpdate();
                    }
                });
                
                componentContainer.appendChild(componentInput);
                input.appendChild(componentContainer);
            });
        }
        
        propContainer.appendChild(input);
        this.propertyEditor.appendChild(propContainer);
        
        // Return the input element so we can focus it if needed
        return input;
    },
    
    updateTreeIfNeeded(propName) {
        // Check if the property that changed requires a tree update
        if (propName === 'displayName') {
            // Find the tree node label that corresponds to the selected node
            const nodeLabel = document.querySelector(`.tree-node-label[data-node-id="${this.selectedNode.uniqueId}"]`);
            if (nodeLabel) {
                // Update just the label text without rebuilding the entire tree
                nodeLabel.textContent = this.selectedNode.displayName;
            } else {
                // If we can't find the specific node, rebuild the entire tree
                this.renderTree();
            }
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
       
        // Update the tree view
        this.renderTree();
        
        // Only set selectedNode to transformNode if it's a TreeNode instance
        // Otherwise set it to null
        this.selectedNode = transformNode instanceof TreeNode ? transformNode : null;
        this.renderPropertyEditor();
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
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.top = `${event.clientY}px`;

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
        if (node.parent && (node.children.length == 1 || (node.children.length > 1 && node.parent.canAddMoreChildren()))) {
            this.addMenuItem(contextMenu, 'Delete this', () => {
                this.replaceNode(node, node.children);
                contextMenu.remove();
                this.renderTree();
            });
        }
        
        if (node.children.length > 0) {
            this.addMenuItem(contextMenu, 'Delete children', () => {
                // Create a copy of the children array to avoid modification issues during iteration
                const childrenToDelete = [...node.children];
                childrenToDelete.forEach(child => child.delete());
                contextMenu.remove();
                this.renderTree();
            });
        } else if (node.parent) { // Only allow deleting non-root nodes
            this.addMenuItem(contextMenu, 'Delete this', () => {
                node.delete();
                contextMenu.remove();
                this.renderTree();
            });
        }

        if (node.parent && node.children.length > 0) {
            this.addMenuItem(contextMenu, 'Delete with children', () => {
                node.delete();
                contextMenu.remove();
                this.renderTree();
            });
        }
        
        // Add the menu to the document
        document.body.appendChild(contextMenu);
        
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

    buildCombinatorOptions(contextMenu, node) {
        // Add transformation options
        this.addMenuItem(contextMenu, 'Union', () => {
            this.replaceNode(node, new UnionNode(), true);
            contextMenu.remove();
        });

        this.addMenuItem(contextMenu, 'Intersection', () => {
            this.replaceNode(node, new IntersectionNode(), true);
            contextMenu.remove();
        });
        
        this.addMenuItem(contextMenu, 'Subtraction', () => {
            this.replaceNode(node, new SubtractionNode(), true);
            contextMenu.remove();
        });
    },

    buildModifierOptions(contextMenu, node) {
        // Add transformation options
        this.addMenuItem(contextMenu, 'Transform', () => {
            this.replaceNode(node, new TransformNode(), true);
            contextMenu.remove();
        });

        this.addMenuItem(contextMenu, 'Scale', () => {
            this.replaceNode(node, new ScaleNode(), true);
            contextMenu.remove();
        });
        
        this.addMenuItem(contextMenu, 'Roughen', () => {
            this.replaceNode(node, new RoughnessNode(), true);
            contextMenu.remove();
        });
    },

    buildPrimitiveOptions(contextMenu, node) {
        // Add shape creation options
        const shapes = [
            { name: 'Box', constructor: BoxNode },
            { name: 'Sphere', constructor: SphereNode },
            { name: 'Cylinder', constructor: CylinderNode },
            { name: 'Torus', constructor: TorusNode }
        ];
        
        shapes.forEach(shape => {
            this.addMenuItem(contextMenu, `Add ${shape.name}`, () => {
                const newNode = new shape.constructor();
                node.addChild(newNode);
                contextMenu.remove();
                this.renderTree();
                // Select the newly added node
                this.selectedNode = newNode;
                this.renderPropertyEditor();
            });
        });
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
            contextMenu.remove();
            this.renderTree();
        });
    },

    addMenuItem(menu, text, onClick) {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        menuItem.textContent = text;
        menuItem.addEventListener('click', onClick);
        menu.appendChild(menuItem);
        return menuItem;
    },

    addMenuSeparator(menu) {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        menu.appendChild(separator);
        return separator;
    },

    highlightChildNodes(node, highlight = true) {
        if (!node || !node.children || node.children.length === 0) return;
        
        // Process each child recursively
        const processChildren = (currentNode) => {
            if (!currentNode.children) return;
            
            currentNode.children.forEach(child => {
                // Find the DOM element for this child
                const childLabel = document.querySelector(`.tree-node-label[data-node-id="${child.uniqueId}"]`);
                if (childLabel) {
                    if (highlight) {
                        childLabel.classList.add('child-of-selected');
                    } else {
                        childLabel.classList.remove('child-of-selected');
                    }
                }
                
                // Process this child's children recursively
                processChildren(child);
            });
        };
        
        processChildren(node);
    },

    initDisplayOptions() {
        const showEdgesCheckbox = document.getElementById('show-edges');
        if (showEdgesCheckbox) {
            // Set initial state based on camera setting
            showEdgesCheckbox.checked = camera.showEdges;
            
            // Add event listener
            showEdgesCheckbox.addEventListener('change', (e) => {
                camera.showEdges = e.target.checked;
            });
        }
    },

    // return the object that should be rendered as the "secondary" object, this is so that
    // you can see what you're working on when editing properties
    getSecondaryNode() {
        // Check if any property input is currently focused
        const activeElement = document.activeElement;
        const propertyEditor = document.getElementById('property-editor');
        
        // Only return the selected node if a property input within the property editor is focused
        if (propertyEditor && 
            activeElement && 
            (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT') && 
            propertyEditor.contains(activeElement)) {
            return this.selectedNode;
        }
        
        // Otherwise return null
        return null;
    },

    // Add this function to the ui object to evaluate arithmetic expressions
    evaluateExpression(expression) {
        try {
            // Replace common math functions with their JavaScript equivalents
            const preparedExpression = expression
                .replace(/sin\(/g, 'Math.sin(')
                .replace(/cos\(/g, 'Math.cos(')
                .replace(/tan\(/g, 'Math.tan(')
                .replace(/sqrt\(/g, 'Math.sqrt(')
                .replace(/abs\(/g, 'Math.abs(')
                .replace(/pow\(/g, 'Math.pow(')
                .replace(/PI/g, 'Math.PI')
                .replace(/E/g, 'Math.E');
            
            // Evaluate the expression
            return Function(`"use strict"; return (${preparedExpression});`)();
        } catch (error) {
            console.warn('Invalid expression:', expression, error);
            return NaN;
        }
    },

    // Add this new method to update the node type heading
    updateNodeTypeHeading() {
        if (!this.selectedNode || !this.propertyEditor) return;
        
        // Find the existing heading
        const nodeTypeHeading = this.propertyEditor.querySelector('.node-type-heading');
        if (nodeTypeHeading) {
            // Update the heading text with the current exactness
            nodeTypeHeading.textContent = (this.selectedNode.name || 'Unknown Node') + ' (' + this.selectedNode.getExactness() + ')';
        }
    },
}; 