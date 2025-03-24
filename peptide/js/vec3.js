function Vec3(x, y = x, z = x) {
    this.x = x;
    this.y = y;
    this.z = z;
}

Vec3.prototype.equals = function(v) {
    return this.x === v.x && this.y === v.y && this.z === v.z;
};

Vec3.prototype.glsl = function() {
    return `vec3(${this.x.toFixed(16)}, ${this.y.toFixed(16)}, ${this.z.toFixed(16)})`;
};

Vec3.prototype.add = function(v) {
    return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z);
};

Vec3.prototype.sub = function(v) {
    return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z);
};

Vec3.prototype.mul = function(k) {
    if (k instanceof Vec3) {
        return new Vec3(this.x * k.x, this.y * k.y, this.z * k.z);
    } else {
        return new Vec3(this.x * k, this.y * k, this.z * k);
    }
};

Vec3.prototype.div = function(k) {
    return new Vec3(this.x / k, this.y / k, this.z / k);
};

Vec3.prototype.mod = function(k) {
    return new Vec3(this.x % k, this.y % k, this.z % k);
};

Vec3.prototype.length = function() {
    return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
};

Vec3.prototype.abs = function() {
    return new Vec3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z));
};

Vec3.prototype.angle = function() {
    // Returns azimuthal angle in the x-y plane from x-axis (in radians)
    return Math.atan2(this.y, this.x);
};

Vec3.prototype.elevation = function() {
    // Returns elevation angle from x-y plane (in radians)
    return Math.atan2(this.z, Math.sqrt(this.x*this.x + this.y*this.y));
};

Vec3.prototype.min = function(v) {
    return new Vec3(Math.min(this.x, v.x), Math.min(this.y, v.y), Math.min(this.z, v.z));
};

Vec3.prototype.max = function(v) {
    return new Vec3(Math.max(this.x, v.x), Math.max(this.y, v.y), Math.max(this.z, v.z));
};

Vec3.prototype.rotate = function(theta, axis) {
    // Rotate around specified axis by theta radians
    // axis should be 'x', 'y', or 'z'
    let x = this.x, y = this.y, z = this.z;
    switch(axis.toLowerCase()) {
        case 'x':
            return new Vec3(
                x,
                y * Math.cos(theta) - z * Math.sin(theta),
                y * Math.sin(theta) + z * Math.cos(theta)
            );
        case 'y':
            return new Vec3(
                x * Math.cos(theta) + z * Math.sin(theta),
                y,
                -x * Math.sin(theta) + z * Math.cos(theta)
            );
        case 'z':
            return new Vec3(
                x * Math.cos(theta) - y * Math.sin(theta),
                x * Math.sin(theta) + y * Math.cos(theta),
                z
            );
        default:
            throw new Error('Invalid rotation axis. Use "x", "y", or "z"');
    }
};

Vec3.prototype.dot = function(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
};

Vec3.prototype.cross = function(v) {
    return new Vec3(
        this.y * v.z - this.z * v.y,
        this.z * v.x - this.x * v.z,
        this.x * v.y - this.y * v.x
    );
};

Vec3.prototype.normalize = function() {
    const len = this.length();
    return len > 0 ? this.mul(1/len) : new Vec3(0, 0, 0);
};

Vec3.prototype.distanceTo = function(v) {
    return this.sub(v).length();
};

Vec3.prototype.angleBetween = function(v) {
    // Returns angle between two vectors in radians
    const dot = this.dot(v);
    const mags = this.length() * v.length();
    return Math.acos(Math.max(-1, Math.min(1, dot / mags)));
};

Vec3.prototype.rotateAround = function(axis, theta) {
    // Rodrigues rotation formula implementation
    // Rotates this vector around arbitrary axis by theta radians
    const k = axis.normalize();
    const cos_theta = Math.cos(theta);
    const sin_theta = Math.sin(theta);
    
    // v * cos(θ) + (k × v) * sin(θ) + k * (k · v) * (1 - cos(θ))
    return this.mul(cos_theta)
        .add(k.cross(this).mul(sin_theta))
        .add(k.mul(k.dot(this) * (1 - cos_theta)));
};

Vec3.prototype.abs = function() {
    return new Vec3(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z));
};

Vec3.prototype.xy = function() {
    return new Vec3(this.x, this.y, 0.0);
};
Vec3.prototype.xz = function() {
    return new Vec3(this.x, 0.0, this.z);
};
Vec3.prototype.yz = function() {
    return new Vec3(0.0, this.y, this.z);
};
