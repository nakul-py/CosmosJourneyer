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

import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { StarMaterial } from "./starMaterial";
import { StarModel } from "./starModel";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Light } from "@babylonjs/core/Lights/light";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { isSizeOnScreenEnough } from "../../utils/isObjectVisibleOnScreen";
import { TransformNode } from "@babylonjs/core/Meshes";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { StellarObjectBase } from "../../architecture/stellarObject";
import { Cullable } from "../../utils/cullable";
import { RingsUniforms } from "../../rings/ringsUniform";
import { Scene } from "@babylonjs/core/scene";
import { AsteroidField } from "../../asteroidFields/asteroidField";
import { getRgbFromTemperature } from "../../utils/specrend";
import { getOrbitalObjectTypeToI18nString } from "../../utils/strings/orbitalObjectTypeToDisplay";
import { defaultTargetInfoCelestialBody, TargetInfo } from "../../architecture/targetable";
import { VolumetricLightUniforms } from "../../volumetricLight/volumetricLightUniforms";
import { OrbitalObjectType } from "../../architecture/orbitalObjectType";
import { DeepReadonly } from "../../utils/types";
import { TexturePools } from "../../assets/textures";
import { ItemPool } from "../../utils/itemPool";
import { RingsLut } from "../../rings/ringsLut";
import { Settings } from "../../settings";

export class Star implements StellarObjectBase<OrbitalObjectType.STAR>, Cullable {
    readonly mesh: Mesh;
    readonly light: PointLight;
    private readonly material: StarMaterial;

    readonly aggregate: PhysicsAggregate;

    readonly volumetricLightUniforms = new VolumetricLightUniforms();

    readonly ringsUniforms: RingsUniforms | null;

    readonly asteroidField: AsteroidField | null;

    readonly model: DeepReadonly<StarModel>;

    readonly type = OrbitalObjectType.STAR;

    readonly targetInfo: TargetInfo;

    /**
     * New Star
     * @param model The seed of the star in [-1, 1]
     * @param scene
     */
    constructor(model: DeepReadonly<StarModel>, texturePools: TexturePools, scene: Scene) {
        this.model = model;

        this.mesh = MeshBuilder.CreateSphere(
            this.model.name,
            {
                diameter: this.model.radius * 2,
                segments: 32
            },
            scene
        );
        this.mesh.rotationQuaternion = Quaternion.Identity();

        this.aggregate = new PhysicsAggregate(
            this.getTransform(),
            PhysicsShapeType.SPHERE,
            {
                mass: 0,
                restitution: 0.2
            },
            scene
        );
        this.aggregate.body.setMassProperties({ inertia: Vector3.Zero(), mass: 0 });
        this.aggregate.body.disablePreStep = false;

        this.light = new PointLight(`${this.model.name}Light`, Vector3.Zero(), scene);
        this.light.diffuse = getRgbFromTemperature(this.model.blackBodyTemperature);
        this.light.falloffType = Light.FALLOFF_STANDARD;
        this.light.parent = this.getTransform();

        this.material = new StarMaterial(
            this.model.seed,
            this.model.blackBodyTemperature,
            texturePools.starMaterialLut,
            scene
        );
        this.mesh.material = this.material;

        if (this.model.rings !== null) {
            this.ringsUniforms = new RingsUniforms(
                this.model.rings,
                Settings.RINGS_FADE_OUT_DISTANCE,
                texturePools.ringsLut,
                scene
            );

            const averageRadius = (this.model.radius * (this.model.rings.ringStart + this.model.rings.ringEnd)) / 2;
            const spread = (this.model.radius * (this.model.rings.ringEnd - this.model.rings.ringStart)) / 2;
            this.asteroidField = new AsteroidField(
                this.model.rings.seed,
                this.getTransform(),
                averageRadius,
                spread,
                scene
            );
        } else {
            this.ringsUniforms = null;
            this.asteroidField = null;
        }

        this.targetInfo = defaultTargetInfoCelestialBody(this.getBoundingRadius());
    }

    getTransform(): TransformNode {
        return this.mesh;
    }

    getLight(): PointLight {
        return this.light;
    }

    getTypeName(): string {
        return getOrbitalObjectTypeToI18nString(this.model);
    }

    public updateMaterial(deltaTime: number): void {
        this.material.update(deltaTime);
    }

    public getRadius(): number {
        return this.model.radius;
    }

    public getBoundingRadius(): number {
        return this.getRadius();
    }

    public computeCulling(camera: Camera): void {
        this.mesh.isVisible = isSizeOnScreenEnough(this, camera);
    }

    public dispose(ringsLutPool: ItemPool<RingsLut>): void {
        this.aggregate.dispose();
        this.material.dispose();
        this.light.dispose();
        this.asteroidField?.dispose();
        this.ringsUniforms?.dispose(ringsLutPool);
        this.mesh.dispose();
    }
}
