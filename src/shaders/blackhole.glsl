precision highp float;

// based on https://www.shadertoy.com/view/tsBXW3

#define _Speed 3.0//disk rotation speed

#define _Steps  12.0 //disk texture layers

varying vec2 vUV;

uniform float time;
uniform float planetRadius;

uniform sampler2D textureSampler;
uniform sampler2D depthSampler;

uniform vec3 planetPosition;
uniform vec3 cameraPosition;

uniform mat4 inverseView;
uniform mat4 inverseProjection;

uniform float cameraNear;
uniform float cameraFar;

#pragma glslify: remap = require(./utils/remap.glsl)

#pragma glslify: worldFromUV = require(./utils/worldFromUV.glsl, inverseProjection=inverseProjection, inverseView=inverseView)

float hash(float x) { return fract(sin(x) * 152754.742); }
float hash(vec2 x) { return hash(x.x + hash(x.y)); }

float valueNoise(vec2 p, float f) {
    float bl = hash(floor(p*f + vec2(0., 0.)));
    float br = hash(floor(p*f + vec2(1., 0.)));
    float tl = hash(floor(p*f + vec2(0., 1.)));
    float tr = hash(floor(p*f + vec2(1., 1.)));

    vec2 fr = fract(p*f);
    fr = (3. - 2.*fr)*fr*fr;
    float b = mix(bl, br, fr.x);
    float t = mix(tl, tr, fr.x);
    return mix(b, t, fr.y);
}

vec4 background(vec3 ray) { return texture2D(textureSampler, vec2(ray.x, ray.y)); }

vec4 raymarchDisk(vec3 ray, vec3 zeroPos)
{
    if (false) return vec4(1., 1., 1., 0.);//no disk

    vec3 position = zeroPos;
    float distance = length(position.xz); // distance to the center of the disk
    float relativeDistance = distance / planetRadius;

    float dist = min(1.0, relativeDistance * 0.5) * planetRadius * 0.4 * (1./_Steps) / abs(ray.y);

    position += dist * _Steps * ray * 0.5;

    // elementary rotation around the hole //FIXME: will break when the black hole has a rotation
    vec2 deltaPos;
    deltaPos.x = zeroPos.x - zeroPos.z * 0.01;
    deltaPos.y = zeroPos.x * 0.01 + zeroPos.z;
    deltaPos = normalize(deltaPos - zeroPos.xz);

    float parallel = dot(ray.xz, deltaPos);
    parallel /= sqrt(relativeDistance);

    float redShift = parallel + 0.5;
    redShift *= redShift;
    redShift = clamp(redShift, 0.0, 1.0);

    float diskMix = smoothstep(4.0, 7.0, relativeDistance);
    vec3 innerDiskColor = vec3(1.0, 0.8, 0.0);
    vec3 outerDiskColor = vec3(0.5, 0.13, 0.02) * 0.2;
    vec3 insideCol =  mix(innerDiskColor, outerDiskColor, diskMix);

    insideCol *= mix(vec3(0.4, 0.2, 0.1), vec3(1.6, 1.0, 4.0) * 2.0, redShift);
    insideCol *= 1.25;

    vec4 diskColor = vec4(0.0);
    for (float i = 0.; i < _Steps; i++)
    {
        position -= dist * ray;

        float intensity = clamp(1.0 - abs((i - 0.8) * (1.0 / _Steps) * 2.0), 0.0, 1.0);
        distance = length(position.xz);
        relativeDistance = distance / planetRadius;

        float distMult = 1.0;
        distMult *= clamp(relativeDistance - 0.6, 0.0, 1.0); //FIXME: does this mean the event horizon is not as big as i want?

        float diskRadius = 8000e3; //TODO: make uniform
        float relativeDiskRadius = diskRadius / planetRadius;
        distMult *= clamp((relativeDiskRadius - relativeDistance), 0.0, 1.0);

        distMult *= distMult;

        // rotation of the disk
        vec2 xz;
        float rot = mod(time * _Speed, 8192.0);
        xz.x = position.x * cos(rot) - position.z * sin(rot);
        xz.y = position.x * sin(rot) + position.z * cos(rot);

        float angle = atan(abs(xz.x / (xz.y)));
        float u = time + intensity + relativeDistance;// some kind of disk coordinate
        const float f = 0.7;
        float noise = valueNoise(vec2(2.0 * angle, 5.0 * u), f);
        noise = noise * 0.66 + 0.33 * valueNoise(vec2(2.0 * angle, 5.0 * u), f * 2.0);

        // outer part of the accretion disk
        float extraWidth = noise * (1.0 - clamp(2.0 * i / _Steps - 1.0, 0.0, 1.0));

        float alpha = clamp(noise * (intensity + extraWidth) * (0.01 + 10.0 / planetRadius) * dist * distMult * (1.0 / 900.0), 0.0, 1.0);

        vec3 col = 2.0 * mix(vec3(0.3, 0.2, 0.15) * insideCol, insideCol, min(1.0, intensity * 2.0));
        diskColor = clamp(vec4(col*alpha + diskColor.rgb*(1.-alpha), diskColor.a * (1.0-alpha) + alpha), vec4(0.0), vec4(1.0));

        diskColor.rgb += (1.0 / 900.0) * redShift * (intensity + 0.5) * (1.0 / _Steps) * 100.0 * distMult / (relativeDistance * relativeDistance);
    }

    return diskColor;
}

void main()
{
    vec3 screenColor = texture2D(textureSampler, vUV).rgb;// the current screen color

    float depth = texture2D(depthSampler, vUV).r;// the depth corresponding to the pixel in the depth map

    vec3 pixelWorldPosition = worldFromUV(vUV);// the pixel position in world space (near plane)

    // closest physical point from the camera in the direction of the pixel (occlusion)
    vec3 closestPoint = (pixelWorldPosition - cameraPosition) * remap(depth, 0.0, 1.0, cameraNear, cameraFar);
    float maximumDistance = length(closestPoint);// the maxium ray length due to occlusion

    vec3 rayDir = normalize(pixelWorldPosition - cameraPosition);// normalized direction of the ray

    vec4 colOut = vec4(0.);

    float accretionDiskHeight = 100.0;

    //setting up camera
    vec3 ray = -rayDir;
    vec3 pos = planetPosition - cameraPosition;

    if (maximumDistance < length(pos)) {
        glFragColor = vec4(screenColor, 1.0);
        return;
    }

    vec4 col = vec4(0.0);

    for (int disks = 0; disks < 15; disks++) {
        for (int h = 0; h < 6; h++)//reduces tests for exit conditions (to minimise branching)
        {
            float centDist = length(pos); //dotpos * invDist;//distance to BH
            float dotpos = centDist * centDist;
            float invDist = 1.0 / centDist; //inversesqrt(dotpos);//1/distance to BH
            float stepDist = 0.92 * abs(pos.y / ray.y); //conservative distance to disk (y==0)
            float farLimit = centDist * 0.5; //limit step size far from to BH
            float closeLimit = centDist * 0.1 + 0.05 * dotpos / planetRadius;//limit step size closse to BH
            stepDist = min(stepDist, min(farLimit, closeLimit));

            float invDistSqr = invDist * invDist;
            float bendForce = stepDist * invDistSqr * planetRadius * 0.625;//bending force
            ray =  normalize(ray - (bendForce * invDist)*pos);//bend ray towards BH
            pos += stepDist * ray;
        }

        float dist2 = length(pos);

        if (dist2 < planetRadius * 0.1)//ray sucked in to BH
        {
            glFragColor =  vec4(col.rgb * col.a, 1.0);
            return;
        }

        else if (dist2 > planetRadius * 1000.)//ray escaped BH
        {
            vec4 bg = background(ray);
            bg = vec4(screenColor, 1.0);
            glFragColor = vec4(mix(bg.rgb, col.rgb, col.a), 1.0);
            return;
        }

        else if (abs(pos.y) <= accretionDiskHeight) //ray hit accretion disk //FIXME: Break when rotate
        {
            if (maximumDistance < length(pos)) {
                glFragColor = vec4(screenColor, 1.0);
                return;
            }

            vec4 diskCol = raymarchDisk(ray, pos);//render disk
            diskCol.rgb = pow(diskCol.rgb, vec3(0.8));
            pos.y = 0.0;
            pos += abs(planetRadius * 0.001 / ray.y) * ray;
            col += diskCol * (1.0 - col.a);
        }
    }

    gl_FragColor = vec4(col.rgb, 1.0);
}