class TextNode extends TreeNode {
  constructor(text = "Text") {
    super("Text");
    this.text = text;
    this.font = "sans-serif";
    this.fontSize = 10; // Size in mm

    this.imageNode = new ImageNode(new Float32Array([0]), [1, 1], 'linear');
    this.renderedText = null;
    this.renderedFont = null;
    this.renderedFontSize = null;
    
    // Initial render
    this.renderText();
  }

  renderText() {
    if (this.renderedText === this.text && this.renderedFont === this.font && this.renderedFontSize === this.fontSize) return;
    
    // Create a canvas to render the text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set font properties
    const fontSizePx = this.fontSize * 10; // Convert mm to px (approximate)
    ctx.font = `${fontSizePx}px ${this.font}`;
    
    // Measure text to set canvas dimensions
    const textMetrics = ctx.measureText(this.text);
    const textHeight = fontSizePx * 1.2; // Approximate height based on font size
    
    // Set canvas dimensions with some padding
    const padding = fontSizePx / 2;
    canvas.width = textMetrics.width + padding * 2;
    canvas.height = textHeight + padding * 2;
    
    // Clear canvas and set text properties
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Redraw with measured dimensions
    ctx.font = `${fontSizePx}px ${this.font}`;
    ctx.fillStyle = 'black';
    ctx.fillText(this.text, padding, textHeight);
    
    // Get pixel data directly from canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    
    // Create ImageProcessor manually without async operations
    const imageProcessor = new ImageProcessor();
    imageProcessor.width = canvas.width;
    imageProcessor.height = canvas.height;
    imageProcessor.imageData = Array.from(imageData).map(value => value / 255);
    
    // Generate SDF from the text image
    const sdfProcessor = imageProcessor.toSDF();
    
    // Update the imageNode with SDF data
    const dimensions = sdfProcessor.getDimensions();
    const channelData = sdfProcessor.extractChannel('grayscale', false);
    
    // Create or update the ImageNode
    this.imageNode = new ImageNode(
      channelData,
      dimensions,
      'linear'
    );
    
    // Update renderedText to track the current text
    this.renderedText = this.text;
  }

  is2d() {
    return true;
  }

  makeNormalised() {
    this.renderText();
    return this.imageNode.cloneWithSameIds().normalised();
  }
  
  properties() {
    return { "text": "string", "font": "string", "fontSize": "float" };
  }
}

// Detect environment and export accordingly
(function() {
  const nodes = { TextNode };
  
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
