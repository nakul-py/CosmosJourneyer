import { seededSquirrelNoise } from "squirrel-noise";
import { BodyDescriptor } from "./interfaces";
import { getOrbitalPeriod } from "../orbits/kepler";
import { Quaternion } from "@babylonjs/core";
import { IOrbitalProperties } from "../orbits/iOrbitalProperties";
import { PhysicalProperties } from "../bodies/physicalProperties";
import { BodyType } from "../bodies/interfaces";

export class BlackHoleDescriptor implements BodyDescriptor {
    readonly bodyType = BodyType.BLACK_HOLE;
    readonly seed: number;
    readonly rng: (step: number) => number;

    readonly radius: number;

    readonly orbitalProperties: IOrbitalProperties;

    readonly physicalProperties: PhysicalProperties;

    readonly parentBodies: BodyDescriptor[] = [];

    readonly childrenBodies: BodyDescriptor[] = [];

    constructor(seed: number) {
        this.seed = seed;
        this.rng = seededSquirrelNoise(this.seed);

        this.radius = 1000e3;

        // TODO: do not hardcode
        const periapsis = 0;
        const apoapsis = 0;

        this.orbitalProperties = {
            periapsis: periapsis,
            apoapsis: apoapsis,
            period: getOrbitalPeriod(periapsis, apoapsis, []),
            orientationQuaternion: Quaternion.Identity()
        };

        this.physicalProperties = {
            mass: 10,
            rotationPeriod: 24 * 60 * 60,
            axialTilt: 0
        }
    }

    get depth(): number {
        if(this.parentBodies.length === 0) return 0;
        return this.parentBodies[0].depth + 1;
    }
}