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

ifloat ifloor(ifloat a) {
    return ifloat(floor(a.x), floor(a.y));
}

ifloat iceil(ifloat a) {
    return ifloat(ceil(a.x), ceil(a.y));
}

ifloat imod(ifloat a, ifloat b) {
    float d1 = a.x - b.x * floor(a.x / b.x);
    float d2 = a.y - b.x * floor(a.y / b.x);
    float d3 = a.x - b.y * floor(a.x / b.y);
    float d4 = a.y - b.y * floor(a.y / b.y);
    return ifloat(min(min(d1, d2), min(d3, d4)), max(max(d1, d2), max(d3, d4)));
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

// Clamp for intervals
ifloat iclamp(ifloat a, ifloat b, ifloat c) {
    return imin(imax(a, b), c);
}

ifloat imix(ifloat a, ifloat b, ifloat c) {
    return iadd(imul(a, isub(ifloat(1.0), c)), imul(b, c));
}

ifloat istep(ifloat a, ifloat b) {
    bool canBeZero = b.x < a.y;
    bool canBeOne = b.y >= a.x;
    return ifloat(canBeZero ? 0.0 : 1.0, canBeOne ? 1.0 : 0.0);
}

ifloat isin(ifloat x) {
    // If interval spans a full period or more, return [-1, 1]
    if (x.y - x.x >= 6.2831853071795862) {
        return ifloat(-1.0, 1.0);
    }

    // Normalize start point to [0, 2π)
    float twoPI = 6.2831853071795862;
    float start = mod(x.x, twoPI);
    if (start < 0.0) start += twoPI;
    
    // Calculate end point maintaining the same interval width
    float end = start + (x.y - x.x);

    // Calculate sine at endpoints
    float sinStart = sin(start);
    float sinEnd = sin(end);

    float minVal = min(sinStart, sinEnd);
    float maxVal = max(sinStart, sinEnd);

    // Check if we cross π/2 (maximum) or 3π/2 (minimum)
    bool crossesMax = start <= 1.5707963267948966 && end >= 1.5707963267948966;
    bool crossesMin = start <= 4.7123889803846897 && end >= 4.7123889803846897;

    if (crossesMax) maxVal = 1.0;
    if (crossesMin) minVal = -1.0;

    return ifloat(minVal, maxVal);
}

ifloat icos(ifloat x) {
    // cos(x) = sin(x + π/2)
    return isin(iadd(x, ifloat(1.5707963267948966)));
}

ifloat isqr(ifloat a) {
    if (a.x >= 0.0) {
        // Interval is fully non-negative
        return ifloat(a.x*a.x, a.y*a.y);
    } 
    else if (a.y <= 0.0) {
        // Interval is fully non-positive
        return ifloat(a.y*a.y, a.x*a.x);
    }
    else {
        // Interval crosses zero
        return ifloat(0.0, max(a.x*a.x, a.y*a.y));
    }
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

ivec3 imod3(ivec3 a, ifloat s) {
    return ivec3(
        imod(a[0].xy, s), 0.0,
        imod(a[1].xy, s), 0.0,
        imod(a[2].xy, s), 0.0
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

ivec3 imin3(ivec3 a, ivec3 b) {
    return ivec3(
        imin(a[0].xy, b[0].xy), 0.0,
        imin(a[1].xy, b[1].xy), 0.0,
        imin(a[2].xy, b[2].xy), 0.0
    );
}

ivec3 imax3(ivec3 a, ivec3 b) {
    return ivec3(
        imax(a[0].xy, b[0].xy), 0.0,
        imax(a[1].xy, b[1].xy), 0.0,
        imax(a[2].xy, b[2].xy), 0.0
    );
}

ivec3 imvmul(mat3 m, ivec3 v) {
    return ivec3(
        iadd(iadd(
            imul(ifloat(m[0][0], m[0][0]), v[0].xy),
            imul(ifloat(m[1][0], m[1][0]), v[1].xy)),
            imul(ifloat(m[2][0], m[2][0]), v[2].xy)), 0.0,
        iadd(iadd(
            imul(ifloat(m[0][1], m[0][1]), v[0].xy),
            imul(ifloat(m[1][1], m[1][1]), v[1].xy)),
            imul(ifloat(m[2][1], m[2][1]), v[2].xy)), 0.0,
        iadd(iadd(
            imul(ifloat(m[0][2], m[0][2]), v[0].xy),
            imul(ifloat(m[1][2], m[1][2]), v[1].xy)),
            imul(ifloat(m[2][2], m[2][2]), v[2].xy)), 0.0
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