precision highp float;

#ifdef LOGARITHMICDEPTH
uniform float logarithmicDepthConstant;
varying float vFragmentDepth;
#endif

varying vec3 vPositionW;
varying vec3 vNormalW;
varying vec3 vUnitSamplePoint;
varying vec3 vSphereNormalW;
varying vec3 vSamplePoint;

varying vec3 vPosition; // position of the vertex in sphere space
varying vec3 vNormal; // normal of the vertex in sphere space

uniform mat4 world;

uniform vec3 playerPosition; // camera position in world space
uniform float cameraNear;
uniform float cameraFar;
uniform vec3 sunPosition; // light position in world space
uniform vec3 planetPosition;

uniform vec3 color1;
uniform vec3 color2;
uniform float colorSharpness;

uniform float time;

uniform sampler2D textureSampler;
uniform sampler2D depthSampler; // evaluate sceneDepth

uniform float seed;

uniform float planetRadius; // planet radius

#pragma glslify: fractalSimplex4 = require(../utils/simplex4.glsl)

#pragma glslify: fastAcos = require(../utils/fastAcos.glsl)

#pragma glslify: remap = require(../utils/remap.glsl)

#pragma glslify: lerp = require(../utils/vec3Lerp.glsl)

float lerp(float value1, float value2, float x) {
    return x * value1 + (1.0 - x) * value2;
}

//https://www.desmos.com/calculator/8etk6vdfzi

float tanh01(float x) {
    return (tanh(x) + 1.0) / 2.0;
}

float tanherpFactor(float x, float s) {
    float sampleValue = (x - 0.5) * s;
    return tanh01(sampleValue);
}

vec3 tanherp(vec3 value1, vec3 value2, float x, float s) {
    float alpha = tanherpFactor(x, s);

    return lerp(value1, value2, alpha);
}

#pragma glslify: saturate = require(../utils/saturate.glsl)

#pragma glslify: tanhSharpener = require(../utils/tanhSharpener.glsl, tanh=tanh)

#pragma glslify: rotateAround = require(../utils/rotateAround.glsl)


void main() {
    vec3 viewRayW = normalize(playerPosition - vPositionW); // view direction in world space
    vec3 lightRayW = normalize(sunPosition - vPositionW); // light ray direction in world space

    vec3 sphereNormalW = vSphereNormalW;
    float ndl = max(0.002, dot(sphereNormalW, lightRayW));

    // FIXME: remove scaling
    vec4 seededSamplePoint = vec4(vUnitSamplePoint * 2.0, seed);

    seededSamplePoint.y *= 2.0;

    float cloudSpeed = 0.0005;
    vec4 seededSamplePoint2 = vec4(rotateAround(seededSamplePoint.xyz, vec3(0.0, 1.0, 0.0), time * cloudSpeed), seededSamplePoint.w);

    for(int i = 0; i < 2; i++) {
        seededSamplePoint += vec4(
            fractalSimplex4(seededSamplePoint2, 3, 2.0, 2.0),
            fractalSimplex4(seededSamplePoint2 + vec4(13.0, 37.0, -73.0, 0.0), 3, 2.0, 2.0),
            fractalSimplex4(seededSamplePoint2 + vec4(-56.0, 19.0, 47.0, 0.0), 3, 2.0, 2.0),
            0.0
        );
    }

    float value = fractalSimplex4(seededSamplePoint, 7, 1.7, 2.0);

    value = tanhSharpener(value, colorSharpness * dot(color1, color2));

    // calcul de la couleur et de la normale
    vec3 normal = vNormal;
    vec3 color = lerp(color1, color2, value);
    vec3 normalW = normalize(vec3(world * vec4(normal, 0.0)));

    // specular
    vec3 angleW = normalize(viewRayW + lightRayW);
    float specComp = max(0., dot(normalW, angleW));
    specComp = pow(specComp, 32.0);

    // TODO: finish this (uniforms...)
    /*float smoothness = 0.7;
    float specularAngle = fastAcos(dot(normalize(viewRayW + lightRayW), normalW));
    float specularExponent = specularAngle / (1.0 - smoothness);
    float specComp = exp(-specularExponent * specularExponent);*/

    // suppresion du reflet partout hors la neige
    specComp *= (color.r + color.g + color.b) / 3.0;
    specComp /= 2.0;

    vec3 screenColor = color.rgb * (ndl + specComp * ndl);

    gl_FragColor = vec4(screenColor, 1.0); // apply color and lighting
    #ifdef LOGARITHMICDEPTH
    gl_FragDepthEXT = log2(vFragmentDepth) * logarithmicDepthConstant * 0.5;
    #endif
}