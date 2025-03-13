class SketchEditor {
    constructor(sketchNode, container) {
        this.sketchNode = sketchNode;
        this.wasDisabled = false;
        this.container = container;
        this.canvas = null;
        this.ctx = null;
        this.active = false;
        this.selectedTool = 'select'; // Default tool
        this.selectedVertex = null;
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        
        // Create and initialize the canvas
        this.initCanvas();
        // Create toolbar
        this.createToolbar();
    }
    
    initCanvas() {
        // Create a new canvas element that overlays the WebGL canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'sketch-editor-canvas';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'auto'; // Allow mouse events
        this.canvas.style.zIndex = '10'; // Above the WebGL canvas
        
        // Match the size of the WebGL canvas
        const glCanvas = document.getElementById('glCanvas');
        this.canvas.width = glCanvas.width;
        this.canvas.height = glCanvas.height;
        
        // Add the canvas to the container
        this.container.appendChild(this.canvas);
        
        // Get the 2D context
        this.ctx = this.canvas.getContext('2d');
        
        // Add event listeners
        this.addEventListeners();
    }
    
    createToolbar() {
        // Create a toolbar for sketch editing tools
        this.toolbar = document.createElement('div');
        this.toolbar.id = 'sketch-toolbar';
        this.toolbar.className = 'toolbar';
        this.toolbar.style.position = 'absolute';
        this.toolbar.style.top = '10px';
        this.toolbar.style.left = '50%';
        this.toolbar.style.transform = 'translateX(-50%)';
        this.toolbar.style.zIndex = '11';
        this.toolbar.style.display = 'flex';
        this.toolbar.style.backgroundColor = '#333';
        this.toolbar.style.borderRadius = '4px';
        this.toolbar.style.padding = '5px';
        
        // Add tool buttons
        const tools = [
            { id: 'select', icon: '✋', tooltip: 'Select/Drag Vertices' },
            { id: 'split', icon: '✂️', tooltip: 'Split Line Segment' },
            { id: 'delete', icon: '🗑️', tooltip: 'Delete Vertex' },
            { id: 'none', icon: '🔍', tooltip: 'No Tool (View Only)' }
        ];
        
        tools.forEach(tool => {
            const button = document.createElement('button');
            button.id = `tool-${tool.id}`;
            button.innerHTML = tool.icon;
            button.title = tool.tooltip;
            button.className = 'tool-button';
            button.style.margin = '0 5px';
            button.style.padding = '5px 10px';
            button.style.backgroundColor = tool.id === this.selectedTool ? '#555' : '#333';
            button.style.border = 'none';
            button.style.borderRadius = '3px';
            button.style.cursor = 'pointer';
            
            button.addEventListener('click', () => {
                this.setTool(tool.id);
                // Update button styles
                document.querySelectorAll('.tool-button').forEach(btn => {
                    btn.style.backgroundColor = '#333';
                });
                button.style.backgroundColor = '#555';
            });
            
            this.toolbar.appendChild(button);
        });
        
        // Add a close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '✖️';
        closeButton.title = 'Close Sketch Editor';
        closeButton.className = 'tool-button';
        closeButton.style.marginLeft = '10px';
        closeButton.style.padding = '5px 10px';
        closeButton.style.backgroundColor = '#333';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '3px';
        closeButton.style.cursor = 'pointer';
        
        closeButton.addEventListener('click', () => {
            this.close();
        });
        
        this.toolbar.appendChild(closeButton);
        
        // Hide toolbar initially
        this.toolbar.style.display = 'none';
        
        // Add to container
        this.container.appendChild(this.toolbar);
    }
    
    addEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        
        // Handle canvas resize
        window.addEventListener('resize', this.onResize.bind(this));
    }
    
    onResize() {
        if (!this.active) return;
        
        const glCanvas = document.getElementById('glCanvas');
        this.canvas.width = glCanvas.width;
        this.canvas.height = glCanvas.height;
        
        this.render();
    }
    
    onMouseDown(e) {
        if (!this.active) return;
        
        this.isDragging = true;
        this.lastMousePos = this.getMousePosition(e);
        
        // Handle tool-specific actions
        switch (this.selectedTool) {
            case 'select':
                this.selectedVertex = this.findVertexNearPoint(this.lastMousePos);
                break;
            case 'split':
                this.splitLineSegment(this.lastMousePos);
                break;
            case 'delete':
                this.deleteVertex(this.lastMousePos);
                break;
        }
        
        this.render();
    }
    
    onMouseMove(e) {
        if (!this.active) return;
        
        const mousePos = this.getMousePosition(e);
        
        if (this.isDragging && this.selectedTool === 'select' && this.selectedVertex !== null) {
            // Update vertex position
            const worldPos = camera.screenToWorld(mousePos);
            const points = this.sketchNode.polycurves[0];
            const vertexIndex = this.selectedVertex.index;
            
            // Update the vertex position
            points[vertexIndex] = worldPos;
            
            this.sketchNode.markDirty();
        }
        
        this.render();
    }
    
    onMouseUp() {
        if (!this.active) return;
        
        this.isDragging = false;
        
        if (this.selectedTool === 'select') {
            this.selectedVertex = null;
        }
    }
    
    getMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    findVertexNearPoint(point) {
        // Find a vertex near the given point
        if (!this.sketchNode.polycurves.length) return null;
        
        const points = this.sketchNode.polycurves[0];
        const threshold = 10; // Pixel distance threshold for selection
        
        // Check each vertex
        for (let i = 0; i < points.length; i++) {
            const screenPos = camera.worldToScreen(points[i]);
            
            const distance = Math.sqrt(
                Math.pow(point.x - screenPos.x, 2) + 
                Math.pow(point.y - screenPos.y, 2)
            );
            
            if (distance <= threshold) {
                return { index: i };
            }
        }
        
        return null;
    }
    
    splitLineSegment(point) {
        // Find the closest line segment and split it
        if (!this.sketchNode.polycurves.length) return;
        
        const points = this.sketchNode.polycurves[0];
        if (points.length < 2) return;
        
        let closestSegment = -1;
        let closestDistance = Infinity;
        let closestPoint = null;
        
        // Find the closest line segment
        for (let i = 0; i < points.length; i++) {
            const startPoint = points[i];
            const endPoint = points[(i + 1) % points.length]; // Wrap around to first point
            
            const startScreen = camera.worldToScreen(startPoint);
            const endScreen = camera.worldToScreen(endPoint);
            
            // Calculate distance from point to line segment
            const distance = this.distanceToLineSegment(
                point, 
                startScreen, 
                endScreen
            );
            
            if (distance.distance < closestDistance) {
                closestDistance = distance.distance;
                closestSegment = i;
                closestPoint = distance.point;
            }
        }
        
        // If we found a close enough segment, split it
        if (closestSegment >= 0 && closestDistance < 10) {
            const worldPoint = camera.screenToWorld(closestPoint);
            
            // Insert the new point after the current segment's start point
            this.sketchNode.polycurves[0].splice(closestSegment + 1, 0, worldPoint);
            
            // Mark the node as dirty
            this.sketchNode.markDirty();
        }
    }
    
    deleteVertex(point) {
        // Find and delete a vertex near the given point
        const vertex = this.findVertexNearPoint(point);
        if (!vertex) return;
        
        const points = this.sketchNode.polycurves[0];
        
        // Don't delete if we would have fewer than 3 points (need at least a triangle)
        if (points.length <= 3) return;
        
        // Remove the vertex
        points.splice(vertex.index, 1);
        
        // Mark the node as dirty
        this.sketchNode.markDirty();
    }
    
    distanceToLineSegment(point, lineStart, lineEnd) {
        // Calculate the distance from a point to a line segment
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        
        if (dx === 0 && dy === 0) {
            // Line segment is a point
            return {
                distance: Math.sqrt(
                    Math.pow(point.x - lineStart.x, 2) + 
                    Math.pow(point.y - lineStart.y, 2)
                ),
                point: { x: lineStart.x, y: lineStart.y }
            };
        }
        
        // Calculate projection
        const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / 
                 (dx * dx + dy * dy);
        
        if (t < 0) {
            // Closest to the start point
            return {
                distance: Math.sqrt(
                    Math.pow(point.x - lineStart.x, 2) + 
                    Math.pow(point.y - lineStart.y, 2)
                ),
                point: { x: lineStart.x, y: lineStart.y }
            };
        } else if (t > 1) {
            // Closest to the end point
            return {
                distance: Math.sqrt(
                    Math.pow(point.x - lineEnd.x, 2) + 
                    Math.pow(point.y - lineEnd.y, 2)
                ),
                point: { x: lineEnd.x, y: lineEnd.y }
            };
        } else {
            // Closest to a point on the line segment
            const closestX = lineStart.x + t * dx;
            const closestY = lineStart.y + t * dy;
            
            return {
                distance: Math.sqrt(
                    Math.pow(point.x - closestX, 2) + 
                    Math.pow(point.y - closestY, 2)
                ),
                point: { x: closestX, y: closestY }
            };
        }
    }
    
    setTool(toolId) {
        this.selectedTool = toolId;
        
        // Update cursor based on selected tool
        switch (toolId) {
            case 'select':
                this.canvas.style.cursor = 'pointer';
                break;
            case 'split':
                this.canvas.style.cursor = 'crosshair';
                break;
            case 'delete':
                this.canvas.style.cursor = 'not-allowed';
                break;
            case 'none':
                this.canvas.style.cursor = 'default';
                break;
        }
    }
    
    render() {
        if (!this.active || !this.ctx) return;
        
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw local axes
        const origin = camera.worldToScreen({x: 0, y: 0, z: 0});
        const xDir = camera.worldToScreen({x: 100000, y: 0, z: 0});
        const yDir = camera.worldToScreen({x: 0, y: 100000, z: 0});

        // Draw X axis (red)
        this.ctx.beginPath();
        this.ctx.moveTo(origin.x - xDir.x, origin.y - xDir.y);
        this.ctx.lineTo(origin.x + xDir.x, origin.y + xDir.y);
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        // Draw Y axis (green)
        this.ctx.beginPath();
        this.ctx.moveTo(origin.x - yDir.x, origin.y - yDir.y);
        this.ctx.lineTo(origin.x + yDir.x, origin.y + yDir.y);
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();

        // Draw origin point
        this.ctx.beginPath();
        this.ctx.arc(origin.x, origin.y, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = 'white';
        this.ctx.fill();
        
        // If there are no polycurves, nothing to render
        if (!this.sketchNode.polycurves.length) return;
        
        const points = this.sketchNode.polycurves[0];
        if (points.length < 2) return;
        
        // Draw the filled polygon
        this.ctx.beginPath();
        
        const firstPoint = camera.worldToScreen(points[0]);
        this.ctx.moveTo(firstPoint.x, firstPoint.y);
        
        // Draw lines to each point
        for (let i = 1; i < points.length; i++) {
            const screenPoint = camera.worldToScreen(points[i]);
            this.ctx.lineTo(screenPoint.x, screenPoint.y);
        }
        
        // Close the path back to the first point
        this.ctx.closePath();
        this.ctx.fillStyle = 'rgba(0, 100, 255, 0.2)';
        this.ctx.fill();
        
        // Draw the line segments
        for (let i = 0; i < points.length; i++) {
            const startPoint = points[i];
            const endPoint = points[(i + 1) % points.length]; // Wrap around to first point
            
            const startScreen = camera.worldToScreen(startPoint);
            const endScreen = camera.worldToScreen(endPoint);
            
            this.ctx.beginPath();
            this.ctx.moveTo(startScreen.x, startScreen.y);
            this.ctx.lineTo(endScreen.x, endScreen.y);
            this.ctx.strokeStyle = 'rgba(0, 100, 255, 0.8)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // Draw vertex at each point
            this.drawVertex(startScreen);
        }
    }
    
    drawVertex(position) {
        this.ctx.beginPath();
        this.ctx.arc(position.x, position.y, 6, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
        this.ctx.fill();
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }
    
    open(sketchNode) {
        if (sketchNode) {
            this.wasDisabled = sketchNode.isDisabled;
            sketchNode.disable();
            this.sketchNode = sketchNode;
        }
        
        // Make sure we have at least one polycurve with a default rectangle
        if (!this.sketchNode.polycurves.length) {
            this.sketchNode.polycurves.push([
                { x: -10, y: -10 },
                { x: 10, y: -10 },
                { x: 10, y: 10 },
                { x: -10, y: 10 }
            ]);
        }
        
        this.active = true;
        this.canvas.style.display = 'block';
        this.toolbar.style.display = 'flex';
        
        // Disable camera rotation
        this.originalCameraMouseDown = camera.onMouseDown;
        camera.onMouseDown = () => {}; // Disable camera rotation
        
        this.render();
    }
    
    close() {
        this.active = false;
        this.canvas.style.display = 'none';
        this.toolbar.style.display = 'none';

        if (this.sketchNode && !this.wasDisabled) {
            this.sketchNode.enable();
        }
        
        // Re-enable camera rotation
        if (this.originalCameraMouseDown) {
            camera.onMouseDown = this.originalCameraMouseDown;
            this.originalCameraMouseDown = null;
        }
    }
}