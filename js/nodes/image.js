class ImageNode extends TreeNode {
    constructor(data, dimensions, interpolation = 'linear') {
        super("Image");
        this.data = data;
        this.dimensions = dimensions;
        this.interpolation = interpolation;
        this.texture2d = new Texture2D(data, dimensions, interpolation);
        this.invert = false;
        this.tileX = false;
        this.tileY = false;
        this.mirrorX = false;
        this.mirrorY = true;
    }

    properties() {
        return {"invert": "bool", "tileX": "bool", "tileY": "bool", "mirrorX": "bool", "mirrorY": "bool"};
    }

    is2d() {
        return true;
    }

    aabb() {
        return AABB.infinite();
    }

    makePeptide(p) {
        let px = P.vecX(p);
        let py = P.vecY(p);
        if (this.tileX) px = P.mod(px, P.one());
        if (this.tileY) py = P.mod(py, P.one());
        if (this.mirrorX) px = P.sub(P.one(), px);
        if (this.mirrorY) py = P.sub(P.one(), py);
        let d = P.texture2d(this.uniformTexture2d("texture2d"), P.vec3(px, py, P.zero()));

        if (this.invert) d = P.neg(d);

        const zdist = P.sub(P.abs(P.vecZ(p)), P.const(0.005));
        const dist3d = P.vlength(P.vec3(zdist, P.max(d, P.zero()), P.zero()));

        return P.struct({
            distance: P.mix(d, dist3d, P.step(P.zero(), zdist))
        });
    }
}

// Detect environment and export accordingly
(function() {
    const nodes = { ImageNode };
    
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

