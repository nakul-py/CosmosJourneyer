//  This file is part of CosmosJourneyer
//
//  Copyright (C) 2024 Barthélemy Paléologue <barth.paleologue@cosmosjourneyer.com>
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <https://www.gnu.org/licenses/>.

import { Direction } from "../../utils/direction";

import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Axis } from "@babylonjs/core/Maths/math.axis";

import { TelluricPlanetMaterial } from "./telluricPlanetMaterial";
import { waterBoilingPointCelsius } from "../../utils/waterMechanics";
import { UberScene } from "../../uberCore/uberScene";
import { TelluricPlanetModel } from "./telluricPlanetModel";
import { PostProcessType } from "../../postProcesses/postProcessTypes";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { ChunkTree } from "./terrain/chunks/chunkTree";
import { PhysicsShapeSphere } from "@babylonjs/core/Physics/v2/physicsShape";
import { Transformable } from "../../architecture/transformable";
import { ChunkForge } from "./terrain/chunks/chunkForge";
import { Observable } from "@babylonjs/core/Misc/observable";
import { PlanetChunk } from "./terrain/chunks/planetChunk";
import { Planet } from "../../architecture/planet";
import { Cullable } from "../../bodies/cullable";
import { TransformNode } from "@babylonjs/core/Meshes";
import { OrbitProperties } from "../../orbit/orbitProperties";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { OrbitalObject } from "../../architecture/orbitalObject";
import { CelestialBody } from "../../architecture/celestialBody";
import { RingsUniforms } from "../../postProcesses/rings/ringsUniform";
import { OrbitalObjectPhysicalProperties } from "../../architecture/physicalProperties";
import { rotate } from "../../uberCore/transforms/basicTransform";

export class TelluricPlanet implements Planet, Cullable {
    readonly name: string;

    readonly sides: ChunkTree[]; // stores the 6 sides of the sphere

    readonly material: TelluricPlanetMaterial;

    readonly model: TelluricPlanetModel;

    readonly onChunkCreatedObservable = new Observable<PlanetChunk>();

    private readonly transform: TransformNode;
    readonly aggregate: PhysicsAggregate;

    readonly postProcesses: PostProcessType[] = [];

    readonly parent: OrbitalObject | null;

    /**
     * New Telluric Planet
     * @param name The name of the planet
     * @param scene
     * @param model The model to build the planet or a seed for the planet in [-1, 1]
     * @param parentBody
     */
    constructor(name: string, scene: UberScene, model: TelluricPlanetModel | number, parentBody: CelestialBody | null = null) {
        this.name = name;

        this.parent = parentBody;

        this.model = model instanceof TelluricPlanetModel ? model : new TelluricPlanetModel(model, parentBody?.model);

        this.transform = new TransformNode(`${name}Transform`, scene);

        rotate(this.transform, Axis.X, this.model.physicalProperties.axialTilt);
        this.transform.computeWorldMatrix(true);

        this.aggregate = new PhysicsAggregate(
            this.getTransform(),
            PhysicsShapeType.CONTAINER,
            {
                mass: 0,
                restitution: 0.2
            },
            scene
        );
        this.aggregate.body.setMassProperties({ inertia: Vector3.Zero(), mass: 0 });
        this.aggregate.body.disablePreStep = false;
        const physicsShape = new PhysicsShapeSphere(Vector3.Zero(), this.model.radius, scene);
        this.aggregate.shape.addChildFromParent(this.getTransform(), physicsShape, this.getTransform());

        this.postProcesses.push(PostProcessType.SHADOW);

        const waterBoilingPoint = waterBoilingPointCelsius(this.model.physicalProperties.pressure);
        const waterFreezingPoint = 0.0;
        const epsilon = 0.05;
        if (this.model.physicalProperties.pressure > epsilon) {
            if (waterFreezingPoint > this.model.physicalProperties.minTemperature && waterFreezingPoint < this.model.physicalProperties.maxTemperature) {
                this.postProcesses.push(PostProcessType.OCEAN);
            } else {
                this.model.physicalProperties.oceanLevel = 0;
            }
            this.postProcesses.push(PostProcessType.ATMOSPHERE);
        } else {
            this.model.physicalProperties.oceanLevel = 0;
        }

        if (this.model.ringsUniforms !== null) this.postProcesses.push(PostProcessType.RING);
        if (this.model.cloudsUniforms !== null) this.postProcesses.push(PostProcessType.CLOUDS);

        this.material = new TelluricPlanetMaterial(this.name, this.getTransform(), this.model, scene);

        this.sides = [
            new ChunkTree(Direction.Up, this.name, this.model, this.aggregate, this.material, scene),
            new ChunkTree(Direction.Down, this.name, this.model, this.aggregate, this.material, scene),
            new ChunkTree(Direction.Forward, this.name, this.model, this.aggregate, this.material, scene),
            new ChunkTree(Direction.Backward, this.name, this.model, this.aggregate, this.material, scene),
            new ChunkTree(Direction.Right, this.name, this.model, this.aggregate, this.material, scene),
            new ChunkTree(Direction.Left, this.name, this.model, this.aggregate, this.material, scene)
        ];

        this.sides.forEach((side) => side.onChunkCreatedObservable.add((chunk) => this.onChunkCreatedObservable.notifyObservers(chunk)));
    }

    getTransform(): TransformNode {
        return this.transform;
    }

    getRotationAxis(): Vector3 {
        return this.getTransform().up;
    }

    getOrbitProperties(): OrbitProperties {
        return this.model.orbit;
    }

    getPhysicalProperties(): OrbitalObjectPhysicalProperties {
        return this.model.physicalProperties;
    }

    getRingsUniforms(): RingsUniforms | null {
        return this.model.ringsUniforms;
    }

    getTypeName(): string {
        return "Telluric Planet";
    }

    /**
     * Update terrain of the sphere relative to the observer position
     * @param observerPosition
     * @param chunkForge
     */
    public updateLOD(observerPosition: Vector3, chunkForge: ChunkForge): void {
        for (const side of this.sides) side.update(observerPosition, chunkForge);
    }

    public updateMaterial(controller: Camera, stellarObjects: Transformable[], deltaTime: number): void {
        this.material.update(controller.globalPosition, stellarObjects);
    }

    public getRadius(): number {
        return this.model.radius;
    }

    public getBoundingRadius(): number {
        return this.getRadius() + this.model.physicalProperties.oceanLevel;
    }

    public computeCulling(camera: Camera): void {
        for (const side of this.sides) side.computeCulling(camera);
    }

    public dispose(): void {
        for (const side of this.sides) side.dispose();
        this.material.dispose();
        this.aggregate.dispose();
        this.transform.dispose();
    }
}