precision highp float;

#ifdef LOGARITHMICDEPTH
	uniform float logarithmicDepthConstant;
	varying float vFragmentDepth;
#endif

varying vec3 vPositionW;
varying vec3 vNormalW;
varying vec3 vUnitSamplePoint;
varying vec3 vSamplePoint;

// Refs

uniform mat4 world;

uniform vec3 playerPosition; // camera position in world space
uniform float cameraNear;
uniform float cameraFar;
uniform vec3 sunPosition; // light position in world space
uniform vec3 planetPosition;
uniform mat4 view;
uniform mat4 projection;

uniform sampler2D textureSampler;
uniform sampler2D depthSampler; // evaluate sceneDepth

uniform int colorMode;

uniform sampler2D bottomNormalMap;
uniform sampler2D plainNormalMap;

uniform sampler2D beachNormalMap;
uniform sampler2D desertNormalMap;

uniform sampler2D snowNormalMap;
uniform sampler2D snowNormalMap2;

uniform sampler2D steepNormalMap;

uniform vec3 seed;

uniform float planetRadius; // planet radius
uniform float waterLevel; // controls sand layer
uniform float beachSize;

uniform float steepSharpness; // sharpness of demaracation between steepColor and normal colors
uniform float normalSharpness;

uniform float maxElevation;

uniform vec3 snowColor; // the color of the snow layer
uniform vec3 steepColor; // the color of steep slopes
uniform vec3 plainColor; // the color of plains at the bottom of moutains
uniform vec3 beachColor; // the color of the sand
uniform vec3 desertColor;
uniform vec3 bottomColor;

uniform float pressure;
uniform float minTemperature;
uniform float maxTemperature;

uniform float waterAmount;

varying vec3 vPosition; // position of the vertex in sphere space
varying vec3 vNormal; // normal of the vertex in sphere space
varying vec2 vUV; // 

// Noise functions to spice things up a little bit
float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}

float completeNoise(vec3 p, int nbOctaves, float decay, float lacunarity) {
	float totalAmplitude = 0.0;
	float value = 0.0;
	for(int i = 0; i < nbOctaves; ++i) {
		totalAmplitude += 1.0 / pow(decay, float(i));
		vec3 samplePoint = p * pow(lacunarity, float(i)); 
		value += noise(samplePoint) / pow(decay, float(i));
	}
	return value / totalAmplitude;
}

// https://stackoverflow.com/questions/3380628/fast-arc-cos-algorithm
float fastAcos(float x) {
      float negate = 0.0;
      if(x < 0.0) negate = 1.0; //float(x < 0);
      x = abs(x);
      float ret = -0.0187293;
      ret = ret * x;
      ret = ret + 0.0742610;
      ret = ret * x;
      ret = ret - 0.2121144;
      ret = ret * x;
      ret = ret + 1.5707288;
      ret = ret * sqrt(1.0-x);
      ret = ret - 2.0 * negate * ret;
      return negate * 3.14159265358979 + ret;
}

float remap(float value, float low1, float high1, float low2, float high2) {
    return low2 + (value - low1) * (high2 - low2) / (high1 - low1);
}

vec3 lerp(vec3 vector1, vec3 vector2, float x) {
	return x * vector1 + (1.0 - x) * vector2;
}

vec2 lerp(vec2 vector1, vec2 vector2, float x) {
	return x * vector1 + (1.0 - x) * vector2;
}

float lerp(float value1, float value2, float x) {
	return x * value1 + (1.0 - x) * value2;
}

// https://bgolus.medium.com/normal-mapping-for-a-triplanar-shader-10bf39dca05a
vec3 triplanarNormal(vec3 position, vec3 surfaceNormal, sampler2D normalMap, float scale, float sharpness, float normalStrength) {
    vec2 uvX = position.zy * scale;
    vec2 uvY = position.xz * scale;
    vec2 uvZ = position.xy * scale;

    vec3 tNormalX = texture2D(normalMap, uvX).rgb;
    vec3 tNormalY = texture2D(normalMap, uvY).rgb;
    vec3 tNormalZ = texture2D(normalMap, uvZ).rgb;

    tNormalX = normalize(tNormalX * 2.0 - 1.0) * normalStrength;
    tNormalY = normalize(tNormalY * 2.0 - 1.0) * normalStrength;
    tNormalZ = normalize(tNormalZ * 2.0 - 1.0) * normalStrength;

    tNormalX = vec3(tNormalX.xy + surfaceNormal.zy, surfaceNormal.x);
    tNormalY = vec3(tNormalY.xy + surfaceNormal.xz, surfaceNormal.y);
    tNormalZ = vec3(tNormalZ.xy + surfaceNormal.xy, surfaceNormal.z);

    vec3 blendWeight = pow(abs(surfaceNormal), vec3(sharpness));
    blendWeight /= dot(blendWeight, vec3(1.0));

    return normalize(tNormalX.zyx * blendWeight.x + tNormalY.xzy * blendWeight.y + tNormalZ.xyz * blendWeight.z);
}

bool near(float value, float reference, float range) {
	return abs(reference - value) < range; 
}

float nearFloat(float value, float reference, float range) {
	if(near(value, reference, range)) {
		return 1.0;
	} else {
		return 0.0;
	}
}

/*
 * Get lerp factor around summit with certain slope (triangle function)
 */
float getLnearFactor(float x, float summitX, float range) {
	float lnearFactor = 0.0;
	if(x >= summitX) lnearFactor = max(-x/range + 1.0 + summitX/range, 0.0);
	else lnearFactor = max(x/range + 1.0 - summitX/range, 0.0);
	
	float blendingSharpness = 1.0;
	lnearFactor = pow(lnearFactor, blendingSharpness);

	return lnearFactor;
}

/*
 * Get lerp value around summit with certain slope (triangle function)
 */
vec3 lnear(vec3 value1, vec3 value2, float x, float summitX, float range) {
	float lnearFactor = getLnearFactor(x, summitX, range);
	
	return lerp(value1, value2, lnearFactor);
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

float saturate(float x) {
    if(x > 1.0) return 1.0;
    if(x < 0.0) return 0.0;
    return x;
}

vec3 computeColorAndNormal(
	float elevation01, float waterLevel01, float slope, 
	out vec3 normal, float temperature01, float moisture01, 
	float waterMeltingPoint01, float absLatitude01) {
	
	normal = vNormal;

	float plainFactor = 0.0,
	beachFactor = 0.0,
	desertFactor = 0.0,
	bottomFactor = 0.0,
	snowFactor = 0.0, 
	steepFactor = 0.0;

	vec3 outColor;

	if(elevation01 > waterLevel01) {

		// séparation biome désert biome plaine
		float moistureSharpness = 20.0;
		float moistureFactor = tanherpFactor(moisture01, moistureSharpness);
		vec3 plainColor = tanherp(plainColor, 0.7 * plainColor, noise(vSamplePoint / 10000.0), 3.0);

		vec3 flatColor = lerp(plainColor, desertColor, moistureFactor);

		// séparation biome sélectionné avec biome neige
		// waterMeltingPoint01 * waterAmount : il est plus difficile de former de la neige quand y a moins d'eau
		float snowColorFactor = tanh01((waterMeltingPoint01 * min(waterAmount, 1.0) - temperature01) * 64.0);
		flatColor = lerp(snowColor, flatColor, snowColorFactor);
		snowFactor = snowColorFactor;

		// séparation biome sélectionné avec biome plage
		flatColor = lnear(beachColor, flatColor, elevation01, waterLevel01, beachSize / maxElevation);

		beachFactor = getLnearFactor(elevation01, waterLevel01, beachSize / maxElevation);
		desertFactor = 1.0 - moistureFactor;
		plainFactor = 1.0 - desertFactor;
		plainFactor *= 1.0 - snowFactor;

		// détermination de la couleur due à la pente
		float steepDominance = 6.0;
		steepFactor = tanherpFactor(1.0 - pow(1.0-slope, steepDominance), steepSharpness); // tricks pour éviter un calcul couteux d'exposant décimal
		steepFactor *= 1.0 - snowFactor;

		beachFactor *= 1.0 - steepFactor;
		plainFactor *= 1.0 - steepFactor;

		steepFactor *= steepFactor;

		outColor = lerp(flatColor, steepColor, 1.0 - steepFactor);
	} else {
		// entre abysse et surface
		vec3 flatColor = lnear(beachColor, bottomColor, elevation01, waterLevel01, beachSize / maxElevation);

		beachFactor = getLnearFactor(elevation01, waterLevel01, beachSize / maxElevation);
		bottomFactor = 1.0 - beachFactor;

		float steepDominance = 6.0;
		steepFactor = tanherpFactor(1.0 - pow(1.0-slope, steepDominance), steepSharpness); // tricks pour éviter un calcul couteux d'exposant décimal

		beachFactor *= 1.0 - steepFactor;
		bottomFactor *= 1.0 - steepFactor;

		steepFactor *= steepFactor;

		outColor = lerp(flatColor, steepColor, 1.0 - steepFactor);
	}

	bottomFactor = saturate(bottomFactor);
	beachFactor = saturate(beachFactor);
	plainFactor = saturate(plainFactor);
	desertFactor = saturate(desertFactor);
	snowFactor = saturate(snowFactor);
	steepFactor = saturate(steepFactor);

	// TODO: briser la répétition avec du simplex
	normal = triplanarNormal(vSamplePoint, normal, bottomNormalMap, 0.001, normalSharpness, bottomFactor);
	normal = triplanarNormal(vSamplePoint, normal, bottomNormalMap, 0.00001, normalSharpness, bottomFactor);

    normal = triplanarNormal(vSamplePoint, normal, beachNormalMap, 0.001, normalSharpness, beachFactor);
   	normal = triplanarNormal(vSamplePoint, normal, beachNormalMap, 0.00001, normalSharpness, beachFactor);

    normal = triplanarNormal(vSamplePoint, normal, plainNormalMap, 0.001, normalSharpness, plainFactor);
	normal = triplanarNormal(vSamplePoint, normal, plainNormalMap, 0.00001, normalSharpness, plainFactor);

	normal = triplanarNormal(vSamplePoint, normal, desertNormalMap, 0.001, normalSharpness, desertFactor);
    normal = triplanarNormal(vSamplePoint, normal, desertNormalMap, 0.00001, normalSharpness, desertFactor);

    normal = triplanarNormal(vSamplePoint, normal, snowNormalMap, 0.001, normalSharpness, snowFactor);
	normal = triplanarNormal(vSamplePoint, normal, snowNormalMap, 0.00001, normalSharpness, snowFactor);

    normal = triplanarNormal(vSamplePoint, normal, steepNormalMap, 0.001, normalSharpness, steepFactor);
	normal = triplanarNormal(vSamplePoint, normal, steepNormalMap, 0.00001, normalSharpness, steepFactor);

	return outColor;
}

// https://www.omnicalculator.com/chemistry/boiling-point
// https://www.wikiwand.com/en/Boiling_point#/Saturation_temperature_and_pressure
// https://www.desmos.com/calculator/ctxerbh48s
float waterBoilingPointCelsius(float pressure) {
	float P1 = 1.0;
	float P2 = pressure;
	float T1 = 100.0 + 273.15;
	float DH = 40660.0;
	float R = 8.314;
	if(P2 > 0.0) {
		return (1.0 / ((1.0 / T1) + log(P1 / P2) * (R / DH))) - 273.15;
	} else {
		return -273.15;
	}
}

void main() {
	vec3 viewRayW = normalize(playerPosition - vPositionW); // view direction in world space
	vec3 lightRayW = normalize(sunPosition - vPositionW); // light ray direction in world space

	vec3 sphereNormalW = vec3(world * vec4(vUnitSamplePoint, 0.0));
	float ndl = max(0.002, dot(sphereNormalW, lightRayW));

	// la unitPosition ne prend pas en compte la rotation de la planète
	vec3 seededSamplePoint = normalize(vUnitSamplePoint + seed);//normalize(unitPosition + normalize(seed));

	// TODO: this is no longer accurate (not using inverse matrix)
	float latitude = vUnitSamplePoint.y;
	float absLatitude01 = abs(latitude);
	
	float elevation = length(vSamplePoint) - planetRadius;

	float elevation01 = elevation / maxElevation;
	float waterLevel01 = waterLevel / maxElevation;

	float slope = 1.0 - dot(vUnitSamplePoint, vNormal);

	/// Analyse Physique de la planète

	float dayDuration = 1.0;
	
	// pressions
	float waterSublimationPression = 0.006; //https://www.wikiwand.com/en/Sublimation_(phase_transition)#/Water
	
	// Temperatures
	
	float waterMeltingPoint = 0.0; // fairly good approximation
	float waterMeltingPoint01 = (waterMeltingPoint - minTemperature) / (maxTemperature - minTemperature);
	float waterBoilingPoint01 = (waterBoilingPointCelsius(pressure) - minTemperature) / (maxTemperature - minTemperature);

	//https://qph.fs.quoracdn.net/main-qimg-6a0fa3c05fb4db3d7d081680aec4b541
	float co2SublimationTemperature = 0.0; // https://www.wikiwand.com/en/Sublimation_(phase_transition)#/CO2
	// TODO: find the equation ; even better use a texture
	float co2SublimationTemperature01 = (co2SublimationTemperature - minTemperature) / (maxTemperature - minTemperature);

    // TODO: do not hardcode both
	float temperatureHeightFalloff = 1.5;
	float temperatureLatitudeFalloff = 1.0;

	// TODO: do not hardcode that factor
	float temperatureRotationFactor = tanh(0.15 * dayDuration);

	// https://www.desmos.com/calculator/apezlfvwic
	float temperature01 = 1.0;

	// temperature drops with latitude
	// https://www.researchgate.net/profile/Anders-Levermann/publication/274494740/figure/fig3/AS:391827732615174@1470430419170/a-Surface-air-temperature-as-a-function-of-latitude-for-data-averaged-over-1961-90-for.png
   	temperature01 -= pow(temperatureLatitudeFalloff * absLatitude01, 3.0);

	// temperature drops exponentially with elevation
	temperature01 *= exp(-elevation01 * temperatureHeightFalloff);

	// added random fluctuations
	temperature01 += (completeNoise(vUnitSamplePoint * 300.0, 5, 1.7, 2.5) - 0.5) / 4.0;

	// temperature drops during nighttime (more ice)
	temperature01 *= ndl * temperatureRotationFactor + 1.0 - temperatureRotationFactor;

    // cannot exceed max and min temperatures
	temperature01 = clamp(temperature01, 0.0, 1.0);

	float temperature = lerp(maxTemperature, minTemperature, temperature01);

	// moisture
	float moisture01 = 0.0; // 0.0 = sec, 1.0 = humid : sec par défaut
	if(waterMeltingPoint01 < 1.0) {
		// if there is liquid water on the surface
		moisture01 += completeNoise(seededSamplePoint * 2.0, 5, 1.7, 2.2) * sqrt(1.0-waterMeltingPoint01) * waterBoilingPoint01;
	}
	if(pressure == 0.0) {
	    moisture01 += completeNoise(seededSamplePoint * 5.0, 5, 1.7, 2.2);
	}
	moisture01 = clamp(moisture01, 0.0, 1.0);

	// calcul de la couleur et de la normale
	vec3 normal = vNormal;
	vec3 color = computeColorAndNormal(elevation01, waterLevel01, slope, normal, temperature01, moisture01, waterMeltingPoint01, absLatitude01);
	vec3 normalW = normalize(vec3(world * vec4(normal, 0.0)));

	float ndl2 = max(0.0, dot(normalW, lightRayW)); // dimming factor due to light inclination relative to vertex normal in world space

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

	vec3 screenColor = color.rgb * (sqrt(ndl*ndl2) + specComp*ndl);

	if(colorMode == 1) screenColor = lerp(vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), moisture01);
	if(colorMode == 2) screenColor = lerp(vec3(1.0, 0.0, 0.0), vec3(0.1, 0.2, 1.0), temperature01);
	if(colorMode == 3) screenColor = normal*0.5 + 0.5;
	if(colorMode == 4) screenColor = vec3(elevation01);
	if(colorMode == 5) screenColor = vec3(1.0 - dot(normal, normalize(vSamplePoint)));

	gl_FragColor = vec4(screenColor, 1.0); // apply color and lighting
	#ifdef LOGARITHMICDEPTH
    	gl_FragDepthEXT = log2(vFragmentDepth) * logarithmicDepthConstant * 0.5;
    #endif
} 