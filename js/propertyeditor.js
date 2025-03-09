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
        if (!node || !this.container) return;
        
        this.selectedNode = node;
        
        // Clear the property editor
        this.container.innerHTML = '';
        
        // Add a heading showing the node type
        const nodeTypeHeading = document.createElement('h3');
        nodeTypeHeading.className = 'node-type-heading';
        nodeTypeHeading.textContent = (node.name || 'Unknown Node') + ' (' + node.getExactness() + ')';
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
                        this.selectedNode.setProperty(propName, result);
                        this.notifyPropertyChanged(propName);
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
                this.selectedNode.setProperty(propName, input.checked);
                this.notifyPropertyChanged(propName);
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
                this.notifyPropertyChanged(propName);
                this.updateNodeTypeHeading(); // Update heading to reflect new exactness
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
            
            // Create inputs for each component
            ['x', 'y', 'z'].forEach((component, index) => {
                const componentContainer = document.createElement('div');
                componentContainer.style.display = 'flex';
                componentContainer.style.alignItems = 'center';
                
                const componentInput = document.createElement('input');
                componentInput.type = 'text'; // Using text to allow expressions
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
                            this.notifyPropertyChanged(propName);
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
                this.selectedNode.setProperty(propName, input.value);
                this.notifyPropertyChanged(propName);
                this.updateNodeTypeHeading(); // Update heading to reflect new exactness
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
            nodeTypeHeading.textContent = (this.selectedNode.name || 'Unknown Node') + ' (' + this.selectedNode.getExactness() + ')';
        }
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