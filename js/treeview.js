class TreeView {
    constructor(container, options = {}) {
        this.container = container;
        this.options = Object.assign({
            onNodeSelected: null,
            onNodeContextMenu: null,
            onTreeUpdated: null,
            onNodeDragStart: null,
            onNodeDragEnd: null,
            onNodeDrop: null
        }, options);
        
        this.selectedNode = null;
        this.preselectedNode = null;
        this.collapsedNodeIds = new Set();
        this.scrollPosition = 0;
        this.draggingNode = null;
        this.dragOverNode = null;
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
                const nodeLabels = this.container.querySelectorAll(`.tree-node-label[data-node-id="${this.selectedNode.surfaceId}"]`);
                nodeLabels.forEach(nodeLabel => {
                    nodeLabel.classList.add('selected');
                });
                this.highlightChildNodes(this.selectedNode, true);
            }
        }, 0);
        
        // Notify that the tree has been updated
        if (this.options.onTreeUpdated) {
            this.options.onTreeUpdated();
        }
    }
    
    createTreeNode(node, level, disabledParent = false) {
        // Don't skip rendering the dragging node, but style it differently
        const container = document.createElement('div');
        container.className = 'tree-node';
        
        // If this is the node being dragged, add a special class
        if (this.draggingNode === node) {
            container.classList.add('dragging-node');
        }
        
        // Create the node label container with toggle and label
        const labelContainer = document.createElement('div');
        labelContainer.className = 'tree-node-label-container';
        
        // If this is the dragging node, add the dragging class
        if (this.draggingNode === node) {
            labelContainer.classList.add('dragging');
        }
        
        // Check if node has children or blends
        const hasChildren = (node.children && node.children.length > 0) || 
                            (node.blends && node.blends.length > 0);
        
        // Create toggle button for collapsing/expanding if node has children or blends
        const toggleBtn = document.createElement('div');
        toggleBtn.className = 'tree-toggle';
        // Check if this node was previously collapsed
        if (this.collapsedNodeIds.has(node.surfaceId)) {
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
        label.dataset.nodeId = node.surfaceId || Math.random().toString(36).substr(2, 9);
        
        // Add preselected styling if this is the preselected node
        if (this.preselectedNode === node) {
            label.classList.add('preselected');
        }
        
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
        
        // Add drag and drop functionality
        this.setupDragAndDrop(labelContainer, node);
        
        // Add click handler to select the node
        label.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Remove selected class from all nodes
            const selectedLabels = this.container.querySelectorAll('.tree-node-label.selected');
            selectedLabels.forEach(el => el.classList.remove('selected'));
            
            // Remove child highlight from all nodes
            const childHighlightLabels = this.container.querySelectorAll('.tree-node-label.child-of-selected');
            childHighlightLabels.forEach(el => el.classList.remove('child-of-selected'));
            
            // Add selected class to all instances of this node
            const nodeLabels = this.container.querySelectorAll(`.tree-node-label[data-node-id="${node.surfaceId}"]`);
            nodeLabels.forEach(nodeLabel => {
                nodeLabel.classList.add('selected');
            });
            
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
            
            // Add selected class to all instances of this node
            const nodeLabels = this.container.querySelectorAll(`.tree-node-label[data-node-id="${node.surfaceId}"]`);
            nodeLabels.forEach(nodeLabel => {
                nodeLabel.classList.add('selected');
            });
            
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
                    this.collapsedNodeIds.delete(node.surfaceId);
                    
                    // Recalculate line heights when expanding
                    setTimeout(() => this.adjustTreeLines(), 0);
                } else {
                    toggleBtn.innerHTML = '►';
                    childrenContainer.style.display = 'none';
                    // Add to collapsed set
                    this.collapsedNodeIds.add(node.surfaceId);
                }
            });
        }
        
        // Recursively add children and blends
        if (hasChildren) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            
            // Add regular children first
            if (node.children && node.children.length > 0) {
                node.children.forEach((child, index) => {
                    // Skip if this is the dragging node
                    if (this.draggingNode === child) return;
                    
                    // Set parent reference for connection lines (only for regular children)
                    child.parent = node;
                    // Only mark as last child if there are no blends
                    child.isLastChild = (index === node.children.length - 1) && 
                                       (!node.blends || node.blends.length === 0);
                    const childNode = this.createTreeNode(child, level + 1, disabledParent || (node.isDisabled && node.children.length > 1));
                    childrenContainer.appendChild(childNode);
                });
            }
            
            // Then add blends
            if (node.blends && node.blends.length > 0) {
                node.blends.forEach((blend, index) => {
                    // Skip if this is the dragging node
                    if (this.draggingNode === blend) return;
                    
                    // Don't set parent reference for blends since they can have multiple parents
                    // Instead, pass a temporary isLastChild property without modifying the blend object
                    const isLastChild = index === node.blends.length - 1;
                    const blendNode = this.createTreeNode(blend, level + 1, disabledParent || node.isDisabled);
                    
                    // If this is the last blend, add a class to help with tree lines
                    if (isLastChild) {
                        blendNode.classList.add('last-child');
                    }
                    
                    childrenContainer.appendChild(blendNode);
                });
            }
            
            container.appendChild(childrenContainer);
            
            // Apply collapsed state if needed
            if (this.collapsedNodeIds.has(node.surfaceId)) {
                childrenContainer.style.display = 'none';
            }
        }
        
        return container;
    }

    isCollapsed(node) {
        return this.collapsedNodeIds.has(node.surfaceId);
    }

    collapseNode(node) {
        this.collapsedNodeIds.add(node.surfaceId);
    }

    expandNode(node) {
        this.collapsedNodeIds.delete(node.surfaceId);
    }
    
    setupDragAndDrop(element, node) {
        // Make the element draggable
        element.setAttribute('draggable', 'true');
        
        // Add drag start event
        element.addEventListener('dragstart', (e) => {
            // Don't allow dragging the root node
            if (!node.parent) {
                e.preventDefault();
                return;
            }
            
            // Clear any previous dragging state
            if (this.draggingNode) {
                console.log("Clearing previous drag state");
                this.draggingNode = null;
            }
            
            // Set the dragging node
            this.draggingNode = node;
            
            // Add a class to the element being dragged
            element.classList.add('dragging');
            
            // Set drag data
            e.dataTransfer.setData('text/plain', node.surfaceId);
            e.dataTransfer.effectAllowed = 'move';
            
            // Use a custom drag image if needed
            const dragImage = element.cloneNode(true);
            dragImage.style.width = `${element.offsetWidth}px`;
            dragImage.style.height = `${element.offsetHeight}px`;
            dragImage.style.opacity = '0.7';
            document.body.appendChild(dragImage);
            e.dataTransfer.setDragImage(dragImage, 10, 10);
            setTimeout(() => document.body.removeChild(dragImage), 0);
            
            // Notify about drag start
            if (this.options.onNodeDragStart) {
                this.options.onNodeDragStart(node);
            }
            
            // We'll delay the re-render to ensure the drag image is captured first
            setTimeout(() => {
                // Re-render the tree to hide the dragged node
                this.render(this.getRootNode());
            }, 10);
        });
        
        // Add drag end event
        element.addEventListener('dragend', (e) => {
            element.classList.remove('dragging');
            
            // Clear the dragging node state
            const draggedNode = this.draggingNode;
            this.draggingNode = null;
            this.dragOverNode = null;
            
            // Remove any remaining drag-over highlights
            const highlights = this.container.querySelectorAll('.drag-over');
            highlights.forEach(el => el.classList.remove('drag-over'));
            
            // Notify about drag end
            if (this.options.onNodeDragEnd && draggedNode) {
                this.options.onNodeDragEnd(draggedNode);
            }
            
            // Re-render the tree to restore the dragged node
            // Use getRootNode to ensure we have the correct root node
            const rootNode = this.getRootNode();
            if (rootNode) {
                setTimeout(() => {
                    this.render(rootNode);
                }, 0);
            }
        });
        
        // Add drag over event
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            // Only allow dropping if the node can accept children
            if (this.draggingNode && node !== this.draggingNode && !this.isChildOf(node, this.draggingNode)) {
                if (node.canAddMoreChildren && node.canAddMoreChildren()) {
                    e.dataTransfer.dropEffect = 'move';
                    
                    // Add visual feedback
                    if (this.dragOverNode !== node) {
                        // Remove previous drag over highlight
                        const prevHighlight = this.container.querySelector('.drag-over');
                        if (prevHighlight) {
                            prevHighlight.classList.remove('drag-over');
                        }
                        
                        // Add highlight to current target
                        element.classList.add('drag-over');
                        this.dragOverNode = node;
                    }
                } else {
                    e.dataTransfer.dropEffect = 'none';
                }
            } else {
                e.dataTransfer.dropEffect = 'none';
            }
        });
        
        // Add drag leave event
        element.addEventListener('dragleave', (e) => {
            element.classList.remove('drag-over');
            if (this.dragOverNode === node) {
                this.dragOverNode = null;
            }
        });
        
        // Add drop event
        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            
            // Check if we have a valid drop
            if (this.draggingNode && node !== this.draggingNode && !this.isChildOf(node, this.draggingNode)) {
                if (node.canAddMoreChildren && node.canAddMoreChildren()) {
                    // Notify about the drop
                    if (this.options.onNodeDrop) {
                        this.options.onNodeDrop(this.draggingNode, node);
                    }
                }
            }
            
            // Clear drag state
            this.draggingNode = null;
            this.dragOverNode = null;
        });
    }
    
    isChildOf(potentialChild, potentialParent) {
        // Check if potentialChild is a descendant of potentialParent
        let current = potentialChild;
        
        // First check direct parent relationship for regular nodes
        while (current && current.parent) {
            if (current.parent === potentialParent) {
                return true;
            }
            current = current.parent;
        }
        
        // For blend nodes, check if they're in the blends array of the potential parent
        if (potentialParent.blends && potentialParent.blends.includes(potentialChild)) {
            return true;
        }
        
        return false;
    }
    
    getRootNode() {
        // If we have a document reference from the UI, use that
        if (this.options.getDocument) {
            return this.options.getDocument();
        }
        
        // Otherwise try to find the root by traversing up from the selected node
        if (this.selectedNode) {
            let root = this.selectedNode;
            while (root.parent) {
                root = root.parent;
            }
            return root;
        }
        
        return null;
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
        if (!node) return;
        
        const hasChildren = (node.children && node.children.length > 0) || 
                            (node.blends && node.blends.length > 0);
        if (!hasChildren) return;
        
        // Process each child recursively
        const processChildren = (currentNode) => {
            // Process regular children
            if (currentNode.children) {
                currentNode.children.forEach(child => {
                    // Find the DOM element for this child
                    const childLabels = this.container.querySelectorAll(`.tree-node-label[data-node-id="${child.surfaceId}"]`);
                    if (childLabels.length > 0) {
                        childLabels.forEach(childLabel => {
                            if (highlight) {
                                childLabel.classList.add('child-of-selected');
                            } else {
                                childLabel.classList.remove('child-of-selected');
                            }
                        });
                    }
                    
                    // Process this child's children recursively
                    processChildren(child);
                });
            }
            
            // Process blends
            if (currentNode.blends) {
                currentNode.blends.forEach(blend => {
                    // Find all DOM elements for this blend
                    const blendLabels = this.container.querySelectorAll(`.tree-node-label[data-node-id="${blend.surfaceId}"]`);
                    if (blendLabels.length > 0) {
                        blendLabels.forEach(blendLabel => {
                            if (highlight) {
                                blendLabel.classList.add('child-of-selected');
                            } else {
                                blendLabel.classList.remove('child-of-selected');
                            }
                        });
                    }
                    
                    // Don't recursively process blend's children to avoid circular references
                    // If needed, we could add a check to prevent infinite recursion
                });
            }
        };
        
        processChildren(node);
    }
    
    updateNodeLabel(node) {
        if (!node || !node.surfaceId) return;
        
        // Find the tree node label that corresponds to the node
        const nodeLabel = this.container.querySelector(`.tree-node-label[data-node-id="${node.surfaceId}"]`);
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

        if (!node) return;
        
        // Update the UI to reflect the selection
        const nodeLabels = this.container.querySelectorAll(`.tree-node-label[data-node-id="${node.surfaceId}"]`);
        if (nodeLabels.length > 0) {
            // Remove selected class from all nodes
            const selectedLabels = this.container.querySelectorAll('.tree-node-label.selected');
            selectedLabels.forEach(el => el.classList.remove('selected'));
            
            // Remove child highlight from all nodes
            const childHighlightLabels = this.container.querySelectorAll('.tree-node-label.child-of-selected');
            childHighlightLabels.forEach(el => el.classList.remove('child-of-selected'));
            
            // Add selected class to all instances of this node
            nodeLabels.forEach(nodeLabel => {
                nodeLabel.classList.add('selected');
            });
            
            // Highlight all children of this node
            this.highlightChildNodes(node, true);
        }
    }

    setPreselectedNode(node) {
        // Clear previous preselection
        if (this.preselectedNode) {
            const prevLabel = this.container.querySelector(`.tree-node-label[data-node-id="${this.preselectedNode.surfaceId}"]`);
            if (prevLabel) {
                prevLabel.classList.remove('preselected');
            }
        }
        
        this.preselectedNode = node;
        
        // Apply preselection styling
        if (node) {
            const nodeLabel = this.container.querySelector(`.tree-node-label[data-node-id="${node.surfaceId}"]`);
            if (nodeLabel) {
                nodeLabel.classList.add('preselected');
            }
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
