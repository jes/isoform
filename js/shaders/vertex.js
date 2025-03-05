// Export vertex shader as a string
const vertexShaderSource = `
attribute vec4 aVertexPosition;

void main() {
    gl_Position = aVertexPosition;
}
`;

// Make it available globally or as a module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = vertexShaderSource;
} else {
    window.vertexShaderSource = vertexShaderSource;
} 