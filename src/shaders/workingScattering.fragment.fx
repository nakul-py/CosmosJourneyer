precision highp float;

#define PI 3.1415926535897932
#define VIEW_POINTS 10
#define OPTICAL_DEPTH_POINTS 10

// uniforms
uniform sampler2D textureSampler; // the original screen texture
uniform sampler2D depthSampler;

uniform mat4 world;

uniform vec3 sunPosition; // position of the sun in world space
uniform vec3 cameraPosition; // position of the camera in world space

uniform mat4 projection; // camera's projection matrix
uniform mat4 view; // camera's view matrix
uniform mat4 transform;

uniform float cameraNear; // camera minZ
uniform float cameraFar; // camera maxZ
uniform vec3 cameraDirection;

uniform vec3 planetPosition; // planet position in world space
uniform float planetRadius;
uniform float atmosphereRadius;

uniform float falloffFactor; // controls exponential opacity falloff
uniform float sunIntensity; // controls atmosphere overall brightness
uniform float scatteringStrength; // controls color dispersion

uniform float redWaveLength;
uniform float greenWaveLength;
uniform float blueWaveLength;

varying vec2 vUV; // screen coordinates

float remap(float value, float low1, float high1, float low2, float high2) {
    return low2 + (value - low1) * (high2 - low2) / (high1 - low1);
}

vec3 _ScreenToWorld(vec3 pos) {
    vec4 posP = vec4(pos.xyz * 2.0 - 1.0, 1.0);
    vec4 posVS = inverse(projection) * posP;
    vec4 posWS = inverse(view) * vec4((posVS.xyz / posVS.w), 1.0);
    return posWS.xyz;
}

vec3 sspos(vec2 pos) {
    vec4 posP = vec4(pos.xy * 2.0 - 1.0, 1.0, 1.0);
    vec4 posVS = inverse(projection) * posP;
    vec4 posWS = inverse(view) * vec4((posVS.xyz / posVS.w), 1.0);
    return posWS.xyz;
}

bool rayIntersectSphere(vec3 rayOrigin, vec3 rayDir, vec3 spherePosition, float sphereRadius, out float t0, out float t1) {
    vec3 oc = rayOrigin - spherePosition; // rayOrigin in sphere space

    float a = 1.0;
    float b = 2.0 * dot(oc, rayDir);
    float c = dot(oc, oc) - sphereRadius*sphereRadius;
    
    float d = b*b - 4.0*a*c;

    if(d <= 0.0) {
        return false;
    }

    float r0 = (-b - sqrt(d)) / (2.0*a);
    float r1 = (-b + sqrt(d)) / (2.0*a);

    t0 = min(r0, r1);
    t1 = max(r0, r1);

    return (t1 >= 0.0);
}

// based on https://www.youtube.com/watch?v=DxfEbulyFcY by Sebastian Lague
float densityAtPoint(vec3 densitySamplePoint) {
    float heightAboveSurface = length(densitySamplePoint - planetPosition) - planetRadius;
    float height01 = heightAboveSurface / (atmosphereRadius - planetRadius);
    float localDensity = exp(-height01 * falloffFactor) * (1.0 - height01);

    return localDensity;
}

float opticalDepth(vec3 rayOrigin, vec3 rayDir, float rayLength) {
    vec3 densitySamplePoint = rayOrigin;
    float stepSize = rayLength / (float(OPTICAL_DEPTH_POINTS) - 1.0);
    float accumulatedOpticalDepth = 0.0;

    for(int i = 0 ; i < OPTICAL_DEPTH_POINTS ; i++) {
        float localDensity = densityAtPoint(densitySamplePoint);

        accumulatedOpticalDepth += localDensity * stepSize;

        densitySamplePoint += rayDir * stepSize;
    }

    return accumulatedOpticalDepth;
}

vec3 calculateLight(vec3 rayOrigin, vec3 rayDir, float rayLength) {
    vec3 inScatterPoint = rayOrigin;
    vec3 sunDir = normalize(sunPosition - inScatterPoint);
    
    vec3 wavelength = vec3(redWaveLength, greenWaveLength, blueWaveLength);
    vec3 scatteringCoeffs = pow(400.0 / wavelength.xyz, vec3(4.0)) * scatteringStrength;

    float stepSize = rayLength / (float(VIEW_POINTS) - 1.0);

    vec3 inScatteredLight = vec3(0.0);

    for (int i = 0 ; i < VIEW_POINTS ; i++) {

        float sunRayLength = atmosphereRadius - length(inScatterPoint - planetPosition);
        
        float sunRayOpticalDepth = opticalDepth(inScatterPoint, sunDir, sunRayLength); // scattered from the sun to the point
        float viewRayOpticalDepth = opticalDepth(inScatterPoint, -rayDir, stepSize * float(i)); // scattered from the point to the camera
        
        vec3 transmittance = exp(-(sunRayOpticalDepth + viewRayOpticalDepth) * scatteringCoeffs);
        
        float localDensity = densityAtPoint(inScatterPoint);

        inScatteredLight += localDensity * transmittance * scatteringCoeffs * stepSize;
        
        inScatterPoint += rayDir * stepSize;
    }

    //https://glossary.ametsoc.org/wiki/Rayleigh_phase_function
    float mu = dot(rayDir, sunDir);
    float phaseRayleigh = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
    
    inScatteredLight *= phaseRayleigh;
    inScatteredLight *= sunIntensity;

    return inScatteredLight;
}




vec3 scatter(vec3 originalColor, vec3 rayOrigin, vec3 rayDir, float maximumDistance) {
    float impactPoint, escapePoint;
    if (!(rayIntersectSphere(rayOrigin, rayDir, planetPosition, atmosphereRadius, impactPoint, escapePoint))) {
        return originalColor; // if not intersecting with atmosphere, return original color
    }

    /*float impactPointPlanet, escapePointPlanet;
    if(rayIntersectSphere(rayOrigin, rayDir, planetPosition, planetRadius, impactPointPlanet, escapePointPlanet)) {
        escapePoint = impactPointPlanet; // if going through planet, shorten path
    }*/

    //return vec3(maximumDistance / escapePoint) / 10.0;

    impactPoint = max(0.0, impactPoint);

    //if(escapePoint*2.0 > maximumDistance) return originalColor;

    escapePoint = min(maximumDistance, escapePoint);

    float distanceThroughAtmosphere = escapePoint - impactPoint;
    
    vec3 pointInAtmosphere = rayOrigin + rayDir * impactPoint;

    vec3 light = calculateLight(pointInAtmosphere, rayDir, distanceThroughAtmosphere);
    
    return originalColor * (1.0 - light) + light;
}


void main() {
    vec4 colorSample = texture2D(textureSampler, vUV);

    vec3 originalColor = colorSample.rgb;


    float z = texture2D(depthSampler, vUV).r;
    vec3 posWS = _ScreenToWorld(vec3(vUV, 0.0));

    vec3 rayDir = normalize(posWS - cameraPosition);

    vec3 point = (posWS - cameraPosition) * remap(z, 0.0, 1.0, cameraNear, cameraFar);
    
    float maximumDistance = length(point);

    vec3 color = scatter(originalColor, cameraPosition, rayDir, maximumDistance);

    gl_FragColor = vec4(color, 1.0);
}