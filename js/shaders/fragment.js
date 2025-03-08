// Export fragment shader as a string
const fragmentShaderSource = `
precision highp float;

uniform vec2 uResolution;
uniform vec3 uCameraPosition;
uniform vec3 uCameraTarget;
uniform float uCameraZoom;
uniform float uRotationX;
uniform float uRotationY;
uniform bool uShowEdges;
uniform bool uShowSecondary;
uniform float stepFactor;

// Apply rotation to a point
vec3 rotatePoint(vec3 p) {
    // Rotate around Y axis
    float cosY = cos(uRotationY);
    float sinY = sin(uRotationY);
    p = vec3(
        p.x * cosY - p.z * sinY,
        p.y,
        p.x * sinY + p.z * cosY
    );
    
    // Rotate around X axis
    float cosX = cos(uRotationX);
    float sinX = sin(uRotationX);
    p = vec3(
        p.x,
        p.y * cosX - p.z * sinX,
        p.y * sinX + p.z * cosX
    );
    
    return p;
}

// Creates a rotation matrix that rotates the z-axis to align with the given axis
mat3 rotateToAxis(vec3 axis) {
    // Handle the special case where axis is parallel to z-axis
    if (abs(axis.z) > 0.999999) {
    float sign = axis.z > 0.0 ? 1.0 : -1.0;
    return mat3(
        1.0, 0.0, 0.0,
        0.0, 1.0, 0.0,
        0.0, 0.0, sign
    );
    }
    
    // Compute the rotation matrix using the cross product method
    vec3 z = normalize(axis);
    vec3 x = normalize(cross(vec3(0.0, 1.0, 0.0), z));
    vec3 y = cross(z, x);
    
    return mat3(x, y, z);
}

// Custom matrix transpose function
mat3 transposeMatrix(mat3 m) {
    return mat3(
    m[0][0], m[1][0], m[2][0],
    m[0][1], m[1][1], m[2][1],
    m[0][2], m[1][2], m[2][2]
    );
}

// begin scene
float map(vec3 p) {
    return 1000.0;
}
float map_secondary(vec3 p) {
    return 1000.0;
}
// end scene

// Calculate normal at a point
vec3 calcNormal(vec3 p) {
    const float eps = 0.0001;
    const vec2 h = vec2(eps, 0.0);
    return normalize(vec3(
        map(p + h.xyy) - map(p - h.xyy),
        map(p + h.yxy) - map(p - h.yxy),
        map(p + h.yyx) - map(p - h.yyx)
    ));
}
vec3 calcNormal_secondary(vec3 p) {
    const float eps = 0.0001;
    const vec2 h = vec2(eps, 0.0);
    return normalize(vec3(
        map_secondary(p + h.xyy) - map_secondary(p - h.xyy),
        map_secondary(p + h.yxy) - map_secondary(p - h.yxy),
        map_secondary(p + h.yyx) - map_secondary(p - h.yyx)
    ));
}

// Edge detection based on normal discontinuity
float detectEdge(vec3 p, vec3 normal) {
    // Calculate screen-space consistent offset based on distance from camera
    float distanceToCamera = length(p - uCameraPosition);
    float offset = 0.000005 * distanceToCamera * (1.0 / uCameraZoom);
    
    // Sample normals at nearby points
    vec3 n1 = calcNormal(p + vec3(offset, 0.0, 0.0));
    vec3 n2 = calcNormal(p + vec3(0.0, offset, 0.0));
    vec3 n3 = calcNormal(p + vec3(0.0, 0.0, offset));
    
    // Calculate how different these normals are from the center normal
    float edge = 0.0;
    edge += (1.0 - dot(normal, n1));
    edge += (1.0 - dot(normal, n2));
    edge += (1.0 - dot(normal, n3));
    
    // Normalize and apply threshold for edge detection
    edge /= 3.0;
    // Increase edge prominence by lowering the threshold and making the transition sharper
    edge = smoothstep(0.05, 0.15, edge);
    
    return edge;
}

// Ray marching
struct MarchResult {
    float distance;    // Total distance marched
    float minDistance; // Minimum distance encountered during march
    bool hit;          // Whether we hit something
    vec3 hitPosition; // Position of the hit
};

MarchResult rayMarch(vec3 ro, vec3 rd) {
    MarchResult result;
    result.distance = 0.0;
    result.minDistance = 1000000.0;
    result.hit = false;

    vec3 p = ro;
    
    for (int i = 0; i < 500; i++) {
        float d = map(p);
        
        // Track minimum distance encountered
        result.minDistance = min(result.minDistance, d);

        if (d < 0.0) {
            result.hit = true;
            result.hitPosition = p;
            break;
        }
        
        d = max(0.001, d);

        p += rd * d * stepFactor;
        
        if (result.distance > 1000000.0) break;
        result.distance += d;
    }
    
    return result;
}
MarchResult rayMarch_secondary(vec3 ro, vec3 rd) {
    MarchResult result;
    result.distance = 0.0;
    result.minDistance = 1000000.0;
    result.hit = false;

    vec3 p = ro;
    
    for (int i = 0; i < 500; i++) {
        float d = map_secondary(p);
        
        // Track minimum distance encountered
        result.minDistance = min(result.minDistance, d);

        if (d < 0.0) {
            result.hit = true;
            result.hitPosition = p;
            break;
        }
        
        d = max(0.001, d);

        p += rd * d * stepFactor;
        
        if (result.distance > 1000000.0) break;
        result.distance += d;
    }
    
    return result;
}

/// Axis indicators
//
// This creates the axis indicator display as an SDF because
// somehow I'm not smart enough to find the analytical solution
// to draw the axes correctly. This wants fixing.
// Also, does this respect the aspect ratio?

float map_axis(vec3 p, vec3 axis) {
    p = rotatePoint(p);
    float h = clamp(dot(p,axis)/dot(axis,axis), 0.0, 1.0);
    return length(p - axis * h) - 0.01;
}
float raymarch_axis(vec3 ro, vec3 rd, vec3 axis) {
    for (int i = 0; i < 100; i++) {
        float d = map_axis(ro, axis);
        if (d < 0.001) {
            return d;
        }
        ro += rd * d;
    }
    return 1000.0;
}
vec4 drawAxisIndicator(vec2 uv) {
    vec2 axisCentre = vec2(0.05, 0.05);
    vec2 axisSize = vec2(0.1, 0.1);

    uv -= axisCentre;
    uv /= axisSize;

    // if uv is outside axis indicator, return black
    if (uv.x < -0.5 || uv.x > 0.5 || uv.y < -0.5 || uv.y > 0.5) {
        return vec4(0.0, 0.0, 0.0, 0.0);
    }

    // Camera setup
    vec3 ro = vec3(0.0, 0.0, -10.0); // Ray origin (camera position)
    vec3 target = vec3(0.0, 0.0, 0.0); // Look at point
    
    // Camera frame
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    
    // Apply zoom - for orthographic, this scales the view size
    float zoom = uCameraZoom;
    
    // ORTHOGRAPHIC PROJECTION
    // In orthographic projection, all rays are parallel to the forward direction
    // The ray origin is offset based on the screen coordinates
    vec3 rd = normalize(forward);
    // Adjust the ray origin based on screen position and zoom
    ro = ro + (uv.x * right + uv.y * up);

    vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

    // Ray march to find distance
    float length = 0.4;
    float dx = raymarch_axis(ro, rd, length * vec3(1.0, 0.0, 0.0));
    float dy = raymarch_axis(ro, rd, length * vec3(0.0, 1.0, 0.0));
    float dz = raymarch_axis(ro, rd, length * vec3(0.0, 0.0, 1.0));

    if (dx < 1000.0) color += vec4(1.0, 0.0, 0.0, 1.0);
    if (dy < 1000.0) color += vec4(0.0, 1.0, 0.0, 1.0);
    if (dz < 1000.0) color += vec4(0.0, 0.0, 1.0, 1.0);

    return color;
}

/// Main

void main() {
    // Normalized coordinates (0.0 to 1.0)
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    
    // Convert to centered coordinates (-1.0 to 1.0)
    vec2 p = (2.0 * uv - 1.0);
    // Correct aspect ratio
    p.x *= uResolution.x / uResolution.y;
    
    // Camera setup
    vec3 ro = uCameraPosition; // Ray origin (camera position)
    vec3 target = uCameraTarget; // Look at point
    
    // Camera frame
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
    vec3 up = cross(forward, right);
    
    // Apply zoom - for orthographic, this scales the view size
    float zoom = uCameraZoom;
    
    // ORTHOGRAPHIC PROJECTION
    // In orthographic projection, all rays are parallel to the forward direction
    // The ray origin is offset based on the screen coordinates
    vec3 rd = normalize(forward);
    // Adjust the ray origin based on screen position and zoom
    ro = ro + (p.x * right + p.y * up) / zoom;
    
    // Ray march to find distance
    MarchResult marchResult = rayMarch(ro, rd);
    
    // Default background color
    vec3 color = vec3(0.1, 0.1, 0.1);
    
    // If we hit something
    if (marchResult.hit) {
        // Calculate hit position and normal
        vec3 pos = marchResult.hitPosition;
        vec3 normal = calcNormal(pos);
        
        // Detect edges
        float edge = detectEdge(pos, normal);
        
        // Lighting setup
        vec3 lightDir = vec3(0.0, 0.0, -1.0);
        
        // Ambient light
        vec3 ambient = vec3(0.1);
        
        // Diffuse light
        float diff = max(dot(normal, lightDir), 0.0);
        // Soft shadows
        vec3 diffuse = vec3(0.4) * diff;
        
        // Combine lighting components
        color = ambient + diffuse;
        
        // Apply edge highlighting
        vec3 edgeColor = vec3(1.0, 1.0, 1.0); // White edge highlight
        // Only apply edge highlighting if enabled
        float edgeMixFactor = uShowEdges ? edge * 1.5 : 0.0; // Amplify the edge effect when enabled
        color = mix(color, edgeColor, clamp(edgeMixFactor, 0.0, 1.0));
    }

    if (uShowSecondary) {
        MarchResult marchResult_secondary = rayMarch_secondary(ro, rd);

        if (marchResult_secondary.hit) {
            // Calculate hit position and normal
            vec3 pos = marchResult_secondary.hitPosition;
            vec3 normal = calcNormal_secondary(pos);
            
            // Lighting setup
            vec3 lightDir = vec3(0.0, 0.0, -1.0);
            
            // Ambient light
            vec3 ambient = vec3(0.1);
            
            // Diffuse light
            float diff = max(dot(normal, lightDir), 0.0);
            // Soft shadows
            vec3 diffuse = vec3(0.4) * diff;
            
            // Combine lighting components
            float w = 0.75;
            vec3 secondaryColor = vec3(0.95,0.0,0.0) * (ambient + diffuse);
            color = secondaryColor * w + color * (1.0 - w);
        }
    }
    
    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    // Draw axis indicator on top of the scene
    vec4 axisColor = drawAxisIndicator(uv);
    // Blend the axis indicator with the scene using alpha blending
    color = mix(color, axisColor.rgb, axisColor.a);
    
    gl_FragColor = vec4(color, 1.0);
}
`;

// Make it available globally or as a module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = fragmentShaderSource;
} else {
    window.fragmentShaderSource = fragmentShaderSource;
} 