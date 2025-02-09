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

import { Transformable } from "./transformable";
import { HasBoundingSphere } from "./hasBoundingSphere";
import { Axis, Matrix, Quaternion, Space, Vector3 } from "@babylonjs/core/Maths/math";
import { OrbitalObjectPhysicsInfo } from "./physicsInfo";
import { TypedObject } from "./typedObject";
import { getPointOnOrbit, Orbit } from "../orbit/orbit";

/**
 * Describes all objects that can have an orbital trajectory and rotate on themselves
 */
export interface OrbitalObject extends Transformable, HasBoundingSphere, TypedObject {
    readonly model: OrbitalObjectModel;
}

export class OrbitalObjectUtils {
    /**
     * Returns the position of the object on its orbit at a given time. This does not update the position of the object (see SetOrbitalPosition)
     * @param object The object we want to compute the position of
     * @param parents
     * @param elapsedSeconds The time elapsed since the beginning of time in seconds
     * @constructor
     */
    static GetOrbitalPosition(
        object: OrbitalObject,
        parents: OrbitalObject[],
        referencePlaneRotation: Matrix,
        elapsedSeconds: number
    ): Vector3 {
        const orbit = object.model.orbit;
        if (orbit.semiMajorAxis === 0 || parents.length === 0) return object.getTransform().position;

        const barycenter = Vector3.Zero();
        let sumOfMasses = 0;
        for (const parent of parents) {
            const mass = parent.model.physics.mass;
            barycenter.addInPlace(parent.getTransform().position.scale(mass));
            sumOfMasses += mass;
        }
        barycenter.scaleInPlace(1 / sumOfMasses);

        return getPointOnOrbit(barycenter, sumOfMasses, orbit, elapsedSeconds, referencePlaneRotation);
    }

    /**
     * Sets the position of the object on its orbit given the elapsed seconds.
     * @param object The object we want to update the position of
     * @param parents
     * @param elapsedSeconds The time elapsed since the beginning of time in seconds
     * @constructor
     */
    static SetOrbitalPosition(
        object: OrbitalObject,
        parents: OrbitalObject[],
        referencePlaneRotation: Matrix,
        elapsedSeconds: number
    ): void {
        const orbit = object.model.orbit;
        if (orbit.semiMajorAxis === 0 || parents.length === 0) return;

        const newPosition = OrbitalObjectUtils.GetOrbitalPosition(
            object,
            parents,
            referencePlaneRotation,
            elapsedSeconds
        );

        object.getTransform().position = newPosition;
        object.getTransform().computeWorldMatrix(true);
    }

    /**
     * Computes the rotation angle of the object around its axis for a given time
     * @param object The object we want to compute the rotation of
     * @param deltaSeconds The time span in seconds
     * @constructor
     */
    static GetRotationAngle(object: OrbitalObject, deltaSeconds: number): number {
        if (object.model.physics.siderealDaySeconds === 0) return 0;
        return (2 * Math.PI * deltaSeconds) / object.model.physics.siderealDaySeconds;
    }

    /**
     * Sets the rotation of the object around its axis
     * @param object The object we want to update the rotation of
     * @param referencePlaneRotation The rotation of the reference plane
     * @param elapsedSeconds The time elapsed since the beginning of time in seconds
     */
    static SetRotation(object: OrbitalObject, referencePlaneRotation: Matrix, elapsedSeconds: number) {
        const rotation = Matrix.RotationAxis(Axis.Z, object.model.orbit.inclination + object.model.physics.axialTilt);

        rotation.multiplyToRef(referencePlaneRotation, rotation);

        let objectRotationQuaternion = object.getTransform().rotationQuaternion;
        if (objectRotationQuaternion === null) {
            objectRotationQuaternion = object.getTransform().rotationQuaternion = Quaternion.Identity();
        }

        Quaternion.FromRotationMatrixToRef(rotation, objectRotationQuaternion);
        object.getTransform().computeWorldMatrix(true);

        const rotationAroundAxis = OrbitalObjectUtils.GetRotationAngle(object, elapsedSeconds);
        if (rotationAroundAxis === 0) return;

        object.getTransform().rotate(Axis.Y, rotationAroundAxis, Space.LOCAL);
        object.getTransform().computeWorldMatrix(true);
    }
}

/**
 * Describes the model of an orbital object
 */
export type OrbitalObjectModel = {
    /**
     * The name of the object
     */
    readonly name: string;

    /**
     * The seed used by the random number generator
     */
    readonly seed: number;

    /**
     * The type of the celestial body
     */
    readonly type: OrbitalObjectType;

    /**
     * Orbit properties of the object
     */
    readonly orbit: Orbit;

    /**
     * Physical properties of the object
     */
    readonly physics: OrbitalObjectPhysicsInfo;
};

export const enum OrbitalObjectType {
    STAR = 0,
    NEUTRON_STAR = 1,
    BLACK_HOLE = 2,
    TELLURIC_PLANET = 1000,
    TELLURIC_SATELLITE = 1001,
    GAS_PLANET = 1002,
    MANDELBULB = 2000,
    JULIA_SET = 2001,
    MANDELBOX = 2002,
    SIERPINSKI_PYRAMID = 2003,
    MENGER_SPONGE = 2004,
    SPACE_STATION = 3000,
    SPACE_ELEVATOR = 3001
}

export const SatelliteTypes = [OrbitalObjectType.TELLURIC_SATELLITE, OrbitalObjectType.SPACE_STATION];

export function isSatellite(orbitalObjectType: OrbitalObjectType): boolean {
    return SatelliteTypes.includes(orbitalObjectType);
}
