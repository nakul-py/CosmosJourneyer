import { seededSquirrelNoise } from "squirrel-noise";
import { normalRandom, randRangeInt, uniformRandBool } from "extended-random";
import { Settings } from "../settings";
import { BodyDescriptor, TelluricBodyDescriptor } from "./interfaces";
import { TerrainSettings } from "../terrain/terrainSettings";
import { clamp } from "terrain-generation";
import { SolidPhysicalProperties } from "../bodies/physicalProperties";
import { IOrbitalProperties } from "../orbits/iOrbitalProperties";
import { getOrbitalPeriod } from "../orbits/kepler";
import { Quaternion } from "@babylonjs/core";
import { BodyType } from "../bodies/interfaces";

enum GENERATION_STEPS {
    AXIAL_TILT = 100,
    ORBIT = 200,
    RADIUS = 1000,
    PRESSURE = 1100,
    WATER_AMOUNT = 1200,
    RINGS = 1400,
    TERRAIN = 1500,
    NB_MOONS = 10,
    MOONS = 11,
}

export class TelluricPlanetDescriptor implements TelluricBodyDescriptor {
    readonly bodyType = BodyType.TELLURIC;
    readonly seed: number;
    readonly rng: (step: number) => number;

    readonly radius: number;

    readonly orbitalProperties: IOrbitalProperties;

    readonly physicalProperties: SolidPhysicalProperties;

    readonly terrainSettings: TerrainSettings;

    readonly hasRings: boolean;

    readonly nbMoons: number;

    readonly parentBodies: BodyDescriptor[];
    readonly childrenBodies: BodyDescriptor[] = [];

    constructor(seed: number, parentBodies: BodyDescriptor[]) {
        this.seed = seed;
        this.rng = seededSquirrelNoise(this.seed);

        this.parentBodies = parentBodies;

        this.radius = Math.max(0.3, normalRandom(1.0, 0.1, this.rng, GENERATION_STEPS.RADIUS)) * Settings.EARTH_RADIUS;

        // TODO: do not hardcode
        const periapsis = this.rng(GENERATION_STEPS.ORBIT) * 5000000e3;
        const apoapsis = periapsis * (1 + this.rng(GENERATION_STEPS.ORBIT + 10) / 10);

        this.orbitalProperties = {
            periapsis: periapsis,
            apoapsis: apoapsis,
            period: getOrbitalPeriod(periapsis, apoapsis, this.parentBodies),
            orientationQuaternion: Quaternion.Identity()
        };

        this.physicalProperties = {
            mass: 10,
            axialTilt: normalRandom(0, 0.2, this.rng, GENERATION_STEPS.AXIAL_TILT),
            rotationPeriod: 60 * 60 * 24 / 10,
            minTemperature: randRangeInt(-50, 5, this.rng, 80),
            maxTemperature: randRangeInt(10, 50, this.rng, 81),
            pressure: Math.max(normalRandom(0.9, 0.2, this.rng, GENERATION_STEPS.PRESSURE), 0),
            waterAmount: Math.max(normalRandom(1.0, 0.3, this.rng, GENERATION_STEPS.WATER_AMOUNT), 0),
            oceanLevel: 0
        }
        
        this.physicalProperties.oceanLevel = Settings.OCEAN_DEPTH * this.physicalProperties.waterAmount * this.physicalProperties.pressure;

        this.terrainSettings = {
            continents_frequency: this.radius / Settings.EARTH_RADIUS,
            continents_fragmentation: clamp(normalRandom(0.65, 0.03, this.rng, GENERATION_STEPS.TERRAIN), 0, 0.95),

            bumps_frequency: 30 * this.radius / Settings.EARTH_RADIUS,

            max_bump_height: 1.5e3,
            max_mountain_height: 10e3,
            continent_base_height: this.physicalProperties.oceanLevel * 1.9,

            mountains_frequency: 20 * this.radius / Settings.EARTH_RADIUS,
        };

        this.hasRings = uniformRandBool(0.6, this.rng, GENERATION_STEPS.RINGS);

        this.nbMoons = randRangeInt(0, 2, this.rng, GENERATION_STEPS.NB_MOONS);
    }

    get depth(): number {
        if(this.parentBodies.length === 0) return 0;
        return this.parentBodies[0].depth + 1;
    }

    getMoonSeed(index: number) {
        if(index > this.nbMoons) throw new Error("Moon out of bound! " + index);
        return this.rng(GENERATION_STEPS.MOONS + index);
    }

    getApparentRadius(): number {
        return this.radius + this.physicalProperties.oceanLevel;
    }
}