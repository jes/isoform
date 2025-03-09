class TreeView {
    constructor(container, options = {}) {
        this.container = container;
        this.options = Object.assign({
            onNodeSelected: null,
            onNodeContextMenu: null,
            onTreeUpdated: null
        }, options);
        
        this.selectedNode = null;
        this.collapsedNodeIds = new Set();
        this.scrollPosition = 0;
    }
    
    render(rootNode) {
        if (!rootNode || !this.container) return;
        
        // Save scroll position before rebuilding
        this.scrollPosition = this.container.scrollTop;
        
        // Clear the tree view
        this.container.innerHTML = '';
        
        // Create the tree structure
        const treeRoot = this.createTreeNode(rootNode, 0, rootNode.isDisabled);
        this.container.appendChild(treeRoot);

        // Restore scroll position and adjust tree lines
        setTimeout(() => {
            this.container.scrollTop = this.scrollPosition;
            this.adjustTreeLines();
            
            // Restore selection if the selected node still exists
            if (this.selectedNode) {
                const nodeLabel = this.container.querySelector(`.tree-node-label[data-node-id="${this.selectedNode.uniqueId}"]`);
                if (nodeLabel) {
                    nodeLabel.classList.add('selected');
                    this.highlightChildNodes(this.selectedNode, true);
                }
            }
        }, 0);
        
        // Notify that the tree has been updated
        if (this.options.onTreeUpdated) {
            this.options.onTreeUpdated();
        }
    }
    
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
            const selectedLabels = this.container.querySelectorAll('.tree-node-label.selected');
            selectedLabels.forEach(el => el.classList.remove('selected'));
            
            // Remove child highlight from all nodes
            const childHighlightLabels = this.container.querySelectorAll('.tree-node-label.child-of-selected');
            childHighlightLabels.forEach(el => el.classList.remove('child-of-selected'));
            
            // Add selected class to this node
            label.classList.add('selected');
            
            // Highlight all children of this node
            this.highlightChildNodes(node, true);
            
            // Update the selected node
            this.selectedNode = node;
            
            // Call the onNodeSelected callback if provided
            if (this.options.onNodeSelected) {
                this.options.onNodeSelected(node);
            }
        });
        
        // Add context menu functionality
        labelContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            
            // Also select the node on right-click
            const selectedLabels = this.container.querySelectorAll('.tree-node-label.selected');
            selectedLabels.forEach(el => el.classList.remove('selected'));
            
            // Remove child highlight from all nodes
            const childHighlightLabels = this.container.querySelectorAll('.tree-node-label.child-of-selected');
            childHighlightLabels.forEach(el => el.classList.remove('child-of-selected'));
            
            label.classList.add('selected');
            this.selectedNode = node;
            
            // Highlight all children of this node
            this.highlightChildNodes(node, true);
            
            // Call the onNodeContextMenu callback if provided
            if (this.options.onNodeContextMenu) {
                this.options.onNodeContextMenu(e, node);
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
    }
    
    adjustTreeLines() {
        // Find all tree-children elements
        const treeChildrenElements = this.container.querySelectorAll('.tree-children');
        
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
    }
    
    highlightChildNodes(node, highlight = true) {
        if (!node || !node.children || node.children.length === 0) return;
        
        // Process each child recursively
        const processChildren = (currentNode) => {
            if (!currentNode.children) return;
            
            currentNode.children.forEach(child => {
                // Find the DOM element for this child
                const childLabel = this.container.querySelector(`.tree-node-label[data-node-id="${child.uniqueId}"]`);
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
    }
    
    updateNodeLabel(node) {
        if (!node || !node.uniqueId) return;
        
        // Find the tree node label that corresponds to the node
        const nodeLabel = this.container.querySelector(`.tree-node-label[data-node-id="${node.uniqueId}"]`);
        if (nodeLabel) {
            // Update just the label text without rebuilding the entire tree
            nodeLabel.textContent = node.displayName;
            
            // Update disabled state if needed
            if (node.isDisabled === true) {
                nodeLabel.style.textDecoration = 'line-through';
                nodeLabel.style.opacity = '0.7';
            } else {
                nodeLabel.style.textDecoration = '';
                nodeLabel.style.opacity = '';
            }
        }
    }
    
    getSelectedNode() {
        return this.selectedNode;
    }
    
    setSelectedNode(node) {
        this.selectedNode = node;
        
        // Update the UI to reflect the selection
        const nodeLabel = this.container.querySelector(`.tree-node-label[data-node-id="${node.uniqueId}"]`);
        if (nodeLabel) {
            // Remove selected class from all nodes
            const selectedLabels = this.container.querySelectorAll('.tree-node-label.selected');
            selectedLabels.forEach(el => el.classList.remove('selected'));
            
            // Remove child highlight from all nodes
            const childHighlightLabels = this.container.querySelectorAll('.tree-node-label.child-of-selected');
            childHighlightLabels.forEach(el => el.classList.remove('child-of-selected'));
            
            // Add selected class to this node
            nodeLabel.classList.add('selected');
            
            // Highlight all children of this node
            this.highlightChildNodes(node, true);
        }
    }
}

// Export the TreeView class
(function() {
    const nodes = { TreeView };
    
    // Check if we're in a module environment
    if (typeof exports !== 'undefined') {
        // Node.js or ES modules environment
        if (typeof module !== 'undefined' && module.exports) {
        // CommonJS (Node.js)
        Object.assign(module.exports, nodes);
        } else {
        // ES modules
        Object.keys(nodes).forEach(key => {
            exports[key] = nodes[key];
        });
        }
    } else if (typeof window !== 'undefined') {
        // Browser environment with script tags
        Object.keys(nodes).forEach(key => {
        window[key] = nodes[key];
        });
    }
})();
