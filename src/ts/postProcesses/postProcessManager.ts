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

import { UberScene } from "../uberCore/uberScene";
import { OceanPostProcess } from "../ocean/oceanPostProcess";
import { TelluricPlanet } from "../planets/telluricPlanet/telluricPlanet";
import { FlatCloudsPostProcess } from "../clouds/flatCloudsPostProcess";
import { AtmosphericScatteringPostProcess } from "../atmosphere/atmosphericScatteringPostProcess";
import { RingsPostProcess } from "../rings/ringsPostProcess";
import { VolumetricLight } from "../volumetricLight/volumetricLight";
import { BlackHolePostProcess } from "../stellarObjects/blackHole/blackHolePostProcess";
import { GasPlanet } from "../planets/gasPlanet/gasPlanet";
import { ColorCorrection } from "./colorCorrection";
import { FxaaPostProcess } from "@babylonjs/core/PostProcesses/fxaaPostProcess";
import { PostProcessRenderEffect } from "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderEffect";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent";
import { MandelbulbPostProcess } from "../anomalies/mandelbulb/mandelbulbPostProcess";
import { ShadowPostProcess } from "./shadowPostProcess";
import { LensFlarePostProcess } from "./lensFlarePostProcess";
import { UpdatablePostProcess } from "./updatablePostProcess";
import { MatterJetPostProcess } from "./matterJetPostProcess";
import { Star } from "../stellarObjects/star/star";
import { BlackHole } from "../stellarObjects/blackHole/blackHole";
import { NeutronStar } from "../stellarObjects/neutronStar/neutronStar";
import { PostProcessRenderPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipeline";
import { PostProcessRenderPipelineManager } from "@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManager";
import { JuliaSetPostProcess } from "../anomalies/julia/juliaSetPostProcess";
import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { BloomEffect } from "@babylonjs/core/PostProcesses/bloomEffect";
import { Constants } from "@babylonjs/core/Engines/constants";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { getRgbFromTemperature } from "../utils/specrend";
import { PostProcessType } from "./postProcessTypes";
import { MandelboxPostProcess } from "../anomalies/mandelbox/mandelboxPostProcess";
import { SierpinskiPyramidPostProcess } from "../anomalies/sierpinskiPyramid/sierpinskiPyramidPostProcess";
import { MengerSpongePostProcess } from "../anomalies/mengerSponge/mengerSpongePostProcess";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { MandelbulbModel } from "../anomalies/mandelbulb/mandelbulbModel";
import { JuliaSetModel } from "../anomalies/julia/juliaSetModel";
import { MandelboxModel } from "../anomalies/mandelbox/mandelboxModel";
import { SierpinskiPyramidModel } from "../anomalies/sierpinskiPyramid/sierpinskiPyramidModel";
import { MengerSpongeModel } from "../anomalies/mengerSponge/mengerSpongeModel";
import { CelestialBody, StellarObject } from "../architecture/orbitalObject";
import { DeepReadonly } from "../utils/types";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Textures } from "../assets/textures";

/**
 * The order in which the post processes are rendered when away from a planet
 */
const spaceRenderingOrder: PostProcessType[] = [
    PostProcessType.VOLUMETRIC_LIGHT,
    PostProcessType.MATTER_JETS,
    PostProcessType.OCEAN,
    PostProcessType.CLOUDS,
    PostProcessType.ATMOSPHERE,
    PostProcessType.MANDELBULB,
    PostProcessType.JULIA_SET,
    PostProcessType.MANDELBOX,
    PostProcessType.SIERPINSKI_PYRAMID,
    PostProcessType.MENGER_SPONGE,
    PostProcessType.RING,
    PostProcessType.BLACK_HOLE
];

/**
 * The order in which the post processes are rendered when close to a planet
 */
const surfaceRenderingOrder: PostProcessType[] = [
    PostProcessType.VOLUMETRIC_LIGHT,
    PostProcessType.MATTER_JETS,
    PostProcessType.BLACK_HOLE,
    PostProcessType.MANDELBULB,
    PostProcessType.JULIA_SET,
    PostProcessType.MANDELBOX,
    PostProcessType.SIERPINSKI_PYRAMID,
    PostProcessType.MENGER_SPONGE,
    PostProcessType.RING,
    PostProcessType.OCEAN,
    PostProcessType.CLOUDS,
    PostProcessType.ATMOSPHERE
];

/**
 * Manages all post processes in the scene.
 * The manager dynamically creates the rendering pipeline depending on the current body.
 * This is necessary so the effects are rendered in the correct order. (other objects -> body -> overlays)
 */
export class PostProcessManager {
    /**
     * The BabylonJS engine
     */
    readonly engine: AbstractEngine;

    /**
     * The scene where the solar system is rendered.
     * It needs to use the wrapper as the post-processes need the depth renderer of the scene.
     */
    readonly scene: UberScene;

    /**
     * The BabylonJS rendering pipeline manager of the scene
     */
    readonly renderingPipelineManager: PostProcessRenderPipelineManager;

    /**
     * The current rendering pipeline. It is destroyed and recreated every time the closest orbital object changes or when the camera changes.
     * @private
     */
    private renderingPipeline: PostProcessRenderPipeline;

    /**
     * The order in which to add the post-processes to the rendering pipeline. This is important as this order determines the rendering order.
     * For now, there are 2 different orders: one when in space, and one when close to a planet.
     * @private
     */
    private currentRenderingOrder: PostProcessType[] = spaceRenderingOrder;

    /**
     * The closest celestial body to the active camera. This is useful to split post-processes that are specific to a body from the others.
     * @private
     */
    private currentBody: CelestialBody | null = null;

    readonly volumetricLights: VolumetricLight[] = [];
    readonly oceans: OceanPostProcess[] = [];
    readonly clouds: FlatCloudsPostProcess[] = [];
    readonly atmospheres: AtmosphericScatteringPostProcess[] = [];
    readonly rings: RingsPostProcess[] = [];
    readonly mandelbulbs: MandelbulbPostProcess[] = [];
    readonly mandelboxes: MandelboxPostProcess[] = [];
    readonly sierpinskiPyramids: SierpinskiPyramidPostProcess[] = [];
    readonly mengerSponges: MengerSpongePostProcess[] = [];
    readonly juliaSets: JuliaSetPostProcess[] = [];
    readonly blackHoles: BlackHolePostProcess[] = [];
    readonly matterJets: MatterJetPostProcess[] = [];
    readonly shadows: ShadowPostProcess[] = [];
    readonly lensFlares: LensFlarePostProcess[] = [];

    private readonly objectPostProcesses: PostProcess[][] = [
        this.volumetricLights,
        this.oceans,
        this.clouds,
        this.atmospheres,
        this.rings,
        this.mandelbulbs,
        this.juliaSets,
        this.mandelboxes,
        this.sierpinskiPyramids,
        this.mengerSponges,
        this.blackHoles,
        this.matterJets,
        this.shadows,
        this.lensFlares
    ];

    /**
     * All post processes that are updated every frame.
     */
    private readonly updatablePostProcesses: UpdatablePostProcess[][] = [
        this.oceans,
        this.clouds,
        this.blackHoles,
        this.matterJets,
        this.mandelbulbs,
        this.juliaSets,
        this.mandelboxes,
        this.sierpinskiPyramids
    ];

    readonly celestialBodyToPostProcesses: Map<TransformNode, PostProcess[]> = new Map();

    /**
     * The color correction post process responsible for tone mapping, saturation, contrast, brightness and gamma.
     */
    readonly colorCorrection: ColorCorrection;

    /**
     * The FXAA post process responsible for antialiasing.
     */
    readonly fxaa: FxaaPostProcess;

    /**
     * The effect storing the color correction post process.
     */
    readonly colorCorrectionRenderEffect: PostProcessRenderEffect;

    /**
     * The effect storing the FXAA post process.
     */
    readonly fxaaRenderEffect: PostProcessRenderEffect;

    readonly bloomRenderEffect: BloomEffect;

    private readonly textures: Textures;

    constructor(textures: Textures, scene: UberScene) {
        this.scene = scene;
        this.engine = scene.getEngine();

        this.textures = textures;

        this.renderingPipelineManager = scene.postProcessRenderPipelineManager;

        this.colorCorrection = new ColorCorrection("colorCorrection", scene);
        this.colorCorrection.exposure = 1.1;
        this.colorCorrection.gamma = 1.0;
        this.colorCorrection.saturation = 1.5;

        this.fxaa = new FxaaPostProcess(
            "fxaa",
            1,
            null,
            Texture.BILINEAR_SAMPLINGMODE,
            scene.getEngine(),
            false,
            Constants.TEXTURETYPE_HALF_FLOAT
        );

        this.colorCorrectionRenderEffect = new PostProcessRenderEffect(
            scene.getEngine(),
            "colorCorrectionRenderEffect",
            () => {
                return [this.colorCorrection];
            }
        );
        this.fxaaRenderEffect = new PostProcessRenderEffect(scene.getEngine(), "fxaaRenderEffect", () => {
            return [this.fxaa];
        });

        this.renderingPipeline = new PostProcessRenderPipeline(scene.getEngine(), "renderingPipeline");
        this.renderingPipelineManager.addPipeline(this.renderingPipeline);

        this.bloomRenderEffect = new BloomEffect(scene, 1.0, 0.3, 32, Constants.TEXTURETYPE_HALF_FLOAT);
        this.bloomRenderEffect.threshold = 0.0;
    }

    private makeSplitRenderEffects(
        name: string,
        body: CelestialBody,
        postProcesses: ReadonlyArray<PostProcess>,
        engine: AbstractEngine
    ): [PostProcessRenderEffect, PostProcessRenderEffect] {
        const bodyPostProcesses = this.celestialBodyToPostProcesses.get(body.getTransform()) ?? [];
        const relevantPostProcesses = postProcesses.filter((postProcess) => bodyPostProcesses.includes(postProcess));

        const otherPostProcesses = postProcesses.filter((postProcess) => !relevantPostProcesses.includes(postProcess));

        const otherRenderEffect = new PostProcessRenderEffect(engine, `other${name}RenderEffect`, () => {
            return otherPostProcesses;
        });
        const relevantRenderEffect = new PostProcessRenderEffect(engine, `body${name}RenderEffect`, () => {
            return relevantPostProcesses;
        });

        return [otherRenderEffect, relevantRenderEffect];
    }

    public addStar(star: Star, excludedMeshes: AbstractMesh[]) {
        const postProcesses: PostProcess[] = [];
        const volumetricLight = new VolumetricLight(
            star.mesh,
            star.volumetricLightUniforms,
            excludedMeshes,
            this.scene
        );
        this.volumetricLights.push(volumetricLight);
        postProcesses.push(volumetricLight);

        const lensFlare = new LensFlarePostProcess(
            star.getTransform(),
            star.getBoundingRadius(),
            getRgbFromTemperature(star.model.blackBodyTemperature),
            this.scene
        );
        this.lensFlares.push(lensFlare);
        postProcesses.push(lensFlare);

        if (star.ringsUniforms !== null) {
            const rings = new RingsPostProcess(star.getTransform(), star.ringsUniforms, star.model, [], this.scene);
            this.rings.push(rings);
            postProcesses.push(rings);
        }

        this.celestialBodyToPostProcesses.set(star.getTransform(), postProcesses);
    }

    public addNeutronStar(neutronStar: NeutronStar, excludedMeshes: AbstractMesh[]) {
        const postProcesses: PostProcess[] = [];
        const volumetricLight = new VolumetricLight(
            neutronStar.mesh,
            neutronStar.volumetricLightUniforms,
            excludedMeshes,
            this.scene
        );
        this.volumetricLights.push(volumetricLight);
        postProcesses.push(volumetricLight);

        const lensFlare = new LensFlarePostProcess(
            neutronStar.getTransform(),
            neutronStar.getBoundingRadius(),
            getRgbFromTemperature(neutronStar.model.blackBodyTemperature),
            this.scene
        );
        this.lensFlares.push(lensFlare);
        postProcesses.push(lensFlare);

        const matterJets = new MatterJetPostProcess(
            neutronStar.getTransform(),
            neutronStar.getBoundingRadius(),
            neutronStar.model.dipoleTilt,
            this.scene
        );
        this.matterJets.push(matterJets);
        postProcesses.push(matterJets);

        if (neutronStar.ringsUniforms !== null) {
            const rings = new RingsPostProcess(
                neutronStar.getTransform(),
                neutronStar.ringsUniforms,
                neutronStar.model,
                [],
                this.scene
            );
            this.rings.push(rings);
            postProcesses.push(rings);
        }

        this.celestialBodyToPostProcesses.set(neutronStar.getTransform(), postProcesses);
    }

    /**
     * Creates a new BlackHole postprocess for the given black hole and adds it to the manager.
     * @param blackHole A black hole
     */
    public addBlackHole(blackHole: BlackHole) {
        const blackHolePostProcess = new BlackHolePostProcess(
            blackHole.getTransform(),
            blackHole.blackHoleUniforms,
            this.scene
        );
        this.blackHoles.push(blackHolePostProcess);

        this.celestialBodyToPostProcesses.set(blackHole.getTransform(), [blackHolePostProcess]);
    }

    public addTelluricPlanet(planet: TelluricPlanet, stellarObjects: ReadonlyArray<StellarObject>) {
        const postProcesses: PostProcess[] = [];

        if (planet.atmosphereUniforms !== null) {
            const atmosphere = new AtmosphericScatteringPostProcess(
                planet.getTransform(),
                planet.getBoundingRadius(),
                planet.atmosphereUniforms,
                stellarObjects.map((star) => star.getLight()),
                this.scene
            );
            this.atmospheres.push(atmosphere);
            postProcesses.push(atmosphere);
        }

        if (planet.oceanUniforms !== null) {
            const ocean = new OceanPostProcess(
                planet.getTransform(),
                planet.getBoundingRadius(),
                planet.oceanUniforms,
                stellarObjects.map((star) => star.getLight()),
                this.textures.water,
                this.scene
            );
            this.oceans.push(ocean);
            postProcesses.push(ocean);
        }

        if (planet.cloudsUniforms !== null) {
            const clouds = new FlatCloudsPostProcess(
                planet.getTransform(),
                planet.getBoundingRadius(),
                planet.cloudsUniforms,
                stellarObjects.map((star) => star.getLight()),
                this.scene
            );
            this.clouds.push(clouds);
            postProcesses.push(clouds);
        }

        if (planet.ringsUniforms !== null) {
            const rings = new RingsPostProcess(
                planet.getTransform(),
                planet.ringsUniforms,
                planet.model,
                stellarObjects.map((star) => star.getLight()),
                this.scene
            );
            this.rings.push(rings);
            postProcesses.push(rings);
        }

        const shadow = new ShadowPostProcess(
            planet.getTransform(),
            planet.getBoundingRadius(),
            planet.ringsUniforms,
            planet.cloudsUniforms,
            planet.model.ocean !== null,
            stellarObjects,
            this.scene
        );
        this.shadows.push(shadow);
        postProcesses.push(shadow);

        this.celestialBodyToPostProcesses.set(planet.getTransform(), postProcesses);
    }

    public addGasPlanet(planet: GasPlanet, stellarObjects: ReadonlyArray<StellarObject>) {
        const postProcesses: PostProcess[] = [];

        if (planet.atmosphereUniforms !== null) {
            const atmosphere = new AtmosphericScatteringPostProcess(
                planet.getTransform(),
                planet.getBoundingRadius(),
                planet.atmosphereUniforms,
                stellarObjects.map((star) => star.getLight()),
                this.scene
            );
            this.atmospheres.push(atmosphere);
            postProcesses.push(atmosphere);
        }

        if (planet.ringsUniforms !== null) {
            const rings = new RingsPostProcess(
                planet.getTransform(),
                planet.ringsUniforms,
                planet.model,
                stellarObjects.map((star) => star.getLight()),
                this.scene
            );
            this.rings.push(rings);
            postProcesses.push(rings);
        }

        const shadow = new ShadowPostProcess(
            planet.getTransform(),
            planet.getBoundingRadius(),
            planet.ringsUniforms,
            null,
            false,
            stellarObjects,
            this.scene
        );
        this.shadows.push(shadow);
        postProcesses.push(shadow);

        this.celestialBodyToPostProcesses.set(planet.getTransform(), postProcesses);
    }
    /**
     * Creates a new Mandelbulb postprocess for the given body and adds it to the manager.
     * @param transform The transform of the body
     * @param radius The bounding radius of the body
     * @param model The model of the Mandelbulb
     * @param stellarObjects An array of stars or black holes
     */
    public addMandelbulb(
        transform: TransformNode,
        radius: number,
        model: DeepReadonly<MandelbulbModel>,
        stellarObjects: ReadonlyArray<PointLight>
    ) {
        const mandelbulb = new MandelbulbPostProcess(transform, radius, model, this.scene, stellarObjects);
        this.mandelbulbs.push(mandelbulb);

        this.celestialBodyToPostProcesses.set(transform, [mandelbulb]);
    }

    /**
     * Creates a new Julia set postprocess for the given julia set and adds it to the manager.
     * @param transform The transform of the Julia set
     * @param radius The bounding radius of the Julia set
     * @param model The model of the Julia set
     * @param stellarObjects An array of stars or black holes
     */
    public addJuliaSet(
        transform: TransformNode,
        radius: number,
        model: DeepReadonly<JuliaSetModel>,
        stellarObjects: ReadonlyArray<PointLight>
    ) {
        const juliaSetPostProcess = new JuliaSetPostProcess(
            transform,
            radius,
            model.accentColor,
            this.scene,
            stellarObjects
        );
        this.juliaSets.push(juliaSetPostProcess);

        this.celestialBodyToPostProcesses.set(transform, [juliaSetPostProcess]);
    }

    public addMandelbox(
        transform: TransformNode,
        radius: number,
        model: DeepReadonly<MandelboxModel>,
        stellarObjects: ReadonlyArray<PointLight>
    ) {
        const mandelbox = new MandelboxPostProcess(transform, radius, model, this.scene, stellarObjects);
        this.mandelboxes.push(mandelbox);

        this.celestialBodyToPostProcesses.set(transform, [mandelbox]);
    }

    public addSierpinskiPyramid(
        transform: TransformNode,
        radius: number,
        model: DeepReadonly<SierpinskiPyramidModel>,
        stellarObjects: ReadonlyArray<PointLight>
    ) {
        const sierpinskiPyramid = new SierpinskiPyramidPostProcess(
            transform,
            radius,
            model,
            this.scene,
            stellarObjects
        );
        this.sierpinskiPyramids.push(sierpinskiPyramid);

        this.celestialBodyToPostProcesses.set(transform, [sierpinskiPyramid]);
    }

    public addMengerSponge(
        transform: TransformNode,
        radius: number,
        model: DeepReadonly<MengerSpongeModel>,
        stellarObjects: ReadonlyArray<PointLight>
    ) {
        const mengerSponge = new MengerSpongePostProcess(transform, radius, model, this.scene, stellarObjects);
        this.mengerSponges.push(mengerSponge);

        this.celestialBodyToPostProcesses.set(transform, [mengerSponge]);
    }

    /**
     * Sets the current celestial body of the post process manager.
     * It should be the closest body to the active camera, in order to split the post processes that are specific to this body from the others.
     * This method will also choose the appropriate rendering order and rebuild the pipeline.
     * @param body The closest celestial body to the active camera
     */
    public setCelestialBody(body: CelestialBody) {
        this.currentBody = body;

        const rings = this.celestialBodyToPostProcesses
            .get(body.getTransform())
            ?.find((pp) => pp instanceof RingsPostProcess);
        const switchLimit = rings !== undefined ? rings.ringsUniforms.model.ringStart : 2;
        const distance2 = Vector3.DistanceSquared(
            body.getTransform().getAbsolutePosition(),
            this.scene.getActiveControls().getTransform().getAbsolutePosition()
        );
        if (distance2 < (switchLimit * body.getBoundingRadius()) ** 2) this.setSurfaceOrder();
        else this.setSpaceOrder();
    }

    /**
     * Sets the rendering order to the space rendering order and rebuilds the pipeline.
     */
    public setSpaceOrder() {
        if (this.currentRenderingOrder === spaceRenderingOrder) return;
        this.currentRenderingOrder = spaceRenderingOrder;
        this.rebuild();
    }

    /**
     * Sets the rendering order to the surface rendering order and rebuilds the pipeline.
     */
    public setSurfaceOrder() {
        if (this.currentRenderingOrder === surfaceRenderingOrder) return;
        this.currentRenderingOrder = surfaceRenderingOrder;
        this.rebuild();
    }

    /**
     * Returns the current celestial body, or throws an error if it is null.
     * @private
     */
    private getCurrentBody() {
        if (this.currentBody === null) throw new Error("No body set to the postProcessManager");
        return this.currentBody;
    }

    /**
     * Rebuilds the rendering pipeline with the current rendering order.
     */
    public rebuild() {
        this.renderingPipelineManager.detachCamerasFromRenderPipeline(this.renderingPipeline.name, this.scene.cameras);
        this.renderingPipelineManager.removePipeline(this.renderingPipeline.name);
        this.renderingPipeline.dispose();

        this.renderingPipeline = new PostProcessRenderPipeline(this.scene.getEngine(), "renderingPipeline");

        const [otherVolumetricLightsRenderEffect, bodyVolumetricLightsRenderEffect] = this.makeSplitRenderEffects(
            "VolumetricLights",
            this.getCurrentBody(),
            this.volumetricLights,
            this.engine
        );
        const [otherBlackHolesRenderEffect, bodyBlackHolesRenderEffect] = this.makeSplitRenderEffects(
            "BlackHoles",
            this.getCurrentBody(),
            this.blackHoles,
            this.engine
        );
        const [otherOceansRenderEffect, bodyOceansRenderEffect] = this.makeSplitRenderEffects(
            "Oceans",
            this.getCurrentBody(),
            this.oceans,
            this.engine
        );
        const [otherCloudsRenderEffect, bodyCloudsRenderEffect] = this.makeSplitRenderEffects(
            "Clouds",
            this.getCurrentBody(),
            this.clouds,
            this.engine
        );
        const [otherAtmospheresRenderEffect, bodyAtmospheresRenderEffect] = this.makeSplitRenderEffects(
            "Atmospheres",
            this.getCurrentBody(),
            this.atmospheres,
            this.engine
        );
        const [otherRingsRenderEffect, bodyRingsRenderEffect] = this.makeSplitRenderEffects(
            "Rings",
            this.getCurrentBody(),
            this.rings,
            this.engine
        );
        const [otherMandelbulbsRenderEffect, bodyMandelbulbsRenderEffect] = this.makeSplitRenderEffects(
            "Mandelbulbs",
            this.getCurrentBody(),
            this.mandelbulbs,
            this.engine
        );
        const [otherJuliaSetsRenderEffect, bodyJuliaSetRenderEffect] = this.makeSplitRenderEffects(
            "JuliaSets",
            this.getCurrentBody(),
            this.juliaSets,
            this.engine
        );
        const [otherMandelboxesRenderEffect, bodyMandelboxRenderEffect] = this.makeSplitRenderEffects(
            "Mandelboxes",
            this.getCurrentBody(),
            this.mandelboxes,
            this.engine
        );
        const [otherSierpinskiPyramidsRenderEffect, bodySierpinskiPyramidsRenderEffect] = this.makeSplitRenderEffects(
            "SierpinskiPyramids",
            this.getCurrentBody(),
            this.sierpinskiPyramids,
            this.engine
        );
        const [otherMengerSpongesRenderEffect, bodyMengerSpongesRenderEffect] = this.makeSplitRenderEffects(
            "MengerSponges",
            this.getCurrentBody(),
            this.mengerSponges,
            this.engine
        );
        const [otherMatterJetsRenderEffect, bodyMatterJetsRenderEffect] = this.makeSplitRenderEffects(
            "MatterJets",
            this.getCurrentBody(),
            this.matterJets,
            this.engine
        );
        const shadowRenderEffect = new PostProcessRenderEffect(this.engine, "ShadowRenderEffect", () => this.shadows);
        const lensFlareRenderEffect = new PostProcessRenderEffect(
            this.engine,
            "LensFlareRenderEffect",
            () => this.lensFlares
        );

        this.renderingPipeline.addEffect(shadowRenderEffect);

        // other objects are viewed in their space configuration
        for (const postProcessType of spaceRenderingOrder) {
            switch (postProcessType) {
                case PostProcessType.VOLUMETRIC_LIGHT:
                    this.renderingPipeline.addEffect(otherVolumetricLightsRenderEffect);
                    break;
                case PostProcessType.BLACK_HOLE:
                    this.renderingPipeline.addEffect(otherBlackHolesRenderEffect);
                    break;
                case PostProcessType.OCEAN:
                    this.renderingPipeline.addEffect(otherOceansRenderEffect);
                    break;
                case PostProcessType.CLOUDS:
                    this.renderingPipeline.addEffect(otherCloudsRenderEffect);
                    break;
                case PostProcessType.ATMOSPHERE:
                    this.renderingPipeline.addEffect(otherAtmospheresRenderEffect);
                    break;
                case PostProcessType.RING:
                    this.renderingPipeline.addEffect(otherRingsRenderEffect);
                    break;
                case PostProcessType.MATTER_JETS:
                    this.renderingPipeline.addEffect(otherMatterJetsRenderEffect);
                    break;
                case PostProcessType.MANDELBULB:
                    this.renderingPipeline.addEffect(otherMandelbulbsRenderEffect);
                    break;
                case PostProcessType.JULIA_SET:
                    this.renderingPipeline.addEffect(otherJuliaSetsRenderEffect);
                    break;
                case PostProcessType.MANDELBOX:
                    this.renderingPipeline.addEffect(otherMandelboxesRenderEffect);
                    break;
                case PostProcessType.SIERPINSKI_PYRAMID:
                    this.renderingPipeline.addEffect(otherSierpinskiPyramidsRenderEffect);
                    break;
                case PostProcessType.MENGER_SPONGE:
                    this.renderingPipeline.addEffect(otherMengerSpongesRenderEffect);
                    break;
                case PostProcessType.SHADOW:
                    //this.renderingPipeline.addEffect(otherShadowRenderEffect);
                    break;
                case PostProcessType.LENS_FLARE:
                    //this.renderingPipeline.addEffect(otherLensFlaresRenderEffect);
                    break;
            }
        }

        // closest object is either in surface or space configuration depending on distance to camera
        for (const postProcessType of this.currentRenderingOrder) {
            switch (postProcessType) {
                case PostProcessType.VOLUMETRIC_LIGHT:
                    this.renderingPipeline.addEffect(bodyVolumetricLightsRenderEffect);
                    break;
                case PostProcessType.BLACK_HOLE:
                    this.renderingPipeline.addEffect(bodyBlackHolesRenderEffect);
                    break;
                case PostProcessType.OCEAN:
                    this.renderingPipeline.addEffect(bodyOceansRenderEffect);
                    break;
                case PostProcessType.CLOUDS:
                    this.renderingPipeline.addEffect(bodyCloudsRenderEffect);
                    break;
                case PostProcessType.ATMOSPHERE:
                    this.renderingPipeline.addEffect(bodyAtmospheresRenderEffect);
                    break;
                case PostProcessType.RING:
                    this.renderingPipeline.addEffect(bodyRingsRenderEffect);
                    break;
                case PostProcessType.MATTER_JETS:
                    this.renderingPipeline.addEffect(bodyMatterJetsRenderEffect);
                    break;
                case PostProcessType.MANDELBULB:
                    this.renderingPipeline.addEffect(bodyMandelbulbsRenderEffect);
                    break;
                case PostProcessType.JULIA_SET:
                    this.renderingPipeline.addEffect(bodyJuliaSetRenderEffect);
                    break;
                case PostProcessType.MANDELBOX:
                    this.renderingPipeline.addEffect(bodyMandelboxRenderEffect);
                    break;
                case PostProcessType.SIERPINSKI_PYRAMID:
                    this.renderingPipeline.addEffect(bodySierpinskiPyramidsRenderEffect);
                    break;
                case PostProcessType.MENGER_SPONGE:
                    this.renderingPipeline.addEffect(bodyMengerSpongesRenderEffect);
                    break;
                case PostProcessType.LENS_FLARE:
                    //this.renderingPipeline.addEffect(bodyLensFlaresRenderEffect);
                    break;
                case PostProcessType.SHADOW:
                    //this.renderingPipeline.addEffect(bodyShadowRenderEffect);
                    break;
            }
        }

        this.renderingPipeline.addEffect(this.bloomRenderEffect);
        this.renderingPipeline.addEffect(lensFlareRenderEffect);
        this.renderingPipeline.addEffect(this.fxaaRenderEffect);
        //this.renderingPipeline.addEffect(this.bloomRenderEffect);
        this.renderingPipeline.addEffect(this.colorCorrectionRenderEffect);

        this.renderingPipelineManager.addPipeline(this.renderingPipeline);
        this.renderingPipelineManager.attachCamerasToRenderPipeline(this.renderingPipeline.name, this.scene.cameras);
    }

    /**
     * Updates all updatable post processes with the given delta time.
     * @param deltaTime The time in seconds since the last frame
     */
    public update(deltaTime: number) {
        for (const postProcess of this.updatablePostProcesses.flat()) postProcess.update(deltaTime);
    }

    /**
     * Disposes of all post-processes tied to a star system (everything except color correction and FXAA).
     * The pipeline is not destroyed as it is always destroyed and recreated when the closest orbital object changes.
     */
    public reset() {
        this.renderingPipelineManager.detachCamerasFromRenderPipeline(this.renderingPipeline.name, this.scene.cameras);
        this.renderingPipelineManager.removePipeline(this.renderingPipeline.name);
        this.renderingPipeline.dispose();

        this.renderingPipeline = new PostProcessRenderPipeline(this.scene.getEngine(), "renderingPipeline");
        this.renderingPipeline.addEffect(this.bloomRenderEffect);
        this.renderingPipeline.addEffect(this.fxaaRenderEffect);
        this.renderingPipeline.addEffect(this.colorCorrectionRenderEffect);

        this.renderingPipelineManager.addPipeline(this.renderingPipeline);
        this.renderingPipelineManager.attachCamerasToRenderPipeline(this.renderingPipeline.name, this.scene.cameras);

        // disposing on every camera is necessary because BabylonJS only detaches the post-processes from a single camera at a time
        this.scene.cameras.forEach((camera) => {
            this.objectPostProcesses.forEach((postProcessList) => {
                postProcessList.forEach((postProcess) => {
                    postProcess.dispose(camera);
                });
            });
        });

        this.objectPostProcesses.forEach((postProcessList) => {
            postProcessList.length = 0;
        });

        this.celestialBodyToPostProcesses.clear();
    }
}
