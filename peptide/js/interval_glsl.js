const glslIntervalCode = `
// inspired by https://www.shadertoy.com/view/lssSWH

#define ifloat vec2
#define ivec3 mat3

ifloat iadd(ifloat a, ifloat b) {
    return a + b;
}

ifloat isub(ifloat a, ifloat b) {
    return a - b;
}

ifloat imul(ifloat a, ifloat b) {
    return ((a < 0.0) ? b.yx : b) * a;
}

ifloat isqr(ifloat a) {
    if (a.x < 0.0) {
        return ifloat(0.0, max(a.x*a.x, a.y*a.y));
    }
    return ifloat(a.x*a.x, a.y*a.y);
}

ifloat idiv(ifloat a, ifloat b) {
    vec4 f = vec4(a.x/b, a.y/b);
    return ifloat(
        min(min(f[0],f[1]),min(f[2],f[3])),
        max(max(f[0],f[1]),max(f[2],f[3]))
    );
}

`;

// Make it available globally or as a module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = fragmentShaderSource;
} else {
    window.fragmentShaderSource = fragmentShaderSource;
} 