function Mat3(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
    if (arguments.length === 9) {
        // Initialize with 9 individual values
        this.m = [
            [m00, m01, m02],
            [m10, m11, m12],
            [m20, m21, m22]
        ];
    } else if (arguments.length === 3) {
        // Initialize with 3 Vec3 column vectors
        const v1 = arguments[0];
        const v2 = arguments[1];
        const v3 = arguments[2];
        this.m = [
            [v1.x, v2.x, v3.x],
            [v1.y, v2.y, v3.y],
            [v1.z, v2.z, v3.z]
        ];
    } else {
        // Default to identity matrix
        this.m = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ];
    }
}

Mat3.prototype.glsl = function() {
    return `mat3(
        ${this.m[0][0].toFixed(16)}, ${this.m[1][0].toFixed(16)}, ${this.m[2][0].toFixed(16)},
        ${this.m[0][1].toFixed(16)}, ${this.m[1][1].toFixed(16)}, ${this.m[2][1].toFixed(16)},
        ${this.m[0][2].toFixed(16)}, ${this.m[1][2].toFixed(16)}, ${this.m[2][2].toFixed(16)}
    )`;
};

Mat3.prototype.rotateToAxis = function(axis) {
    // Handle the special case where axis is parallel to coordinate axes
    if (Math.abs(axis.y) > 0.999999) {
        const sign = axis.y > 0.0 ? 1.0 : -1.0;
        return new Mat3(
            1.0, 0.0, 0.0,
            0.0, 0.0, sign,
            0.0, sign, 0.0
        );
    }
    if (Math.abs(axis.z) > 0.999999) {
        const sign = axis.z > 0.0 ? 1.0 : -1.0;
        return new Mat3(
            1.0, 0.0, 0.0,
            0.0, 1.0, 0.0,
            0.0, 0.0, sign
        );
    }
    
    // Compute the rotation matrix using the cross product method
    const z = axis.normalize();
    const ref = Math.abs(z.dot(new Vec3(0.0, 1.0, 0.0))) > 0.9 ? 
        new Vec3(1.0, 0.0, 0.0) : new Vec3(0.0, 1.0, 0.0);

    const x = ref.cross(z).normalize();
    const y = z.cross(x);

    return new Mat3(x, y, z);
};

// Custom matrix transpose function
Mat3.prototype.transpose = function() {
    return new Mat3(
        this.m[0][0], this.m[1][0], this.m[2][0],
        this.m[0][1], this.m[1][1], this.m[2][1],
        this.m[0][2], this.m[1][2], this.m[2][2]
    );
};

// Matrix multiplication with another matrix
Mat3.prototype.mul = function(other) {
    const result = new Mat3();
    
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            result.m[i][j] = 0;
            for (let k = 0; k < 3; k++) {
                result.m[i][j] += this.m[i][k] * other.m[k][j];
            }
        }
    }
    
    return result;
};

// Matrix-vector multiplication
Mat3.prototype.mulVec3 = function(v) {
    return new Vec3(
        this.m[0][0] * v.x + this.m[0][1] * v.y + this.m[0][2] * v.z,
        this.m[1][0] * v.x + this.m[1][1] * v.y + this.m[1][2] * v.z,
        this.m[2][0] * v.x + this.m[2][1] * v.y + this.m[2][2] * v.z
    );
};

// Create rotation matrix around X axis
Mat3.prototype.rotateX = function(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    return new Mat3(
        1, 0, 0,
        0, c, -s,
        0, s, c
    );
};

// Create rotation matrix around Y axis
Mat3.prototype.rotateY = function(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    return new Mat3(
        c, 0, s,
        0, 1, 0,
        -s, 0, c
    );
};

// Create rotation matrix around Z axis
Mat3.prototype.rotateZ = function(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    return new Mat3(
        c, -s, 0,
        s, c, 0,
        0, 0, 1
    );
};

// Export the class
(function() {
    const nodes = { Mat3 };
    
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

