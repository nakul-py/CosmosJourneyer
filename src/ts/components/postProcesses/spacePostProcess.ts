import {Camera, Effect, Matrix, PostProcess, Scene, Texture, Vector3} from "@babylonjs/core";
import {CShaderData, ShaderDataType, ShaderSamplerData, ShaderUniformData} from "./interfaces";

export abstract class SpacePostProcess extends PostProcess {
    camera: Camera;

    uniforms: ShaderUniformData;
    samplers: ShaderSamplerData;

    protected constructor(name: string, fragmentURL: string, uniforms: ShaderUniformData, samplers: ShaderSamplerData, scene: Scene) {

        let commonUniforms: ShaderUniformData = {
            "cameraPosition": {
                type: ShaderDataType.Vector3,
                get: () => {return Vector3.Zero()}
            },
            "projection": {
                type: ShaderDataType.Matrix,
                get: () => {return scene.activeCamera!.getProjectionMatrix()}
            },
            "view": {
                type: ShaderDataType.Matrix,
                get: () => {return scene.activeCamera!.getViewMatrix()}
            },

            "cameraNear": {
                type: ShaderDataType.Float,
                get: () => {return scene.activeCamera!.minZ}
            },
            "cameraFar": {
                type: ShaderDataType.Float,
                get: () => {return scene.activeCamera!.maxZ}
            }
        }

        let commonSamplers: ShaderSamplerData = {
            "textureSampler": {
                type: ShaderDataType.Auto,
                get: () => {return 0}
            },
            "depthSampler": {
                type: ShaderDataType.Texture,
                get: () => {return scene.customRenderTargets[0]}
            }
        }

        Object.assign(commonUniforms, commonUniforms, uniforms);
        Object.assign(commonSamplers, commonSamplers, samplers);

        super(name, fragmentURL, Object.keys(commonUniforms), Object.keys(commonSamplers), 1, scene.activeCamera!, Texture.BILINEAR_SAMPLINGMODE, scene.getEngine(), false);

        this.camera = scene.activeCamera!;
        this.setCamera(this.camera);

        this.uniforms = commonUniforms;
        this.samplers = commonSamplers;

        this.onApply = (effect: Effect) => {
            for(const uniformName in this.uniforms) {
                switch (this.uniforms[uniformName].type) {
                    case ShaderDataType.Float:
                        effect.setFloat(uniformName, (this.uniforms[uniformName] as CShaderData<number>).get());
                        break;
                    case ShaderDataType.Vector3:
                        effect.setVector3(uniformName, (this.uniforms[uniformName] as CShaderData<Vector3>).get());
                        break;
                    case ShaderDataType.Matrix:
                        effect.setMatrix(uniformName, (this.uniforms[uniformName] as CShaderData<Matrix>).get());
                        break;
                }
            }

            for(const samplerName in this.samplers) {
                switch (this.samplers[samplerName].type) {
                    case ShaderDataType.Texture:
                        effect.setTexture(samplerName, (this.samplers[samplerName] as CShaderData<Texture>).get());
                        break;
                }
            }
        };
    }
    setCamera(camera: Camera) {
        this.camera.detachPostProcess(this);
        this.camera = camera;
        camera.attachPostProcess(this);
    }
}