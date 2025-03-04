precision mediump float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uCameraPosition;
uniform vec3 uCameraTarget;
uniform float uCameraZoom;
uniform float uRotationX;
uniform float uRotationY;

// 3D SDF primitives
float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdPlane(vec3 p, vec3 n, float h) {
    // n must be normalized
    return dot(p, n) + h;
}

// SDF operations
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtraction(float d1, float d2) { return max(d1, -d2); }
float opIntersection(float d1, float d2) { return max(d1, d2); }

// Thickness operation - creates a shell of thickness t around the object
float opThickness(float d, float t) {
    return abs(d) - t;
}

// Smooth blend operations
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

float opSmoothSubtraction(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d1, -d2, h) + k * h * (1.0 - h);
}

float opSmoothIntersection(float d1, float d2, float k) {
    float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) + k * h * (1.0 - h);
}

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

// Scene description
float map(vec3 p) {
    // Apply rotation to the point (effectively rotating the scene)
    p = rotatePoint(p);
    
    // Animate objects
    vec3 spherePos = p - vec3(sin(uTime) * 1.5, cos(uTime * 0.5), 0.0);
    vec3 boxPos = p - vec3(0.0, sin(uTime) * 0.5, cos(uTime) * 1.5);
    vec3 torusPos = p - vec3(cos(uTime * 0.7) * 1.0, 0.0, sin(uTime * 0.5) * 1.0);
    
    // Create objects
    float sphere = sdSphere(spherePos, 1.0);
    float box = sdBox(boxPos, vec3(0.75));
    float torus = sdTorus(torusPos, vec2(1.0, 0.3));
    
    // Combine objects
    float scene = opSmoothUnion(sphere, box, 0.5);
    scene = opSmoothUnion(scene, torus, 0.5);
    
    // Add ground plane
    float ground = sdPlane(p, vec3(0.0, 1.0, 0.0), 2.0);
    scene = opUnion(scene, ground);
    
    return scene;
}

// Calculate normal at a point
vec3 calcNormal(vec3 p) {
    const float eps = 0.001;
    const vec2 h = vec2(eps, 0.0);
    return normalize(vec3(
        map(p + h.xyy) - map(p - h.xyy),
        map(p + h.yxy) - map(p - h.yxy),
        map(p + h.yyx) - map(p - h.yyx)
    ));
}

// Ray marching
float rayMarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < 0.001 || t > 20.0) break;
        t += d;
    }
    return t;
}

// Material information
struct Material {
    vec3 color;
    float metallic;
    float roughness;
};

// Get material based on position and normal
Material getMaterial(vec3 p, vec3 normal) {
    Material mat;
    
    // Default material
    mat.color = vec3(0.8);
    mat.metallic = 0.0;
    mat.roughness = 0.5;
    
    // Apply rotation to match the scene rotation
    p = rotatePoint(p);
    
    // Check if we're on the ground plane
    if (abs(p.y + 2.0) < 0.01) {
        // Checkerboard pattern for ground
        float checker = mod(floor(p.x) + floor(p.z), 2.0);
        mat.color = mix(vec3(0.2), vec3(0.4), checker);
        mat.roughness = 0.9;
        return mat;
    }
    
    // Determine which object we hit based on distance
    vec3 spherePos = p - vec3(sin(uTime) * 1.5, cos(uTime * 0.5), 0.0);
    vec3 boxPos = p - vec3(0.0, sin(uTime) * 0.5, cos(uTime) * 1.5);
    vec3 torusPos = p - vec3(cos(uTime * 0.7) * 1.0, 0.0, sin(uTime * 0.5) * 1.0);
    
    float sphereDist = sdSphere(spherePos, 1.0);
    float boxDist = sdBox(boxPos, vec3(0.75));
    float torusDist = sdTorus(torusPos, vec2(1.0, 0.3));
    
    // Find the closest object
    float minDist = min(sphereDist, min(boxDist, torusDist));
    
    // Assign material based on closest object
    if (minDist == sphereDist) {
        // Sphere material
        mat.color = vec3(1.0, 0.3, 0.2);
        mat.metallic = 0.8;
        mat.roughness = 0.2;
    } else if (minDist == boxDist) {
        // Box material
        mat.color = vec3(0.2, 0.7, 1.0);
        mat.metallic = 0.0;
        mat.roughness = 0.7;
    } else if (minDist == torusDist) {
        // Torus material
        mat.color = vec3(1.0, 0.8, 0.2);
        mat.metallic = 0.5;
        mat.roughness = 0.3;
    }
    
    return mat;
}

// Simple ambient occlusion
float calcAO(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        float d = map(p + h * n);
        occ += (h - d) * sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

// Simple soft shadows
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
    float res = 1.0;
    float t = mint;
    for (int i = 0; i < 16; i++) {
        if (t < maxt) {
            float h = map(ro + rd * t);
            res = min(res, k * h / t);
            t += h;
        }
    }
    return clamp(res, 0.0, 1.0);
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
    
    // Apply zoom
    float zoom = uCameraZoom;
    
    // Ray direction using camera frame
    vec3 rd = normalize(forward + p.x * right * zoom + p.y * up * zoom);
    
    // Ray march to find distance
    float t = rayMarch(ro, rd);
    
    // Default background color
    vec3 color = vec3(0.1, 0.1, 0.2);
    
    // If we hit something
    if (t < 20.0) {
        // Calculate hit position and normal
        vec3 pos = ro + rd * t;
        vec3 normal = calcNormal(pos);
        
        // Get material properties
        Material mat = getMaterial(pos, normal);
        
        // Lighting setup
        vec3 lightPos = vec3(5.0, 5.0, -5.0);
        vec3 lightDir = normalize(lightPos - pos);
        vec3 viewDir = normalize(ro - pos);
        vec3 halfDir = normalize(lightDir + viewDir);
        
        // Ambient light
        float ao = calcAO(pos, normal);
        vec3 ambient = vec3(0.2) * mat.color * ao;
        
        // Diffuse light
        float diff = max(dot(normal, lightDir), 0.0);
        // Soft shadows
        float shadow = softShadow(pos, lightDir, 0.1, 10.0, 8.0);
        vec3 diffuse = vec3(0.8) * diff * mat.color * shadow;
        
        // Specular light (simple Blinn-Phong)
        float spec = pow(max(dot(normal, halfDir), 0.0), 16.0 / mat.roughness);
        vec3 specular = vec3(0.8) * spec * mix(vec3(0.04), mat.color, mat.metallic) * shadow;
        
        // Fresnel effect for reflections
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 5.0);
        fresnel = mix(fresnel, 1.0, mat.metallic);
        
        // Combine lighting components
        color = ambient + diffuse + specular;
        
        // Add rim lighting
        float rim = 1.0 - max(dot(normal, viewDir), 0.0);
        rim = pow(rim, 4.0);
        color += rim * 0.2 * vec3(1.0);
        
        // Fog effect based on distance
        float fogFactor = 1.0 - exp(-0.05 * t);
        vec3 fogColor = vec3(0.1, 0.1, 0.2);
        color = mix(color, fogColor, fogFactor);
    }
    
    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));
    
    gl_FragColor = vec4(color, 1.0);
} 