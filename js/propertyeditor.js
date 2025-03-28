class PropertyEditor {
    constructor(container, options = {}) {
        this.container = container;
        this.options = Object.assign({
            onPropertyChanged: null,
            onInputFocused: null,
            onInputBlurred: null
        }, options);
        
        this.selectedNode = null;
    }
    
    render(node) {
        // Clear the property editor
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        if (!node || !this.container) {
            this.selectedNode = null;
            return;
        }
        
        this.selectedNode = node;
        
        // Add a heading showing the node type
        const nodeTypeHeading = document.createElement('h3');
        nodeTypeHeading.className = 'node-type-heading';
        nodeTypeHeading.textContent = (node.name || 'Unknown Node');
        this.container.appendChild(nodeTypeHeading);
        
        // Get the generic properties first (if the method exists)
        const genericProperties = node.genericProperties ? node.genericProperties() : {};
        
        // Get the specific properties for this node
        const specificProperties = node.properties();
        
        // Track the first input element to focus it later
        let firstInput = null;
        
        // Create form elements for generic properties first
        if (Object.keys(genericProperties).length > 0) {
            for (const [propName, propType] of Object.entries(genericProperties)) {
                const propValue = node.getProperty(propName);
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
                this.container.appendChild(separator);
            }
        }
        
        // Create form elements for specific properties
        for (const [propName, propType] of Object.entries(specificProperties)) {
            const propValue = node.getProperty(propName);
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
    }
    
    createPropertyInput(propName, propType, propValue) {
        const propContainer = document.createElement('div');
        propContainer.className = 'property-item';
        
        const propLabel = document.createElement('label');
        propLabel.textContent = propName;
        propContainer.appendChild(propLabel);
        
        // Create appropriate input based on property type
        let input;
        
        if (propType === 'float' || propType === 'int') {
            input = document.createElement('input');
            input.type = 'text'; // Using text to allow expressions
            input.value = propValue;
            
            // Handle both blur and Enter key for evaluation
            const evaluateAndUpdate = () => {
                try {
                    let result = this.evaluateExpression(input.value);
                    // For int type, truncate to integer
                    if (propType === 'int') {
                        result = Math.floor(result);
                    }
                    
                    if (!isNaN(result)) {
                        input.value = result; // Update the input with the evaluated result
                        
                        // Only update and notify if the value has actually changed
                        const currentValue = this.selectedNode.getProperty(propName);
                        if (currentValue !== result) {
                            this.selectedNode.setProperty(propName, result);
                            this.notifyPropertyChanged(propName);
                            this.updateNodeTypeHeading(); // Update heading to reflect new exactness
                        }
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
            
            // Add focus/blur event handlers
            input.addEventListener('focus', () => {
                if (this.options.onInputFocused) {
                    this.options.onInputFocused(this.selectedNode);
                }
            });
            
            input.addEventListener('blur', () => {
                if (this.options.onInputBlurred) {
                    this.options.onInputBlurred();
                }
            });
        } 
        else if (propType === 'bool') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = propValue === true;
            
            input.addEventListener('change', () => {
                const newValue = input.checked;
                const currentValue = this.selectedNode.getProperty(propName);
                
                if (currentValue !== newValue) {
                    this.selectedNode.setProperty(propName, newValue);
                    this.notifyPropertyChanged(propName);
                    this.updateNodeTypeHeading(); // Update heading to reflect new exactness
                }
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
                const newValue = input.value;
                const currentValue = this.selectedNode.getProperty(propName);
                
                if (currentValue !== newValue) {
                    this.selectedNode.setProperty(propName, newValue);
                    this.notifyPropertyChanged(propName);
                    this.updateNodeTypeHeading(); // Update heading to reflect new exactness
                }
            });
            
            // Add focus/blur event handlers
            input.addEventListener('focus', () => {
                if (this.options.onInputFocused) {
                    this.options.onInputFocused(this.selectedNode);
                }
            });
            
            input.addEventListener('blur', () => {
                if (this.options.onInputBlurred) {
                    this.options.onInputBlurred();
                }
            });
        }
        else if (propType === 'vec3') {
            // Create a container for the vector inputs
            input = document.createElement('div');
            input.className = 'vector-input';
            input.style.display = 'flex';
            input.style.flexDirection = 'column';
            input.style.gap = '4px';
            
            // Convert array to Vec3 if needed
            let vecValue = propValue;
            if (Array.isArray(propValue)) {
                vecValue = new Vec3(propValue[0], propValue[1], propValue[2]);
            }
            
            // Create inputs for each component
            const components = [
                { name: 'x', color: 'rgba(220, 53, 69, 0.5)' }, // Red
                { name: 'y', color: 'rgba(40, 167, 69, 0.5)' },  // Green
                { name: 'z', color: 'rgba(0, 123, 255, 0.5)' }   // Blue
            ];
            
            components.forEach(component => {
                const componentContainer = document.createElement('div');
                componentContainer.style.display = 'flex';
                componentContainer.style.alignItems = 'center';
                
                const componentLabel = document.createElement('span');
                componentLabel.textContent = component.name + ':';
                componentLabel.style.marginRight = '5px';
                componentLabel.style.width = '15px';
                componentLabel.style.color = component.color;
                componentLabel.style.fontWeight = 'bold';
                
                const componentInput = document.createElement('input');
                componentInput.type = 'text'; // Using text to allow expressions
                componentInput.value = vecValue[component.name];
                componentInput.style.flex = '1';
                componentInput.style.borderColor = component.color;
                componentInput.style.borderWidth = '1px';
                
                // Handle both blur and Enter key for evaluation
                const evaluateAndUpdate = () => {
                    try {
                        const result = this.evaluateExpression(componentInput.value);
                        if (!isNaN(result)) {
                            componentInput.value = result; // Update the input with the evaluated result
                            
                            // Get current value (might be array or Vec3)
                            let currentValue = this.selectedNode.getProperty(propName);
                            let newValue;
                            
                            // Convert to Vec3 if it's an array
                            if (Array.isArray(currentValue)) {
                                currentValue = new Vec3(currentValue[0], currentValue[1], currentValue[2]);
                            }
                            
                            // Only update if the component value has changed
                            if (currentValue[component.name] !== result) {
                                // Create a new Vec3 with the updated component
                                newValue = new Vec3(
                                    component.name === 'x' ? result : currentValue.x,
                                    component.name === 'y' ? result : currentValue.y,
                                    component.name === 'z' ? result : currentValue.z
                                );
                                
                                this.selectedNode.setProperty(propName, newValue);
                                this.notifyPropertyChanged(propName);
                                this.updateNodeTypeHeading();
                            }
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
                
                // Add focus/blur event handlers
                componentInput.addEventListener('focus', () => {
                    if (this.options.onInputFocused) {
                        this.options.onInputFocused(this.selectedNode);
                    }
                });
                
                componentInput.addEventListener('blur', () => {
                    if (this.options.onInputBlurred) {
                        this.options.onInputBlurred();
                    }
                });
                
                componentContainer.appendChild(componentLabel);
                componentContainer.appendChild(componentInput);
                input.appendChild(componentContainer);
            });
        }
        else if (Array.isArray(propType)) {
            // Create a dropdown for array type properties
            input = document.createElement('select');
            
            // Add options based on the array values
            propType.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                
                // Set the current value as selected
                if (option === propValue) {
                    optionElement.selected = true;
                }
                
                input.appendChild(optionElement);
            });
            
            // Handle change event
            input.addEventListener('change', () => {
                const newValue = input.value;
                const currentValue = this.selectedNode.getProperty(propName);
                
                if (currentValue !== newValue) {
                    this.selectedNode.setProperty(propName, newValue);
                    this.notifyPropertyChanged(propName);
                    this.updateNodeTypeHeading(); // Update heading to reflect new exactness
                }
            });
        }
        
        propContainer.appendChild(input);
        this.container.appendChild(propContainer);
        
        // Return the input element so we can focus it if needed
        return input;
    }
    
    notifyPropertyChanged(propName) {
        if (this.options.onPropertyChanged) {
            this.options.onPropertyChanged(this.selectedNode, propName);
        }
    }
    
    updateNodeTypeHeading() {
        if (!this.selectedNode) return;
        
        // Find the existing heading
        const nodeTypeHeading = this.container.querySelector('.node-type-heading');
        if (nodeTypeHeading) {
            // Update the heading text with the current exactness
            nodeTypeHeading.textContent = (this.selectedNode.name || 'Unknown Node');
        }
    }
    
    /**
     * Refreshes all input values to match the current state of the selected node.
     * This is useful when node properties are changed outside of the property editor.
     */
    refresh() {
        if (!this.selectedNode || !this.container) return;
        
        // Get all property inputs
        const propertyItems = this.container.querySelectorAll('.property-item');
        
        propertyItems.forEach(item => {
            const label = item.querySelector('label');
            if (!label) return;
            
            const propName = label.textContent;
            const currentValue = this.selectedNode.getProperty(propName);
            
            // Find the input element(s)
            const input = item.querySelector('input, select');
            const vectorInputs = item.querySelectorAll('.vector-input input');
            
            if (input && !vectorInputs.length) {
                // Handle regular inputs
                if (input.type === 'checkbox') {
                    if (input.checked !== (currentValue === true)) {
                        input.checked = currentValue === true;
                    }
                } else if (input.type === 'text' || input.tagName === 'SELECT') {
                    if (input.value != currentValue) { // Use loose equality to handle number/string conversions
                        input.value = currentValue;
                    }
                }
            } else if (vectorInputs.length) {
                // Handle Vec3 inputs
                let vecValue = currentValue;
                if (Array.isArray(currentValue)) {
                    vecValue = new Vec3(currentValue[0], currentValue[1], currentValue[2]);
                }
                
                const components = ['x', 'y', 'z'];
                components.forEach((component, index) => {
                    const componentInput = vectorInputs[index];
                    if (componentInput && componentInput.value != vecValue[component]) {
                        componentInput.value = vecValue[component];
                    }
                });
            }
        });
    }
    
    // Evaluate arithmetic expressions
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
    }
    
    getSelectedNode() {
        return this.selectedNode;
    }
}

// Export the PropertyEditor class
(function() {
    if (typeof window !== 'undefined') {
        window.PropertyEditor = PropertyEditor;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PropertyEditor;
    }
})(); 