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