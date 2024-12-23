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

precision highp float;

// based on https://www.shadertoy.com/view/tsc3Rj and https://www.shadertoy.com/view/wdjGWR

varying vec2 vUV;

uniform float time;
uniform float planetRadius;

uniform float power;
uniform vec3 accentColor;

#include "./utils/stars.glsl";

uniform sampler2D textureSampler;
uniform sampler2D depthSampler;

#include "./utils/object.glsl";

#include "./utils/camera.glsl";

#include "./utils/remap.glsl";

#include "./utils/worldFromUV.glsl";

#include "./utils/rayIntersectSphere.glsl";

#define MARCHINGITERATIONS 100

#define MARCHINGSTEP 1.0
#define EPSILON 0.0002

#define MAX_DIST 3.0

float sdf(vec3 z)
{
    const vec3 va = vec3(  0.0,  0.57735,  0.0 );
    const vec3 vb = vec3(  0.0, -1.0,  1.15470 );
    const vec3 vc = vec3(  1.0, -1.0, -0.57735 );
    const vec3 vd = vec3( -1.0, -1.0, -0.57735 );
    
    vec3 p = z;
	float a = 0.0;
    float s = 1.0;
    float r = 1.0;
    float dm;
    for( int i=0; i<9; i++ )
	{
        vec3 v;
	    float d, t;
		d = dot(p-va,p-va);            { v=va; dm=d; t=0.0; }
        d = dot(p-vb,p-vb); if( d<dm ) { v=vb; dm=d; t=1.0; }
        d = dot(p-vc,p-vc); if( d<dm ) { v=vc; dm=d; t=2.0; }
        d = dot(p-vd,p-vd); if( d<dm ) { v=vd; dm=d; t=3.0; }
		p = v + 2.0*(p - v); r*= 2.0;
		a = t + 4.0*a; s*= 4.0;
	}

    float distance  = (sqrt(dm)-1.0)/r;
    float address   = a/s;

	return distance;
}


// TRACING A PATH : 
// measuring the distance to the nearest object on the x coordinate
// and returning the color index on the y coordinate
float rayMarch(vec3 origin, vec3 ray, float maxDist) {
    //t is the point at which we are in the measuring of the distance
    float depth = 0.0;
    float c = 0.0;
    
    for (int i = 0; i < MARCHINGITERATIONS; i++) {
    	vec3 path = origin + ray * depth;	
    	float dist = sdf(path);    	
        depth += MARCHINGSTEP * dist;

        if (dist < EPSILON) return depth;
        if (dist > maxDist) return 1e20;
    }

    return depth;
}

float calcOcclusion( in vec3 pos, in vec3 nor )
{
	float ao = 0.0;
    float sca = 1.0;
    for( int i=0; i<8; i++ )
    {
        float h = 0.001 + 0.5*pow(float(i)/7.0,1.5);
        float d = sdf( pos + h*nor );
        ao += -(d-h)*sca;
        sca *= 0.95;
    }
    return clamp( 1.0 - 0.8*ao, 0.0, 1.0 );
}

vec3 estimate_normal(const vec3 p, const float delta)
{
    vec3 normal = vec3(
            sdf(vec3(p.x + delta, p.y, p.z)) - sdf(vec3(p.x - delta, p.y, p.z)),
            sdf(vec3(p.x, p.y + delta, p.z)) - sdf(vec3(p.x, p.y - delta, p.z)),
            sdf(vec3(p.x, p.y, p.z  + delta)) - sdf(vec3(p.x, p.y, p.z - delta))
    );
    return normalize(normal);
}

void main() {
    vec4 screenColor = texture2D(textureSampler, vUV);// the current screen color

    vec3 pixelWorldPosition = worldFromUV(vUV, camera_inverseProjection, camera_inverseView);// the pixel position in world space (near plane)
    vec3 rayDir = normalize(pixelWorldPosition - camera_position);// normalized direction of the ray

    float depth = texture2D(depthSampler, vUV).r;// the depth corresponding to the pixel in the depth map
    // actual depth of the scene
    float maximumDistance = length(pixelWorldPosition - camera_position) * remap(depth, 0.0, 1.0, camera_near, camera_far);
    
    float impactPoint, escapePoint;
    if (!(rayIntersectSphere(camera_position, rayDir, object_position, planetRadius, impactPoint, escapePoint))) {
        gl_FragColor = screenColor;// if not intersecting with atmosphere, return original color
        return;
    }

    // we apply inverse scaling to make the situation roughly equivalent to a fractal of size 1
    float inverseScaling = 1.0 / (0.6 * planetRadius);

    vec3 origin = camera_position - object_position; // the ray origin in world space
    origin *= inverseScaling;

    float rayDepth = rayMarch(origin, rayDir, MAX_DIST + impactPoint * inverseScaling);

    float realDepth = rayDepth / inverseScaling;

    if(maximumDistance < realDepth) {
        gl_FragColor = screenColor;
        return;
    }

    vec3 intersectionPoint = origin + rayDepth * rayDir;
    float intersectionDistance = length(intersectionPoint);

    vec4 mandelbulbColor = vec4(accentColor, 1.0);

    vec3 normal = estimate_normal(intersectionPoint, EPSILON);
    
    float occ = calcOcclusion(intersectionPoint, normal);
    
    float ndl = 0.0;
    for(int i = 0; i < nbStars; i++) {
        vec3 starDir = normalize(star_positions[i] - object_position);
        ndl += max(0.0, dot(normal, starDir));
    }

    mandelbulbColor.xyz *= clamp(ndl, 0.5, 1.0) * occ * 2.0;

    gl_FragColor = vec4(mandelbulbColor.xyz, 1.0);

}
