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

import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Quaternion } from "@babylonjs/core/Maths/math";
import { PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { Objects } from "../assets/objects";

export class AsteroidPatch {
    readonly parent: TransformNode;

    readonly instances: InstancedMesh[] = [];
    readonly instancePhysicsBodies: PhysicsBody[] = [];

    private readonly positions: Vector3[];
    private readonly rotations: Quaternion[];
    private readonly typeIndices: number[];

    private readonly rotationAxes: Vector3[] = [];
    private readonly rotationSpeeds: number[] = [];

    private nbInstances = 0;

    private readonly physicsRadius = 15e3;

    private readonly batchSize = 3;

    constructor(positions: Vector3[], rotations: Quaternion[], typeIndices: number[], rotationAxes: Vector3[], rotationSpeeds: number[], parent: TransformNode) {
        this.parent = parent;

        this.positions = positions;
        this.rotations = rotations;
        this.typeIndices = typeIndices;

        this.rotationAxes = rotationAxes;
        this.rotationSpeeds = rotationSpeeds;
    }

    public clearInstances(): void {
        this.instancePhysicsBodies.forEach((body) => body.dispose());
        this.instances.forEach((instance) => instance.dispose());

        this.instancePhysicsBodies.length = 0;
        this.instances.length = 0;

        this.nbInstances = 0;
    }

    public createInstances(): void {
        this.clearInstances();
    }

    public update(controlsPosition: Vector3, deltaSeconds: number): void {
        this.instances.forEach((instance, index) => {
            const distanceToCamera = Vector3.Distance(controlsPosition, instance.getAbsolutePosition());
            if (distanceToCamera < this.physicsRadius && (instance.physicsBody === null || instance.physicsBody === undefined)) {
                const instancePhysicsBody = new PhysicsBody(instance, PhysicsMotionType.DYNAMIC, false, this.parent.getScene());
                instancePhysicsBody.setMassProperties({ mass: 1000 });
                instancePhysicsBody.setAngularVelocity(this.rotationAxes[index].scale(this.rotationSpeeds[index]));
                instancePhysicsBody.setAngularDamping(0);
                instancePhysicsBody.disablePreStep = false;
                instancePhysicsBody.shape = Objects.ASTEROID_PHYSICS_SHAPES[this.typeIndices[index]];
                this.instancePhysicsBodies.push(instancePhysicsBody);
            } else if (distanceToCamera > this.physicsRadius + 1000 && instance.physicsBody !== null && instance.physicsBody !== undefined) {
                const body = this.instancePhysicsBodies.find((body) => body === instance.physicsBody);
                if (body) {
                    body.dispose();
                    this.instancePhysicsBodies.splice(this.instancePhysicsBodies.indexOf(body), 1);
                } else {
                    throw new Error("Physics body not found in instance physics bodies.");
                }
            }

            if (instance.physicsBody === null || instance.physicsBody === undefined) {
                instance.rotate(this.rotationAxes[index], this.rotationSpeeds[index] * deltaSeconds, Space.WORLD);
            }
        });

        for (let i = 0; i < this.batchSize; i++) {
            if (this.nbInstances === this.positions.length) return;

            const instance = Objects.ASTEROIDS[this.typeIndices[this.nbInstances]].createInstance(`instance${this.nbInstances}`);
            instance.position.copyFrom(this.positions[this.nbInstances]);
            instance.rotationQuaternion = this.rotations[this.nbInstances];
            instance.alwaysSelectAsActiveMesh = true;
            instance.isPickable = false;
            instance.parent = this.parent;

            this.instances.push(instance);

            this.nbInstances++;
        }
    }

    public getNbInstances(): number {
        return this.nbInstances;
    }

    public setEnabled(enabled: boolean) {
        this.instances.forEach((instance) => instance.setEnabled(enabled));
    }

    public dispose() {
        this.clearInstances();
        this.positions.length = 0;
        this.rotations.length = 0;
        this.typeIndices.length = 0;
        this.rotationAxes.length = 0;
        this.rotationSpeeds.length = 0;
    }
}