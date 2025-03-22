const glslIntervalLibrary = `
// Interval arithmetic implementation
// ifloat is vec2(min, max)
// ivec3 is mat3 where each column represents min/max for x,y,z components
// inspired by https://www.shadertoy.com/view/lssSWH

#define ifloat vec2
#define ivec3 mat3

// Basic arithmetic operations for intervals
ifloat iadd(ifloat a, ifloat b) {
    return ifloat(a.x + b.x, a.y + b.y);
}

ifloat isub(ifloat a, ifloat b) {
    return ifloat(a.x - b.y, a.y - b.x);
}

ifloat imul(ifloat a, ifloat b) {
    float p1 = a.x * b.x;
    float p2 = a.x * b.y;
    float p3 = a.y * b.x;
    float p4 = a.y * b.y;
    return ifloat(min(min(p1, p2), min(p3, p4)),
                max(max(p1, p2), max(p3, p4)));
}

ifloat idiv(ifloat a, ifloat b) {
    // Assuming b doesn't contain 0
    return imul(a, ifloat(1.0/b.y, 1.0/b.x));
}

ifloat ineg(ifloat a) {
    return ifloat(-a.y, -a.x);
}

// Min/Max operations
ifloat imin(ifloat a, ifloat b) {
    return ifloat(min(a.x, b.x), min(a.y, b.y));
}

ifloat imax(ifloat a, ifloat b) {
    return ifloat(max(a.x, b.x), max(a.y, b.y));
}

// Absolute value for intervals
ifloat iabs(ifloat a) {
    if (a.x >= 0.0) return a;
    if (a.y <= 0.0) return ifloat(-a.y, -a.x);
    return ifloat(0.0, max(-a.x, a.y));
}

// Square root for intervals
ifloat isqrt(ifloat a) {
    return ifloat(sqrt(max(0.0, a.x)), sqrt(max(0.0, a.y)));
}

// Operations on interval vectors (ivec3)
ivec3 iadd3(ivec3 a, ivec3 b) {
    return mat3(
        iadd(a[0].xy, b[0].xy), 0.0,
        iadd(a[1].xy, b[1].xy), 0.0,
        iadd(a[2].xy, b[2].xy), 0.0
    );
}

ivec3 isub3(ivec3 a, ivec3 b) {
    return ivec3(
        isub(a[0].xy, b[0].xy), 0.0,
        isub(a[1].xy, b[1].xy), 0.0,
        isub(a[2].xy, b[2].xy), 0.0
    );
}

ivec3 imul3(ivec3 a, ifloat s) {
    return ivec3(
        imul(a[0].xy, s), 0.0,
        imul(a[1].xy, s), 0.0,
        imul(a[2].xy, s), 0.0
    );
}

ivec3 idiv3(ivec3 a, ifloat s) {
    return ivec3(
        idiv(a[0].xy, s), 0.0,
        idiv(a[1].xy, s), 0.0,
        idiv(a[2].xy, s), 0.0
    );
}

// Dot product for interval vectors
ifloat idot3(ivec3 a, ivec3 b) {
    return iadd(iadd(
        imul(a[0].xy, b[0].xy),
        imul(a[1].xy, b[1].xy)),
        imul(a[2].xy, b[2].xy)
    );
}

// Length of interval vector
ifloat ilength3(ivec3 v) {
    return isqrt(idot3(v, v));
}

ivec3 itov3(vec3 v) {
    return ivec3(
        vec3(v.x, v.x, 0.0),
        vec3(v.y, v.y, 0.0),
        vec3(v.z, v.z, 0.0)
    );
}

// Cross product for interval vectors
ivec3 icross3(ivec3 a, ivec3 b) {
    return ivec3(
        isub(imul(a[1].xy, b[2].xy), imul(a[2].xy, b[1].xy)), 0.0,
        isub(imul(a[2].xy, b[0].xy), imul(a[0].xy, b[2].xy)), 0.0,
        isub(imul(a[0].xy, b[1].xy), imul(a[1].xy, b[0].xy)), 0.0
    );
}
`;

(function() {
    const nodes = { glslIntervalLibrary };
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            Object.assign(module.exports, nodes);
        } else {
            Object.keys(nodes).forEach(key => {
                exports[key] = nodes[key];
            });
        }
    } else if (typeof window !== 'undefined') {
        Object.keys(nodes).forEach(key => {
            window[key] = nodes[key];
        });
    }
})();