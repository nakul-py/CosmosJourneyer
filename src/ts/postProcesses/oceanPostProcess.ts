import { Effect } from "@babylonjs/core";

import oceanFragment from "../../shaders/oceanFragment.glsl";
import { Assets } from "../assets";
import { UberScene } from "../uberCore/uberScene";
import { ShaderDataType, ShaderSamplers, ShaderUniforms } from "../uberCore/postProcesses/uberPostProcess";
import { getActiveCameraUniforms, getBodyUniforms, getSamplers, getStarsUniforms } from "./uniforms";
import { Star } from "../bodies/stars/star";
import { BlackHole } from "../bodies/blackHole";
import { TelluricPlanet } from "../bodies/planets/telluricPlanet";
import { BodyPostProcess } from "./bodyPostProcess";

const shaderName = "ocean";
Effect.ShadersStore[`${shaderName}FragmentShader`] = oceanFragment;

export interface OceanSettings {
    oceanRadius: number;
    smoothness: number;
    specularPower: number;
    depthModifier: number;
    alphaModifier: number;
    waveBlendingSharpness: number;
}

export class OceanPostProcess extends BodyPostProcess {
    settings: OceanSettings;

    constructor(name: string, planet: TelluricPlanet, scene: UberScene, stars: (Star | BlackHole)[]) {
        const settings: OceanSettings = {
            oceanRadius: planet.getApparentRadius(),
            depthModifier: 0.001,
            alphaModifier: 0.001,
            specularPower: 1.5,
            smoothness: 0.9,
            waveBlendingSharpness: 0.1
        };

        const uniforms: ShaderUniforms = [
            ...getBodyUniforms(planet),
            ...getStarsUniforms(stars),
            ...getActiveCameraUniforms(scene),
            {
                name: "oceanRadius",
                type: ShaderDataType.Float,
                get: () => {
                    return settings.oceanRadius;
                }
            },
            {
                name: "smoothness",
                type: ShaderDataType.Float,
                get: () => {
                    return settings.smoothness;
                }
            },
            {
                name: "specularPower",
                type: ShaderDataType.Float,
                get: () => {
                    return settings.specularPower;
                }
            },
            {
                name: "alphaModifier",
                type: ShaderDataType.Float,
                get: () => {
                    return settings.alphaModifier;
                }
            },
            {
                name: "depthModifier",
                type: ShaderDataType.Float,
                get: () => {
                    return settings.depthModifier;
                }
            },
            {
                name: "waveBlendingSharpness",
                type: ShaderDataType.Float,
                get: () => {
                    return settings.waveBlendingSharpness;
                }
            },
            {
                name: "planetInverseRotationQuaternion",
                type: ShaderDataType.Quaternion,
                get: () => {
                    return planet.transform.getInverseRotationQuaternion();
                }
            },
            {
                name: "time",
                type: ShaderDataType.Float,
                get: () => {
                    //TODO: do not hardcode the 100000
                    // use rotating time offset to prevent float imprecision and distant artifacts
                    return this.internalTime % 100000;
                }
            }
        ];

        const samplers: ShaderSamplers = [
            ...getSamplers(scene),
            {
                name: "normalMap1",
                type: ShaderDataType.Texture,
                get: () => {
                    return Assets.WaterNormalMap1;
                }
            },
            {
                name: "normalMap2",
                type: ShaderDataType.Texture,
                get: () => {
                    return Assets.WaterNormalMap2;
                }
            }
        ];

        super(name, planet, shaderName, uniforms, samplers, scene);

        this.settings = settings;
    }
}