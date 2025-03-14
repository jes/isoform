// Export fragment shader as a string
const fragmentShaderSource = `
precision highp float;

uniform vec2 uResolution;
uniform vec3 uCameraPosition;
uniform vec3 uCameraTarget;
uniform float uCameraZoom;
uniform mat3 uRotationMatrix;
uniform bool uShowEdges;
uniform bool uShowSecondary;
uniform float stepFactor;
uniform int uMsaaSamples;
uniform bool uShowField;
uniform bool uShowSteps;

#define MAX_STEPS 500

// Apply rotation to a point using the rotation matrix
vec3 rotatePoint(vec3 p) {
    return uRotationMatrix * p;
}

// Creates a rotation matrix that rotates the z-axis to align with the given axis
mat3 rotateToAxis(vec3 axis) {
    // Handle special cases where axis is parallel to coordinate axes
    if (abs(axis.y) > 0.999999) {
        float sign = axis.y > 0.0 ? 1.0 : -1.0;
        return mat3(
            1.0, 0.0, 0.0,
            0.0, 0.0, sign,  // z -> y
            0.0, sign, 0.0  // y -> z
        );
    }
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
    // Use x-axis as reference if close to y-axis
    vec3 ref = abs(dot(z, vec3(0.0, 1.0, 0.0))) > 0.9 ? 
               vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 x = normalize(cross(ref, z));
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

// Helper function for dot product with itself
float dot2(vec2 v) {
    return dot(v, v);
}

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float smax(float a, float b, float k) {
    float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) + k * h * (1.0 - h);
}

float chmin(float a, float b, float k) {
    return min(min(a, b), (a + b - k) * 0.7071);
}

float chmax(float a, float b, float k) {
    return max(max(a, b), (a + b + k) * 0.7071);
}

// Squared distance and projection factor to a line segment
vec2 sdSqLine(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot2(ba), 0.0, 1.0);
    vec2 d = pa - ba * h;
    return vec2(dot2(d), ba.x*pa.y-ba.y*pa.x);
}

// begin scene
float map(vec3 p) {
    p = rotatePoint(p);
    return 1000.0; // this will be replaced at runtime with an SDF of the object
}
float map_secondary(vec3 p) {
    p = rotatePoint(p);
    return 1000.0; // this will be replaced at runtime with an SDF of the object
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
    
    // Sample normals at nearby points in both directions
    vec3 nx1 = calcNormal(p + vec3(offset, 0.0, 0.0));
    vec3 nx2 = calcNormal(p - vec3(offset, 0.0, 0.0));
    vec3 ny1 = calcNormal(p + vec3(0.0, offset, 0.0));
    vec3 ny2 = calcNormal(p - vec3(0.0, offset, 0.0));
    vec3 nz1 = calcNormal(p + vec3(0.0, 0.0, offset));
    vec3 nz2 = calcNormal(p - vec3(0.0, 0.0, offset));
    
    // Calculate how different these normals are from each other across each axis
    float edge = 0.0;
    edge += (1.0 - dot(nx1, nx2));
    edge += (1.0 - dot(ny1, ny2));
    edge += (1.0 - dot(nz1, nz2));
    
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
    vec3 hitPosition;  // Position of the hit
    int steps;         // Number of steps taken
};

MarchResult rayMarch(vec3 ro, vec3 rd) {
    MarchResult result;
    result.distance = 0.0;
    result.minDistance = 1000000.0;
    result.hit = false;
    result.steps = 0;

    vec3 p = ro;
    float lastD = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
        result.steps++; // Increment step counter
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
        
        if (d > lastD && result.distance > 10000.0) break;
        lastD = d;
        result.distance += d;
    }
    
    return result;
}
MarchResult rayMarch_secondary(vec3 ro, vec3 rd) {
    MarchResult result;
    result.distance = 0.0;
    result.minDistance = 1000000.0;
    result.hit = false;
    result.steps = 0;

    vec3 p = ro;
    float lastD = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
        result.steps++; // Increment step counter
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
        
        if (d > lastD && result.distance > 10000.0) break;
        lastD = d;
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
    vec3 ro = vec3(0.0, 0.0, 10.0); // Ray origin (camera position)
    vec3 target = vec3(0.0, 0.0, 0.0); // Look at point
    
    // Camera frame
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    
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

// Add this function to visualize the SDF field
vec3 visualizeField(float d) {
    d *= uCameraZoom * 3.0;
    vec3 col = (d<0.0) ? vec3(0.6,0.8,1.0) : vec3(0.9,0.6,0.3);
    col *= 1.0 - exp(-9.0*abs(d));
	col *= 1.0 + 0.2*cos(128.0*abs(d));
	col = mix( col, vec3(1.0), 1.0-smoothstep(0.0,0.05,abs(d)) );
    return col;
}

// Add this function to visualize the ray marching steps
vec3 visualizeSteps(int steps) {
    // Map steps to a color gradient
    float normalizedSteps = float(steps) / float(MAX_STEPS); // Normalize to 0-1 range
    
    // Apply exponential curve to emphasize differences in lower values
    // Using a power function: x^0.4 gives more weight to smaller values
    float weightedSteps = pow(normalizedSteps, 0.4);
    
    // Create a heat map gradient (black to white)
    vec3 color = mix(vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0), weightedSteps);
    
    return color;
}

/// Main

void main() {
    // Normalized coordinates (0.0 to 1.0)
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    
    // Final color will be the average of all samples
    vec3 finalColor = vec3(0.0);
    
    // Convert to centered coordinates (-1.0 to 1.0)
    vec2 p = (2.0 * uv - 1.0);
    // Correct aspect ratio
    p.x *= uResolution.x / uResolution.y;
    
    // Camera setup
    vec3 ro = uCameraPosition; // Ray origin (camera position)
    vec3 target = uCameraTarget; // Look at point
    
    // Camera frame
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    
    // Apply zoom - for orthographic, this scales the view size
    float zoom = uCameraZoom;

    vec3 color;
    
    if (uShowField) {
        // Field visualization mode
        // Calculate the point on the cross-section plane
        // The cross-section is parallel to the viewing plane and passes through the camera target
        
        // Calculate the point on the cross-section
        vec3 planePoint = uCameraTarget + (p.x * right + p.y * up) / zoom;
        
        // Sample the SDF at this point
        float fieldValue = map(planePoint);
        
        // Visualize the field value
        color = visualizeField(fieldValue);
    } else {
        // Regular 3D rendering mode - use the existing code
        // ORTHOGRAPHIC PROJECTION
        vec3 rd = normalize(forward);
        ro = ro + (p.x * right + p.y * up) / zoom;
        
        // Ray march to find distance
        MarchResult marchResult = rayMarch(ro, rd);
        
        // Default background color
        color = vec3(0.1, 0.1, 0.1);
        
        if (uShowSteps) {
            // Visualize steps instead of normal shading
            color = visualizeSteps(marchResult.steps);
        } else if (marchResult.hit) {
            // Calculate hit position and normal
            vec3 pos = marchResult.hitPosition;
            vec3 normal = calcNormal(pos);
            
            // Detect edges
            float edge = detectEdge(pos, normal);
            
            // Improved lighting setup with multiple light sources
            vec3 lightDir1 = normalize(vec3(0.5, 0.8, 0.6)); // Main light
            vec3 lightDir2 = normalize(vec3(-0.5, 0.3, 0.2)); // Fill light
            vec3 lightDir3 = normalize(vec3(0.0, -0.5, 0.8)); // Rim light
            
            vec3 lightColor1 = vec3(1.0, 0.98, 0.95) * 0.4; // Warm main light
            vec3 lightColor2 = vec3(0.8, 0.9, 1.0) * 0.3;   // Cool fill light
            vec3 lightColor3 = vec3(0.9, 0.9, 1.0) * 0.3;   // Subtle rim light
            
            // Ambient light
            vec3 ambient = vec3(0.15, 0.17, 0.2); // Slightly blue ambient
            
            // Diffuse lighting from multiple sources
            float diff1 = max(dot(normal, lightDir1), 0.0);
            float diff2 = max(dot(normal, lightDir2), 0.0);
            float diff3 = max(dot(normal, lightDir3), 0.0);
            
            // Specular lighting
            vec3 viewDir = normalize(ro - pos);
            vec3 halfwayDir1 = normalize(lightDir1 + viewDir);
            vec3 halfwayDir2 = normalize(lightDir2 + viewDir);
            float spec1 = pow(max(dot(normal, halfwayDir1), 0.0), 32.0);
            float spec2 = pow(max(dot(normal, halfwayDir2), 0.0), 16.0);
            
            vec3 specular = (spec1 * lightColor1 * 0.3 + spec2 * lightColor2 * 0.1);
            
            // Fresnel effect for rim lighting
            float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
            vec3 rim = fresnel * lightColor3 * 0.5;
            
            // Combine lighting components
            vec3 diffuse = diff1 * lightColor1 + diff2 * lightColor2 + diff3 * lightColor3;
            color = ambient + diffuse + specular + rim;
            
            // Apply edge highlighting
            vec3 edgeColor = vec3(1.0, 1.0, 1.0); // White edge highlight
            // Only apply edge highlighting if enabled
            float edgeMixFactor = uShowEdges ? edge * 1.5 : 0.0; // Amplify the edge effect when enabled
            color = mix(color, edgeColor, clamp(edgeMixFactor, 0.0, 1.0));
        }
        
        if (uShowSecondary) {
            MarchResult marchResult_secondary = rayMarch_secondary(ro, rd);
            
            if (marchResult_secondary.hit) {
                vec3 pos = marchResult_secondary.hitPosition;
                vec3 normal = calcNormal_secondary(pos);
                
                // Improved lighting for secondary object
                vec3 lightDir1 = normalize(vec3(0.5, 0.8, 0.6));
                vec3 lightDir2 = normalize(vec3(-0.5, 0.3, 0.2));
                
                // Ambient light
                vec3 ambient = vec3(0.2, 0.05, 0.05);
                
                // Diffuse light
                float diff1 = max(dot(normal, lightDir1), 0.0);
                float diff2 = max(dot(normal, lightDir2), 0.0);
                
                // Specular highlight
                vec3 viewDir = normalize(ro - pos);
                vec3 halfwayDir = normalize(lightDir1 + viewDir);
                float spec = pow(max(dot(normal, halfwayDir), 0.0), 32.0);
                
                // Combine lighting components for red secondary object
                vec3 secondaryColor = vec3(0.95, 0.1, 0.1) * (ambient + (diff1 * 0.7 + diff2 * 0.3)) + vec3(1.0, 0.6, 0.6) * spec * 0.3;
                
                // Blend with transparency
                float w = 0.75;
                color = secondaryColor * w + color * (1.0 - w);
            }
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