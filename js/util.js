function min(...args) {
    return Math.min(...args);
}

function max(...args) {
    return Math.max(...args);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

function mix(a, b, t) {
    return a + t * (b - a);
}