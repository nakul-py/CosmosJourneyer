import {Color3, Scene, Texture, Vector3} from "@babylonjs/core";

import {CloudSettings, ShaderDataType, ShaderSamplerData, ShaderUniformData} from "../interfaces";
import normalMap from "../../../asset/textures/cloudNormalMap2.jpg";
import {PlanetPostProcess} from "../planetPostProcess";
import {Star} from "../../celestialBodies/stars/star";
import {AbstractPlanet} from "../../celestialBodies/planets/abstractPlanet";
import {gcd} from "../../utils/math";

export class FlatCloudsPostProcess extends PlanetPostProcess {

    settings: CloudSettings;

    constructor(name: string, planet: AbstractPlanet, cloudLayerHeight: number, sun: Star, scene: Scene) {

        let settings: CloudSettings = {
            cloudLayerRadius: planet.getApparentRadius() + cloudLayerHeight,
            specularPower: 2,
            smoothness: 0.9,
            cloudFrequency: 4,
            cloudDetailFrequency: 20,
            cloudPower: 2,
            cloudSharpness: 7,
            cloudColor: new Color3(0.8, 0.8, 0.8),
            worleySpeed: 0.0005,
            detailSpeed: 0.003,
        };

        let uniforms: ShaderUniformData = {
            "cloudLayerRadius": {
                type: ShaderDataType.Float,
                get: () => {
                    return settings.cloudLayerRadius
                }
            },
            "cloudFrequency": {
                type: ShaderDataType.Float,
                get: () => {
                    return settings.cloudFrequency
                }
            },
            "cloudDetailFrequency": {
                type: ShaderDataType.Float,
                get: () => {
                    return settings.cloudDetailFrequency
                }
            },
            "cloudPower": {
                type: ShaderDataType.Float,
                get: () => {
                    return settings.cloudPower
                }
            },
            "cloudSharpness": {
                type: ShaderDataType.Float,
                get: () => {
                    return settings.cloudSharpness
                }
            },
            "cloudColor": {
                type: ShaderDataType.Color3,
                get: () => {
                    return settings.cloudColor
                }
            },
            "worleySpeed": {
                type: ShaderDataType.Float,
                get: () => {
                    return settings.worleySpeed
                }
            },
            "detailSpeed": {
                type: ShaderDataType.Float,
                get: () => {
                    return settings.detailSpeed
                }
            },
            "smoothness": {
                type: ShaderDataType.Float,
                get: () => {
                    return settings.smoothness
                }
            },
            "specularPower": {
                type: ShaderDataType.Float,
                get: () => {
                    return settings.specularPower
                }
            },
            "planetWorldMatrix": {
                type: ShaderDataType.Matrix,
                get: () => {
                    return planet.getWorldMatrix()
                }
            },
            "time": {
                type: ShaderDataType.Float,
                get: () => {
                    return this.internalTime % (2 * Math.PI * gcd(this.settings.worleySpeed * 10000, this.settings.detailSpeed * 10000) / this.settings.worleySpeed);
                }
            }
        };

        let samplers: ShaderSamplerData = {
            "normalMap": {
                type: ShaderDataType.Texture,
                get: () => {
                    return new Texture(normalMap, scene)
                }
            }
        }

        super(name, "./shaders/flatClouds", uniforms, samplers, planet, sun, scene);

        this.settings = settings;
    }
}