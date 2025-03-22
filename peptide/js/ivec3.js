class Ivec3 {
    constructor(x, y, z) {
        if (typeof x === 'number') {
           x = new Ifloat(x);
        } else if (!(x instanceof Ifloat)) {
            throw new Error('Invalid x value');
        }
        if (typeof y === 'number') {
            y = new Ifloat(y);
        } else if (!(y instanceof Ifloat)) {
            throw new Error('Invalid y value');
        }
        if (typeof z === 'number') {
            z = new Ifloat(z);
        } else if (!(z instanceof Ifloat)) {
            throw new Error('Invalid z value');
        }
        this.x = x;
        this.y = y;
        this.z = z;
    }

    add(v) {
        return new Ivec3(this.x.add(v.x), this.y.add(v.y), this.z.add(v.z));
    }

    sub(v) {
        return new Ivec3(this.x.sub(v.x), this.y.sub(v.y), this.z.sub(v.z));
    }

    mul(k) {
        if (k instanceof Ifloat) {
            return new Ivec3(this.x.mul(k), this.y.mul(k), this.z.mul(k));
        } else if (typeof k === 'number') {
            return new Ivec3(this.x.mul(new Ifloat(k)), this.y.mul(new Ifloat(k)), this.z.mul(new Ifloat(k)));
        } else {
            throw new Error('Invalid multiplier type');
        }
    }

    div(k) {
        if (k instanceof Ifloat) {
            return new Ivec3(this.x.div(k), this.y.div(k), this.z.div(k));
        } else if (typeof k === 'number') {
            return new Ivec3(this.x.div(new Ifloat(k)), this.y.div(new Ifloat(k)), this.z.div(new Ifloat(k)));
        } else {
            throw new Error('Invalid divisor type');
        }
    }

    mod(k) {
        if (k instanceof Ifloat) {
            return new Ivec3(this.x.mod(k), this.y.mod(k), this.z.mod(k));
        } else if (typeof k === 'number') {
            return new Ivec3(this.x.mod(new Ifloat(k)), this.y.mod(new Ifloat(k)), this.z.mod(new Ifloat(k)));
        } else {
            throw new Error('Invalid modulus type');
        }
    }

    length() {
        // sqrt(x^2 + y^2 + z^2)
        return this.x.mul(this.x).add(this.y.mul(this.y)).add(this.z.mul(this.z)).sqrt();
    }

    abs() {
        return new Ivec3(this.x.abs(), this.y.abs(), this.z.abs());
    }

    min(v) {
        const minx = Math.min(this.x.min, v.x.min);
        const miny = Math.min(this.y.min, v.y.min);
        const minz = Math.min(this.z.min, v.z.min);
        return new Ivec3(new Ifloat(minx), new Ifloat(miny), new Ifloat(minz));
    }

    max(v) {
        const maxx = Math.max(this.x.min, v.x.min);
        const maxy = Math.max(this.y.min, v.y.min);
        const maxz = Math.max(this.z.min, v.z.min);
        return new Ivec3(new Ifloat(maxx), new Ifloat(maxy), new Ifloat(maxz));
    }

    dot(v) {
        return this.x.mul(v.x).add(this.y.mul(v.y)).add(this.z.mul(v.z));
    }

    cross(v) {
        return new Ivec3(
            this.y.mul(v.z).sub(this.z.mul(v.y)),
            this.z.mul(v.x).sub(this.x.mul(v.z)),
            this.x.mul(v.y).sub(this.y.mul(v.x))
        );
    }

    normalize() {
        const len = this.length();
        return this.div(len);
    }

    distanceTo(v) {
        return this.sub(v).length();
    }

    xy() {
        return new Ivec3(this.x, this.y, new Ifloat(0.0));
    }

    xz() {
        return new Ivec3(this.x, new Ifloat(0.0), this.z);
    }

    yz() {
        return new Ivec3(new Ifloat(0.0), this.y, this.z);
    }
}

// Detect environment and export accordingly
(function() {
    const nodes = { Ivec3 };
    
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
