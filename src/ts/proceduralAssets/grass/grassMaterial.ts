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

import { Effect } from "@babylonjs/core/Materials/effect";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { Scene } from "@babylonjs/core/scene";

import grassFragment from "../../../shaders/grassMaterial/grassFragment.glsl";
import grassVertex from "../../../shaders/grassMaterial/grassVertex.glsl";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import perlinNoise from "../../../asset/perlin.png";
import { PointLight } from "@babylonjs/core/Lights/pointLight";

export function createGrassMaterial(scene: Scene) {
    const shaderName = "grassMaterial";
    Effect.ShadersStore[`${shaderName}FragmentShader`] = grassFragment;
    Effect.ShadersStore[`${shaderName}VertexShader`] = grassVertex;

    const grassMaterial = new ShaderMaterial(shaderName, scene, shaderName, {
        attributes: ["position", "normal"],
        uniforms: ["world", "worldView", "worldViewProjection", "view", "projection", "viewProjection", "time", "lightDirection", "cameraPosition", "playerPosition"],
        defines: ["#define INSTANCES"],
        samplers: ["perlinNoise"]
    });

    const perlinTexture = new Texture(perlinNoise, scene);

    grassMaterial.backFaceCulling = false;
    grassMaterial.setTexture("perlinNoise", perlinTexture);

    let elapsedSeconds = 0;
    scene.onBeforeRenderObservable.add(() => {
        elapsedSeconds += scene.getEngine().getDeltaTime() / 1000;

        if (scene.activeCamera === null) throw new Error("Active camera is null");

        const star = scene.lights[1];
        if (!(star instanceof PointLight)) throw new Error("Could not find star light");

        const lightDirection = star.position.subtract(scene.activeCamera.globalPosition).normalize();
        grassMaterial.setVector3("lightDirection", lightDirection);

        if (scene.activeCamera.parent !== null && !(scene.activeCamera.parent instanceof TransformNode)) throw new Error("Camera parent is not a TransformNode");

        const playerPosition = scene.activeCamera.parent !== null ? scene.activeCamera.parent.getAbsolutePosition() : scene.activeCamera.globalPosition; // high y to avoid interaction with grass
        const cameraPosition = scene.activeCamera.globalPosition;
        grassMaterial.setVector3("playerPosition", playerPosition);
        grassMaterial.setVector3("cameraPosition", cameraPosition);
        grassMaterial.setFloat("time", elapsedSeconds);
    });

    return grassMaterial;
}