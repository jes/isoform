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
    
    for (int i = 0; i < 100; i++) {
        float d = map(p);
        
        // Track minimum distance encountered
        result.minDistance = min(result.minDistance, d);
        
        if (d < 0.001) {
            result.hit = true;
            result.hitPosition = p;
            break;
        }

        p += rd * d;
        
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
    
    for (int i = 0; i < 100; i++) {
        float d = map_secondary(p);
        
        // Track minimum distance encountered
        result.minDistance = min(result.minDistance, d);
        
        if (d < 0.001) {
            result.hit = true;
            result.hitPosition = p;
            break;
        }

        p += rd * d;
        
        if (result.distance > 1000000.0) break;
        result.distance += d;
    }
    
    return result;
}



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
    float t = marchResult.distance;
    
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
        float t_secondary = marchResult_secondary.distance;

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
    
    gl_FragColor = vec4(color, 1.0);
}
`;

// Make it available globally or as a module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = fragmentShaderSource;
} else {
    window.fragmentShaderSource = fragmentShaderSource;
} 