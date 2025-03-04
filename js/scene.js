// Scene configuration
const scene = {
    showSphere: null,
    showBox: null,
    showTorus: null,
    subtractSphere: null,
    subtractBox: null,
    subtractTorus: null,
    thicknessSphere: null,
    thicknessBox: null,
    thicknessTorus: null,
    smoothnessSlider: null,
    smoothnessValue: null,
    currentSmoothness: 0.5,
    needsRecompile: false,
    
    init() {
        // Get UI elements
        this.showSphere = document.getElementById('showSphere');
        this.showBox = document.getElementById('showBox');
        this.showTorus = document.getElementById('showTorus');
        this.subtractSphere = document.getElementById('subtractSphere');
        this.subtractBox = document.getElementById('subtractBox');
        this.subtractTorus = document.getElementById('subtractTorus');
        this.thicknessSphere = document.getElementById('thicknessSphere');
        this.thicknessBox = document.getElementById('thicknessBox');
        this.thicknessTorus = document.getElementById('thicknessTorus');
        this.smoothnessSlider = document.getElementById('smoothness');
        this.smoothnessValue = document.getElementById('smoothnessValue');
        
        // Initialize smoothness value
        this.currentSmoothness = parseFloat(this.smoothnessSlider.value);
        
        // Add event listeners
        this.showSphere.addEventListener('change', () => this.needsRecompile = true);
        this.showBox.addEventListener('change', () => this.needsRecompile = true);
        this.showTorus.addEventListener('change', () => this.needsRecompile = true);
        this.subtractSphere.addEventListener('change', () => this.needsRecompile = true);
        this.subtractBox.addEventListener('change', () => this.needsRecompile = true);
        this.subtractTorus.addEventListener('change', () => this.needsRecompile = true);
        this.thicknessSphere.addEventListener('change', () => this.needsRecompile = true);
        this.thicknessBox.addEventListener('change', () => this.needsRecompile = true);
        this.thicknessTorus.addEventListener('change', () => this.needsRecompile = true);
        
        this.smoothnessSlider.addEventListener('input', () => {
            this.currentSmoothness = parseFloat(this.smoothnessSlider.value);
            this.smoothnessValue.textContent = this.currentSmoothness.toFixed(2);
            this.needsRecompile = true;
        });
    },
    
    generateShaderCode() {
        if (!this.needsRecompile) return null;
        
        // Get the original shader source
        let originalSource = renderer.fragmentShaderSource;
        
        // Find the scene combination part
        const sceneStartMarker = "// Combine objects";
        const sceneEndMarker = "// Add ground plane";
        
        let startIndex = originalSource.indexOf(sceneStartMarker);
        let endIndex = originalSource.indexOf(sceneEndMarker);
        
        if (startIndex === -1 || endIndex === -1) return null;
        
        // Skip to the end of the start marker line
        startIndex = originalSource.indexOf('\n', startIndex) + 1;
        
        // Build the new scene combination code
        let newSceneCode = "            // Combine objects\n";
        
        // Check if we have any positive objects
        const hasPositiveObjects = 
            (this.showSphere.checked && !this.subtractSphere.checked) || 
            (this.showBox.checked && !this.subtractBox.checked) || 
            (this.showTorus.checked && !this.subtractTorus.checked);
        
        // Check if we have any subtractive objects
        const hasSubtractiveObjects = 
            (this.showSphere.checked && this.subtractSphere.checked) || 
            (this.showBox.checked && this.subtractBox.checked) || 
            (this.showTorus.checked && this.subtractTorus.checked);
        
        // If no objects are selected at all
        if (!this.showSphere.checked && !this.showBox.checked && !this.showTorus.checked) {
            newSceneCode += "            float scene = 1000.0; // No objects selected\n";
        } 
        // If we only have subtractive objects, create a base sphere
        else if (!hasPositiveObjects && hasSubtractiveObjects) {
            newSceneCode += "            float scene = 10.0; // Base for subtractive objects\n";
            
            // Add all subtractive objects
            if (this.showSphere.checked && this.subtractSphere.checked) {
                newSceneCode += `            scene = opSmoothSubtraction(scene, sphere, ${this.currentSmoothness.toFixed(2)});\n`;
            }
            
            if (this.showBox.checked && this.subtractBox.checked) {
                newSceneCode += `            scene = opSmoothSubtraction(scene, box, ${this.currentSmoothness.toFixed(2)});\n`;
            }
            
            if (this.showTorus.checked && this.subtractTorus.checked) {
                newSceneCode += `            scene = opSmoothSubtraction(scene, torus, ${this.currentSmoothness.toFixed(2)});\n`;
            }
        } 
        // We have at least one positive object
        else {
            // Initialize with the first positive object
            let sceneInitialized = false;
            
            // First pass: add all positive objects
            if (this.showSphere.checked && !this.subtractSphere.checked) {
                let sphereObj = "sphere";
                if (this.thicknessSphere.checked) {
                    sphereObj = `opThickness(sphere, 0.1)`;
                }
                
                if (!sceneInitialized) {
                    newSceneCode += `            float scene = ${sphereObj};\n`;
                    sceneInitialized = true;
                } else {
                    newSceneCode += `            scene = opSmoothUnion(scene, ${sphereObj}, ${this.currentSmoothness.toFixed(2)});\n`;
                }
            }
            
            if (this.showBox.checked && !this.subtractBox.checked) {
                let boxObj = "box";
                if (this.thicknessBox.checked) {
                    boxObj = `opThickness(box, 0.1)`;
                }
                
                if (!sceneInitialized) {
                    newSceneCode += `            float scene = ${boxObj};\n`;
                    sceneInitialized = true;
                } else {
                    newSceneCode += `            scene = opSmoothUnion(scene, ${boxObj}, ${this.currentSmoothness.toFixed(2)});\n`;
                }
            }
            
            if (this.showTorus.checked && !this.subtractTorus.checked) {
                let torusObj = "torus";
                if (this.thicknessTorus.checked) {
                    torusObj = `opThickness(torus, 0.1)`;
                }
                
                if (!sceneInitialized) {
                    newSceneCode += `            float scene = ${torusObj};\n`;
                    sceneInitialized = true;
                } else {
                    newSceneCode += `            scene = opSmoothUnion(scene, ${torusObj}, ${this.currentSmoothness.toFixed(2)});\n`;
                }
            }
            
            // Second pass: apply all subtractive objects
            if (this.showSphere.checked && this.subtractSphere.checked) {
                let sphereObj = "sphere";
                if (this.thicknessSphere.checked) {
                    sphereObj = `opThickness(sphere, 0.1)`;
                }
                newSceneCode += `            scene = opSmoothSubtraction(scene, ${sphereObj}, ${this.currentSmoothness.toFixed(2)});\n`;
            }
            
            if (this.showBox.checked && this.subtractBox.checked) {
                let boxObj = "box";
                if (this.thicknessBox.checked) {
                    boxObj = `opThickness(box, 0.1)`;
                }
                newSceneCode += `            scene = opSmoothSubtraction(scene, ${boxObj}, ${this.currentSmoothness.toFixed(2)});\n`;
            }
            
            if (this.showTorus.checked && this.subtractTorus.checked) {
                let torusObj = "torus";
                if (this.thicknessTorus.checked) {
                    torusObj = `opThickness(torus, 0.1)`;
                }
                newSceneCode += `            scene = opSmoothSubtraction(scene, ${torusObj}, ${this.currentSmoothness.toFixed(2)});\n`;
            }
        }
        
        // Combine the parts
        const newSource = originalSource.substring(0, startIndex) + 
                   newSceneCode +
                   originalSource.substring(endIndex);
        
        this.needsRecompile = false;
        return newSource;
    }
}; 