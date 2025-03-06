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

// Draw axis indicator in the bottom right corner
vec4 drawAxisIndicator(vec2 uv) {
    // Position in bottom right corner
    vec2 axisCenter = vec2(0.93, 0.07); // Position in normalized coordinates
    float axisSize = 0.05; // Size of the axis indicator
    
    // Check if we're in the axis indicator area
    if (distance(uv, axisCenter) > axisSize * 1.5) {
        return vec4(0.0, 0.0, 0.0, 0.0); // Not in axis area, return transparent
    }
    
    // Create axis directions (apply the same rotation as the scene)
    vec3 xAxis = normalize(rotatePoint(vec3(1.0, 0.0, 0.0)));
    vec3 yAxis = normalize(rotatePoint(vec3(0.0, 1.0, 0.0)));
    vec3 zAxis = normalize(rotatePoint(vec3(0.0, 0.0, 1.0)));
    
    // Account for aspect ratio
    float aspectRatio = uResolution.x / uResolution.y;
    
    // Project 3D axes to 2D screen space with aspect ratio correction
    // Note: We invert Y because screen coordinates increase downward
    vec2 xProj = axisCenter + vec2(xAxis.x, -xAxis.y) * axisSize;
    vec2 yProj = axisCenter + vec2(yAxis.x, -yAxis.y) * axisSize;
    vec2 zProj = axisCenter + vec2(zAxis.x, -zAxis.y) * axisSize;
    
    // Adjust x-coordinates for aspect ratio
    xProj.x = axisCenter.x + (xProj.x - axisCenter.x) / aspectRatio;
    yProj.x = axisCenter.x + (yProj.x - axisCenter.x) / aspectRatio;
    zProj.x = axisCenter.x + (zProj.x - axisCenter.x) / aspectRatio;
    
    // Draw the axes as lines with smoother edges
    float lineWidth = 0.0025;
    
    // Calculate distances to each axis line
    float xDist = distance(uv - axisCenter, normalize(xProj - axisCenter) * clamp(length(uv - axisCenter), 0.0, length(xProj - axisCenter)));
    float yDist = distance(uv - axisCenter, normalize(yProj - axisCenter) * clamp(length(uv - axisCenter), 0.0, length(yProj - axisCenter)));
    float zDist = distance(uv - axisCenter, normalize(zProj - axisCenter) * clamp(length(uv - axisCenter), 0.0, length(zProj - axisCenter)));
    
    // More professional, softer colors
    vec4 red = vec4(0.8, 0.2, 0.2, 1.0);     // Softer red for x-axis
    vec4 green = vec4(0.2, 0.7, 0.3, 1.0);   // Softer green for y-axis
    vec4 blue = vec4(0.2, 0.4, 0.8, 1.0);    // Softer blue for z-axis
    
    vec4 color = vec4(0.0, 0.0, 0.0, 0.0); // Start with transparent
    
    // Draw axes with depth consideration and smooth edges
    // This ensures proper occlusion
    if (xAxis.z < yAxis.z && xAxis.z < zAxis.z) {
        if (xDist < lineWidth) color = mix(color, red, smoothstep(lineWidth, lineWidth * 0.7, xDist));
        if (yAxis.z < zAxis.z) {
            if (yDist < lineWidth) color = mix(color, green, smoothstep(lineWidth, lineWidth * 0.7, yDist));
            if (zDist < lineWidth) color = mix(color, blue, smoothstep(lineWidth, lineWidth * 0.7, zDist));
        } else {
            if (zDist < lineWidth) color = mix(color, blue, smoothstep(lineWidth, lineWidth * 0.7, zDist));
            if (yDist < lineWidth) color = mix(color, green, smoothstep(lineWidth, lineWidth * 0.7, yDist));
        }
    } else if (yAxis.z < xAxis.z && yAxis.z < zAxis.z) {
        if (yDist < lineWidth) color = mix(color, green, smoothstep(lineWidth, lineWidth * 0.7, yDist));
        if (xAxis.z < zAxis.z) {
            if (xDist < lineWidth) color = mix(color, red, smoothstep(lineWidth, lineWidth * 0.7, xDist));
            if (zDist < lineWidth) color = mix(color, blue, smoothstep(lineWidth, lineWidth * 0.7, zDist));
        } else {
            if (zDist < lineWidth) color = mix(color, blue, smoothstep(lineWidth, lineWidth * 0.7, zDist));
            if (xDist < lineWidth) color = mix(color, red, smoothstep(lineWidth, lineWidth * 0.7, xDist));
        }
    } else {
        if (zDist < lineWidth) color = mix(color, blue, smoothstep(lineWidth, lineWidth * 0.7, zDist));
        if (xAxis.z < yAxis.z) {
            if (xDist < lineWidth) color = mix(color, red, smoothstep(lineWidth, lineWidth * 0.7, xDist));
            if (yDist < lineWidth) color = mix(color, green, smoothstep(lineWidth, lineWidth * 0.7, yDist));
        } else {
            if (yDist < lineWidth) color = mix(color, green, smoothstep(lineWidth, lineWidth * 0.7, yDist));
            if (xDist < lineWidth) color = mix(color, red, smoothstep(lineWidth, lineWidth * 0.7, xDist));
        }
    }
    
    return color;
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