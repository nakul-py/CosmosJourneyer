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
import { MetalSectionMaterial } from "./metalSectionMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import { Axis, PhysicsShapeType } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Transformable } from "../../../architecture/transformable";
import { computeRingRotationPeriod } from "../../../utils/ringRotation";
import { Settings } from "../../../settings";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Space } from "@babylonjs/core/Maths/math.axis";
import { LandingPad, LandingPadSize } from "../landingPad/landingPad";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { createEnvironmentAggregate } from "../../../utils/physics";
import { createRing } from "../../../utils/ringBuilder";
import { SpaceStationModel } from "../../../spacestation/spacestationModel";
import { LandingBayMaterial } from "./landingBayMaterial";
import { seededSquirrelNoise } from "squirrel-noise";

export class LandingBay {
    private readonly root: TransformNode;

    readonly rng: (step: number) => number;

    private readonly radius: number;

    private readonly landingBayMaterial: LandingBayMaterial;
    private readonly metalSectionMaterial: MetalSectionMaterial;

    private readonly ring: Mesh;
    private ringAggregate: PhysicsAggregate | null = null;

    private readonly arms: Mesh[] = [];
    private readonly armAggregates: PhysicsAggregate[] = [];

    readonly landingPads: LandingPad[] = [];

    constructor(stationModel: SpaceStationModel, seed: number, scene: Scene) {
        this.root = new TransformNode("LandingBayRoot", scene);

        this.rng = seededSquirrelNoise(seed);

        this.radius = 500;

        const deltaRadius = this.radius / 3;

        this.metalSectionMaterial = new MetalSectionMaterial(scene);

        const heightFactor = 2 + Math.floor(this.rng(0) * 3);

        const circumference = 2 * Math.PI * this.radius;

        let nbSteps = Math.ceil(circumference / deltaRadius);
        if (nbSteps % 2 !== 0) {
            nbSteps += 1;
        }

        this.ring = createRing(this.radius, deltaRadius, heightFactor * deltaRadius, nbSteps, scene);

        this.landingBayMaterial = new LandingBayMaterial(stationModel, this.radius, deltaRadius, heightFactor, scene);
        this.ring.material = this.landingBayMaterial;

        this.ring.parent = this.getTransform();

        this.ringAggregate = createEnvironmentAggregate(this.ring, PhysicsShapeType.MESH, scene);

        const yExtent = this.ring.getBoundingInfo().boundingBox.extendSize.y;

        const nbArms = 6;
        const armDiameter = deltaRadius / 4;
        const armHeight = this.radius * 1.618;
        const armRotation = 2 * Math.asin((0.5 * this.radius) / armHeight);
        const armOffset = Math.sqrt(armHeight * armHeight - this.radius * this.radius);
        for (let i = 0; i <= nbArms; i++) {
            const arm = MeshBuilder.CreateCylinder(
                `RingHabitatArm${i}`,
                {
                    height: armHeight,
                    diameter: armDiameter,
                    tessellation: 4
                },
                scene
            );
            arm.convertToFlatShadedMesh();
            arm.rotate(Axis.Z, armRotation, Space.LOCAL);
            arm.material = this.metalSectionMaterial;

            const theta = (i / nbArms) * Math.PI * 2;

            arm.rotate(Axis.Y, theta, Space.WORLD);

            arm.translate(Axis.Y, -armOffset - yExtent, Space.WORLD);
            arm.translate(Axis.Y, armHeight / 2, Space.LOCAL);

            arm.parent = this.getTransform();

            this.arms.push(arm);

            const armAggregate = createEnvironmentAggregate(arm, PhysicsShapeType.BOX, scene);
            this.armAggregates.push(armAggregate);
        }

        const nbPads = nbSteps;
        let padNumber = 0;
        for (let row = 0; row < heightFactor; row++) {
            for (let i = 0; i < nbPads; i++) {
                const landingPad = new LandingPad(padNumber++, (i + row) % 2 === 0 ? LandingPadSize.SMALL : LandingPadSize.MEDIUM, scene);
                landingPad.getTransform().parent = this.getTransform();

                landingPad.getTransform().rotate(Axis.Z, Math.PI / 2, Space.LOCAL);

                landingPad.getTransform().rotate(Axis.X, ((i + 0.5) * 2.0 * Math.PI) / nbPads, Space.LOCAL);

                landingPad.getTransform().rotate(Axis.Y, Math.PI / 2, Space.LOCAL);

                landingPad.getTransform().translate(Vector3.Up(), -(this.radius - deltaRadius / 2) * Math.cos(Math.PI / nbPads), Space.LOCAL);

                landingPad.getTransform().translate(Vector3.Forward(scene.useRightHandedSystem), row * deltaRadius - ((heightFactor - 1) * deltaRadius) / 2, Space.LOCAL);

                this.landingPads.push(landingPad);
            }
        }

        this.getTransform().computeWorldMatrix(true);

        const bb = this.getTransform().getHierarchyBoundingVectors();
        const extend = bb.max.subtract(bb.min);
        const center = bb.min.add(extend.scale(0.5));

        this.getTransform().getChildMeshes(true).forEach((mesh) => {
            mesh.position.subtractInPlace(center);
        });
    }

    update(stellarObjects: Transformable[], cameraWorldPosition: Vector3, deltaSeconds: number) {
        this.getTransform().rotate(Axis.Y, deltaSeconds / computeRingRotationPeriod(this.radius, Settings.G_EARTH * 0.1));
        this.landingBayMaterial.update(stellarObjects);
        this.metalSectionMaterial.update(stellarObjects);
        this.landingPads.forEach((landingPad) => landingPad.update(stellarObjects));

        const distanceToCamera = Vector3.Distance(cameraWorldPosition, this.getTransform().getAbsolutePosition());

        if (distanceToCamera < 350e3 && this.ringAggregate === null) {
            this.ringAggregate = createEnvironmentAggregate(this.ring, PhysicsShapeType.MESH, this.getTransform().getScene());
            this.arms.forEach((arm) => {
                const armAggregate = createEnvironmentAggregate(arm, PhysicsShapeType.BOX, this.getTransform().getScene());
                this.armAggregates.push(armAggregate);
            });
        } else if (distanceToCamera > 360e3 && this.ringAggregate !== null) {
            this.ringAggregate.dispose();
            this.ringAggregate = null;

            this.armAggregates.forEach((armAggregate) => armAggregate.dispose());
            this.armAggregates.length = 0;
        }
    }

    getTransform(): TransformNode {
        return this.root;
    }

    dispose() {
        this.root.dispose();
        this.ring.dispose();

        this.ringAggregate?.dispose();
        this.ringAggregate = null;

        this.landingBayMaterial.dispose();
        this.metalSectionMaterial.dispose();
        this.arms.forEach((arm) => arm.dispose());

        this.armAggregates.forEach((armAggregate) => armAggregate.dispose());
        this.armAggregates.length = 0;

        this.landingPads.forEach((landingPad) => landingPad.dispose());
    }
}