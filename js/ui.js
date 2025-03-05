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
        
        // Initial render of the tree
        this.renderTree();
    },
    
    renderTree() {
        if (!this.document || !this.treeView) return;
        
        // Clear the tree view
        this.treeView.innerHTML = '';
        
        // Create the tree structure
        const treeRoot = this.createTreeNode(this.document, 0);
        this.treeView.appendChild(treeRoot);
    },
    
    createTreeNode(node, level) {
        const container = document.createElement('div');
        container.className = 'tree-node';
        
        // Create the node label container with toggle and label
        const labelContainer = document.createElement('div');
        labelContainer.className = 'tree-node-label-container';
        
        // Add connection lines
        if (level > 0) {
            const lineContainer = document.createElement('div');
            lineContainer.className = 'tree-line-container';
            
            // Add horizontal line
            const hLine = document.createElement('div');
            hLine.className = 'tree-h-line';
            
            // Add vertical line if not the last child
            if (node.parent && node !== node.parent.children[node.parent.children.length - 1]) {
                const vLine = document.createElement('div');
                vLine.className = 'tree-v-line';
                lineContainer.appendChild(vLine);
            }
            
            lineContainer.appendChild(hLine);
            labelContainer.appendChild(lineContainer);
        }
        
        // Create toggle button for collapsing/expanding if node has children
        const hasChildren = node.children && node.children.length > 0;
        const toggleBtn = document.createElement('div');
        toggleBtn.className = hasChildren ? 'tree-toggle' : 'tree-toggle-placeholder';
        toggleBtn.innerHTML = hasChildren ? '▼' : '&nbsp;';
        labelContainer.appendChild(toggleBtn);
        
        // Create the node label
        const label = document.createElement('div');
        label.className = 'tree-node-label';
        label.textContent = node.name;
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
            
            node.children.forEach(child => {
                // Set parent reference for connection lines
                child.parent = node;
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
        
        // Get the properties for this node
        const properties = this.selectedNode.properties();
        
        // Create form elements for each property
        for (const [propName, propType] of Object.entries(properties)) {
            const propValue = this.selectedNode.getProperty(propName);
            
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
                    this.updateScene();
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
                        this.updateScene();
                    });
                    
                    input.appendChild(componentInput);
                });
            }
            
            propContainer.appendChild(input);
            this.propertyEditor.appendChild(propContainer);
        }
    },
    
    updateScene() {
        // Trigger scene update and shader recompilation
        if (app && app.updateScene) {
            app.updateScene();
        }
    }
}; 