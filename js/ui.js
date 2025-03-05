// UI management for tree view and property editor
const ui = {
    treeView: null,
    propertyEditor: null,
    selectedNode: null,
    document: null,
    
    init(doc) {
        this.document = doc;
        this.treeView = document.getElementById('tree-view');
        this.propertyEditor = document.getElementById('property-editor');
        
        // Initialize resize functionality
        this.initResizeHandle();
        
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
        
        // Clear the tree view
        this.treeView.innerHTML = '';
        
        // Create the tree structure
        const treeRoot = this.createTreeNode(this.document, 0);
        this.treeView.appendChild(treeRoot);

        // Adjust the tree lines after rendering
        setTimeout(() => this.adjustTreeLines(), 0);
    },
    
    createTreeNode(node, level) {
        const container = document.createElement('div');
        container.className = 'tree-node';
        
        // Create the node label container with toggle and label
        const labelContainer = document.createElement('div');
        labelContainer.className = 'tree-node-label-container';
        
        // Create toggle button for collapsing/expanding if node has children
        const hasChildren = node.children && node.children.length > 0;
        const toggleBtn = document.createElement('div');
        toggleBtn.className = hasChildren ? 'tree-toggle' : 'tree-toggle-placeholder';
        toggleBtn.innerHTML = hasChildren ? '▼' : '&nbsp;';
        labelContainer.appendChild(toggleBtn);
        
        // Create the node label
        const label = document.createElement('div');
        label.className = 'tree-node-label';
        label.textContent = node.friendlyName;
        label.dataset.nodeId = node.uniqueId || Math.random().toString(36).substr(2, 9);
        labelContainer.appendChild(label);
        
        container.appendChild(labelContainer);
        
        // Add click handler to select the node
        label.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Remove selected class from all nodes
            const selectedLabels = document.querySelectorAll('.tree-node-label.selected');
            selectedLabels.forEach(el => el.classList.remove('selected'));
            
            // Add selected class to this node
            label.classList.add('selected');
            
            // Update the property editor
            this.selectedNode = node;
            this.renderPropertyEditor();
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
                    
                    // Recalculate line heights when expanding
                    setTimeout(() => this.adjustTreeLines(), 0);
                } else {
                    toggleBtn.innerHTML = '►';
                    childrenContainer.style.display = 'none';
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
                const childNode = this.createTreeNode(child, level + 1);
                childrenContainer.appendChild(childNode);
            });
            
            container.appendChild(childrenContainer);
        }
        
        return container;
    },
    
    renderPropertyEditor() {
        if (!this.selectedNode || !this.propertyEditor) return;
        
        // Clear the property editor
        this.propertyEditor.innerHTML = '';
        
        // Get the generic properties first (if the method exists)
        const genericProperties = this.selectedNode.genericProperties ? this.selectedNode.genericProperties() : {};
        
        // Get the specific properties for this node
        const specificProperties = this.selectedNode.properties();
        
        // Create form elements for generic properties first
        if (Object.keys(genericProperties).length > 0) {
            for (const [propName, propType] of Object.entries(genericProperties)) {
                const propValue = this.selectedNode.getProperty(propName);
                this.createPropertyInput(propName, propType, propValue);
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
            this.createPropertyInput(propName, propType, propValue);
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
            input.type = 'number';
            input.step = '0.1';
            input.value = propValue;
            
            input.addEventListener('change', () => {
                this.selectedNode.setProperty(propName, parseFloat(input.value));
                // Update tree if needed (e.g., if this property affects visual representation)
                this.updateTreeIfNeeded(propName);
            });
        } 
        else if (propType === 'string') {
            input = document.createElement('input');
            input.type = 'text';
            input.value = propValue || '';
            
            input.addEventListener('change', () => {
                this.selectedNode.setProperty(propName, input.value);
                // Update tree if needed (e.g., if this property affects visual representation)
                this.updateTreeIfNeeded(propName);
            });
        }
        else if (propType === 'vec3') {
            // Create a container for the vector inputs
            input = document.createElement('div');
            input.className = 'vector-input';
            
            // Create inputs for each component
            ['x', 'y', 'z'].forEach((component, index) => {
                const componentInput = document.createElement('input');
                componentInput.type = 'number';
                componentInput.step = '0.1';
                componentInput.value = propValue[index];
                componentInput.placeholder = component;
                
                componentInput.addEventListener('change', () => {
                    const newValue = [...propValue];
                    newValue[index] = parseFloat(componentInput.value);
                    this.selectedNode.setProperty(propName, newValue);
                    // Update tree if needed
                    this.updateTreeIfNeeded(propName);
                });
                
                input.appendChild(componentInput);
            });
        }
        
        propContainer.appendChild(input);
        this.propertyEditor.appendChild(propContainer);
    },
    
    updateTreeIfNeeded(propName) {
        // Check if the property that changed requires a tree update
        if (propName === 'friendlyName') {
            // Find the tree node label that corresponds to the selected node
            const nodeLabel = document.querySelector(`.tree-node-label[data-node-id="${this.selectedNode.uniqueId}"]`);
            if (nodeLabel) {
                // Update just the label text without rebuilding the entire tree
                nodeLabel.textContent = this.selectedNode.friendlyName;
            } else {
                // If we can't find the specific node, rebuild the entire tree
                this.renderTree();
            }
        }
        
        // Add other properties that might require tree updates here
        // For example, if changing a property affects the hierarchy
        // or visibility of nodes, you might need to call renderTree()
    }
}; 