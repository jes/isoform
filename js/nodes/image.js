class ImageNode extends TreeNode {
    constructor(name, data, dimensions, interpolation = 'linear') {
        super("Image");
        this.name = name;
        this.data = data;
        this.dimensions = dimensions;
        this.interpolation = interpolation;
        this.texture2d = new Texture2D(data, dimensions, interpolation);
        this.invert = false;
    }

    properties() {
        return {"invert": "bool"};
    }

    is2d() {
        return true;
    }

    aabb() {
        return new AABB(0, 0, this.dimensions[0], this.dimensions[1]);
    }

    makePeptide(p) {
        let d = P.texture2d(this.uniformTexture2d("texture2d"), P.vec3(P.mod(P.vecX(p), P.one()), P.mod(P.neg(P.vecY(p)), P.one()), P.zero()));

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

