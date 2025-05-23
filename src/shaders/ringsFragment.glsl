//  This file is part of Cosmos Journeyer
//
//  Copyright (C) 2024 Barthélemy Paléologue <barth.paleologue@cosmosjourneyer.com>
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU Affero General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU Affero General Public License for more details.
//
//  You should have received a copy of the GNU Affero General Public License
//  along with this program.  If not, see <https://www.gnu.org/licenses/>.

precision lowp float;

#define DISABLE_UNIFORMITY_ANALYSIS

varying vec2 vUV;// screen coordinates

uniform sampler2D textureSampler;// the original screen texture
uniform sampler2D depthSampler;// the depth map of the camera

#include "./utils/stars.glsl";

#include "./utils/camera.glsl";

#include "./utils/object.glsl";

#include "./rings/rings.glsl";

#include "./utils/worldFromUV.glsl";

#include "./utils/rayIntersectSphere.glsl";

#include "./utils/rayIntersectsPlane.glsl";

#include "./rings/ringsDensity.glsl";

void main() {
    vec4 screenColor = texture2D(textureSampler, vUV);// the current screen color

    float depth = texture2D(depthSampler, vUV).r;// the depth corresponding to the pixel in the depth map

    vec3 pixelWorldPosition = worldFromUV(vUV, camera_inverseProjection, camera_inverseView);// the pixel position in world space (near plane)

    // actual depth of the scene
    float maximumDistance = length(pixelWorldPosition - camera_position) * remap(depth, 0.0, 1.0, camera_near, camera_far);

    vec3 rayDir = normalize(pixelWorldPosition - camera_position);// normalized direction of the ray

    vec4 finalColor = screenColor;

    float impactPoint;
    if (rayIntersectsPlane(camera_position, rayDir, object_position, object_rotationAxis, 0.001, impactPoint)) {
        // if the ray intersect the ring plane
        if (impactPoint >= 0.0 && impactPoint < maximumDistance) {
            // if the ray intersects the ring before any other object
            float t0, t1;
            if (!rayIntersectSphere(camera_position, rayDir, object_position, object_radius, t0, t1) || t0 > impactPoint) {
                // if the ray is impacting a solid object after the ring plane
                vec3 samplePoint = camera_position + impactPoint * rayDir;
                float ringDensity = ringDensityAtPoint(samplePoint) * rings_opacity;

                ringDensity *= smoothstep(rings_fade_out_distance * 2.0, rings_fade_out_distance * 5.0, impactPoint);

                vec3 ringShadeColor = rings_color;

                float softShadowFactor = 1.0;
                for (int i = 0; i < nbStars; i++) {
                    // hypothèse des rayons parallèles
                    vec3 rayToSun = normalize(star_positions[i] - object_position);
                    float t2, t3;
                    if (rayIntersectSphere(samplePoint, rayToSun, object_position, object_radius, t2, t3)) {
                        vec3 closestPointToPlanetCenter = samplePoint + rayToSun * (t2 + t3) * 0.5;
                        float closestDistanceToPlanetCenter = length(closestPointToPlanetCenter - object_position);
                        float r01 = remap(closestDistanceToPlanetCenter, 0.0, object_radius, 0.0, 1.0);
                        softShadowFactor = min(softShadowFactor, 0.2 + 0.8 * smoothstep(0.85, 1.0, r01));
                    } else {
                        softShadowFactor = 1.0;
                    }
                }
                ringShadeColor *= softShadowFactor;

                finalColor = vec4(mix(finalColor.rgb * (1.0 - ringDensity), ringShadeColor, ringDensity), 1.0);
            }
        }
    }

    gl_FragColor = finalColor;// displaying the final color
}