// Export fragment shader as a string
const fragmentShaderSource = `#version 300 es

precision highp float;

uniform vec2 uResolution;
uniform vec3 uCameraPosition;
uniform vec3 uCameraTarget;
uniform float uCameraZoom;
uniform mat3 uRotationMatrix;
uniform bool uShowEdges;
uniform float uStepFactor;
uniform bool uShowField;
uniform bool uShowSteps;
uniform float uOpacity;
uniform vec3 uObjectColor;

#define MAX_STEPS 500

float mapsign = 1.0;

// begin scene
float map(vec3 p) {
    p = uRotationMatrix * p;
    return 1000.0; // this will be replaced at runtime with an SDF of the object
}
// end scene

// Calculate normal at a point
vec4 calcNormalAndEdge(vec3 p, float d) {
    float distanceToCamera = length(p - uCameraPosition);
    float offset = 0.00001 * distanceToCamera * (1.0 / uCameraZoom);

    vec2 h = vec2(offset, 0.0);
    
    // Get SDF values at offset points
    float dx1 = mapsign * map(p + h.xyy);
    float dx2 = mapsign * map(p - h.xyy);
    float dy1 = mapsign * map(p + h.yxy);
    float dy2 = mapsign * map(p - h.yxy);
    float dz1 = mapsign * map(p + h.yyx);
    float dz2 = mapsign * map(p - h.yyx);

    // Calculate normal using central differences
    vec3 normal = normalize(vec3(
        dx1 - dx2,
        dy1 - dy2,
        dz1 - dz2
    ));

    // Calculate second derivatives (mathematically correct)
    float dxx = (dx1 - 2.0 * d + dx2) / (offset * offset);
    float dyy = (dy1 - 2.0 * d + dy2) / (offset * offset);
    float dzz = (dz1 - 2.0 * d + dz2) / (offset * offset);
    
    // Calculate edge factor based on second derivatives
    float edge = sqrt(dxx * dxx + dyy * dyy + dzz * dzz);
    
    // Scale edge factor - note the different scale factor to compensate for offset division
    edge = smoothstep(0.004, 0.005, edge * offset * offset * uCameraZoom);
    
    return vec4(normal, edge);
}

// Ray marching
struct MarchResult {
    float distance;    // Total distance marched
    float minDistance; // Minimum distance encountered during march
    bool hit;          // Whether we hit something
    vec3 hitPosition;  // Position of the hit
    int steps;         // Number of steps taken
    float sdf;         // SDF value at the hit position
};

MarchResult rayMarch(vec3 ro, vec3 rd) {
    MarchResult result;
    result.distance = 0.0;
    result.minDistance = 1000000.0;
    result.hit = true;
    result.steps = 0;

    vec3 p = ro;
    float lastD = 0.0;
    for (int i = 0; i < MAX_STEPS; i++) {
        result.steps++; // Increment step counter
        float d = mapsign * map(p);
        
        // Track minimum distance encountered
        result.minDistance = min(result.minDistance, d);

        if (d < 0.0) {
            result.hit = true;
            result.hitPosition = p;
            result.sdf = d;
            break;
        }
        
        d = max(0.001, d);

        p += rd * d * uStepFactor;
        
        if (d > lastD && result.distance > 10000.0) {
            result.hit = false;
            break;
        }
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
    p = uRotationMatrix * p;
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

// Add fog calculation function
vec3 applyFog(vec3 color, int steps, vec3 fogColor) {
    float fogFactor = float(steps) / float(MAX_STEPS);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    return mix(color, fogColor, fogFactor);
}

/// Main

struct OrthoProjectionResult {
    vec3 color;
    float distance;
    vec3 hitPosition;
    bool hit;
};

OrthoProjectionResult orthoProjection(vec3 ro, vec3 rd, vec3 right, vec3 up, float zoom) {
    // Ray march to find distance
    MarchResult marchResult = rayMarch(ro, rd);
    
    OrthoProjectionResult result;
    result.color = vec3(0.1, 0.1, 0.1);
    result.distance = marchResult.distance;
    result.hitPosition = marchResult.hitPosition;
    result.hit = marchResult.hit;

    if (uShowSteps) {
        // Visualize steps instead of normal shading
        result.color = visualizeSteps(marchResult.steps);
    } else if (marchResult.hit) {
        // Calculate hit position and normal
        vec3 pos = marchResult.hitPosition;
        vec4 normalAndEdge = calcNormalAndEdge(pos, marchResult.sdf);
        vec3 normal = normalAndEdge.xyz;
        float edge = normalAndEdge.w;
        
        // Improved lighting setup with multiple light sources
        vec3 lightDir1 = normalize(vec3(0.5, 0.8, 0.6)); // Main light
        vec3 lightDir2 = normalize(vec3(-0.5, 0.3, 0.2)); // Fill light
        vec3 lightDir3 = normalize(vec3(0.0, -0.5, -0.8)); // Rim light
        
        vec3 lightColor1 = vec3(1.0, 0.98, 0.95); // Warm main light
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
        result.color = (ambient + diffuse + specular + rim) * uObjectColor;
        
        // Apply edge highlighting
        vec3 edgeColor = vec3(1.0, 1.0, 1.0); // White edge highlight
        // Only apply edge highlighting if enabled
        float edgeMixFactor = uShowEdges ? edge * 1.5 : 0.0; // Amplify the edge effect when enabled
        result.color = mix(result.color, edgeColor, clamp(edgeMixFactor, 0.0, 1.0));
        
        // Apply fog based on step count
        vec3 fogColor = vec3(0.9, 0.9, 0.9);
        result.color = applyFog(result.color, marchResult.steps, fogColor);
    }

    return result;
}

out vec4 fragColor;

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
        fragColor = vec4(color, 1.0);
    } else {
        // Regular 3D rendering mode - use the existing code
        // ORTHOGRAPHIC PROJECTION
        vec3 rd = normalize(forward);
        ro = ro + (p.x * right + p.y * up) / zoom;
        
        // Use vec4 for proper alpha accumulation
        vec4 accumulatedColor = vec4(0.0, 0.0, 0.0, 0.0);
        
        mapsign = 1.0;
        OrthoProjectionResult orthoResult = orthoProjection(ro, rd, right, up, zoom);
        
        // Front-to-back compositing for transparency
        for (int i = 0; i < 10; i++) {
            if (!orthoResult.hit || accumulatedColor.a >= 0.99) break;
            
            // Calculate this layer's contribution with alpha
            vec4 layerColor = vec4(orthoResult.color, uOpacity);
            
            // Front-to-back alpha compositing
            float a = layerColor.a * (1.0 - accumulatedColor.a);
            
            // Add weighted contribution to accumulated color
            accumulatedColor.rgb += layerColor.rgb * a;
            
            // Update accumulated alpha
            accumulatedColor.a += a;
            
            // Advance ray to next intersection
            mapsign = -mapsign;
            orthoResult = orthoProjection(orthoResult.hitPosition, rd, right, up, zoom);
        }
        
        // Gamma correction
        color = pow(accumulatedColor.rgb, vec3(1.0 / 2.2));
        
        // Draw axis indicator on top of the scene
        vec4 axisColor = drawAxisIndicator(uv);
        
        // Blend the axis indicator with the scene using alpha blending
        color = mix(color, axisColor.rgb, axisColor.a);
        
        // Use the accumulated alpha for the final color
        fragColor = vec4(color, accumulatedColor.a);
    }
}
`;

// Make it available globally or as a module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = fragmentShaderSource;
} else {
    window.fragmentShaderSource = fragmentShaderSource;
} 