import {
    Engine,
    Scene,
    Color4,
    DepthRenderer,
    Axis,
    Space,
    Vector3,
    Texture,
    Tools,
    FxaaPostProcess,
    VolumetricLightScatteringPostProcess
} from "@babylonjs/core";

import {SolidPlanet} from "./components/celestialBodies/planets/solid/solidPlanet";
import {Star} from "./components/celestialBodies/stars/star";

import {PlayerController} from "./components/player/playerController";

import {Keyboard} from "./components/inputs/keyboard";
import {Mouse} from "./components/inputs/mouse";
import {Gamepad} from "./components/inputs/gamepad";

import {CollisionWorker} from "./components/workers/collisionWorker";
import {StarSystemManager} from "./components/celestialBodies/starSystemManager";

import rockn from "../asset/textures/rockn.png";

import {FlatCloudsPostProcess} from "./components/postProcesses/planetPostProcesses/flatCloudsPostProcess";
import {RingsPostProcess} from "./components/postProcesses/planetPostProcesses/ringsPostProcess";
import {VolumetricCloudsPostProcess} from "./components/postProcesses/planetPostProcesses/volumetricCloudsPostProcess";
import {StarfieldPostProcess} from "./components/postProcesses/starfieldPostProcess";
import {OceanPostProcess} from "./components/postProcesses/planetPostProcesses/oceanPostProcess";
import {
    AtmosphericScatteringPostProcess
} from "./components/postProcesses/planetPostProcesses/atmosphericScatteringPostProcess";


import * as style from "../styles/style.scss";

style.default;

let canvas = document.getElementById("renderer") as HTMLCanvasElement;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let engine = new Engine(canvas);
engine.loadingScreen.displayLoadingUI();

console.log("GPU utilisé : " + engine.getGlInfo().renderer);

let scene = new Scene(engine);
scene.clearColor = new Color4(0, 0, 0, 1);

let depthRenderer = new DepthRenderer(scene);
scene.renderTargetsEnabled = true;
scene.customRenderTargets.push(depthRenderer.getDepthMap());
depthRenderer.getDepthMap().renderList = [];

const radius = 1000 * 1e3; // diamètre en m

let keyboard = new Keyboard();
let mouse = new Mouse();
let gamepad = new Gamepad();

let player = new PlayerController(scene);
player.setSpeed(0.2 * radius);
player.mesh.rotate(player.camera.getDirection(Axis.Y), 0.8, Space.WORLD);

player.camera.maxZ = Math.max(radius * 50, 10000);

//https://github.com/BabylonJS/Babylon.js/issues/7133 messing around with depth buffer
/*engine.setDepthFunctionToGreaterOrEqual();
scene.autoClear = false;
scene.autoClearDepthAndStencil = false;
scene.setRenderingAutoClearDepthStencil(0, false, false, false);
scene.setRenderingAutoClearDepthStencil(1, false, false, false);
scene.onBeforeDrawPhaseObservable.add((scene, state) => {
    const gl = scene.getEngine()._gl;
    gl.clearDepth(0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
});*/

let starSystemManager = new StarSystemManager(64);

let sun = new Star("Weierstrass", 0.4 * radius, new Vector3(-910000, 0, -1700000), scene);

starSystemManager.addStar(sun);

depthRenderer.getDepthMap().renderList?.push(sun.mesh);

let starfield = new StarfieldPostProcess("starfield", sun, scene);

let planet = new SolidPlanet("Hécate", radius, new Vector3(0, 0, 4 * radius), 1, scene);
planet.physicalProperties.rotationPeriod = 20;
planet.colorSettings.plainColor = new Vector3(0.1, 0.4, 0).scale(0.7).add(new Vector3(0.5, 0.3, 0.08).scale(0.3));
planet.colorSettings.sandSize = 300;
planet.colorSettings.steepSharpness = 3;

planet.updateColors();
planet.attachNode.position.x = radius * 5;

planet.rotate(Axis.X, 0.2);

let ocean = new OceanPostProcess("ocean", planet, sun, scene);

let flatClouds = new FlatCloudsPostProcess("clouds", planet, radius + 15e3, sun, scene);
//let volClouds = new VolumetricCloudsPostProcess("clouds", planet, radius + waterElevation + 100e3, sun, player.camera, scene);

let atmosphere = new AtmosphericScatteringPostProcess("atmosphere", planet, radius + 100e3, sun, scene);

let rings = new RingsPostProcess("rings", planet, sun, scene);

starSystemManager.addSolidPlanet(planet);

let moon = new SolidPlanet("Manaleth", radius / 4, new Vector3(Math.cos(2.5), 0, Math.sin(2.5)).scale(3 * radius), 1, scene, {
    rotationPeriod: 60 * 60,
    rotationAxis: Axis.Y,

    minTemperature: -180,
    maxTemperature: 200,
    pressure: 0,
    waterAmount: 0.5
});
moon.terrainSettings.continentsFragmentation = 1;
moon.terrainSettings.maxMountainHeight = 5e3;
moon.colorSettings.plainColor = new Vector3(0.5, 0.5, 0.5);
moon.colorSettings.sandColor = moon.colorSettings.plainColor.scale(0.5);
moon.colorSettings.steepColor = new Vector3(0.1, 0.1, 0.1);
moon.colorSettings.steepSharpness = 3;
moon.updateColors();

moon.surfaceMaterial.setTexture("plainNormalMap", new Texture(rockn, scene));
moon.surfaceMaterial.setTexture("bottomNormalMap", new Texture(rockn, scene));
moon.surfaceMaterial.setTexture("sandNormalMap", new Texture(rockn, scene));

moon.translate(planet.attachNode.getAbsolutePosition());

starSystemManager.addSolidPlanet(moon);

let Ares = new SolidPlanet("Ares", radius, new Vector3(0, 0, 4 * radius), 1, scene, {
    rotationPeriod: 60 * 60,
    rotationAxis: Axis.Y,

    minTemperature: -80,
    maxTemperature: 20,
    pressure: 0.5,
    waterAmount: 0.3
});
Ares.terrainSettings.continentsFragmentation = 0.7;
Ares.terrainSettings.continentBaseHeight = 4e3;
Ares.terrainSettings.maxMountainHeight = 15e3;
Ares.terrainSettings.mountainsMinValue = 0.7;
Ares.colorSettings.sandColor = Ares.colorSettings.plainColor;
Ares.colorSettings.steepSharpness = 2;

Ares.updateColors();
Ares.attachNode.position.x = -radius * 4;

let atmosphere2 = new AtmosphericScatteringPostProcess("atmosphere", Ares, radius + 70e3, sun, scene);
atmosphere2.settings.intensity = 15 * Ares.physicalProperties.pressure;
atmosphere2.settings.greenWaveLength = 680;

starSystemManager.addSolidPlanet(Ares);

// TODO: mettre le VLS dans Star => par extension créer un système de gestion des post process généralisé
let vls = new VolumetricLightScatteringPostProcess("trueLight", 1, player.camera, sun.mesh, 100);
vls.exposure = 1.0;
vls.decay = 0.95;

let fxaa = new FxaaPostProcess("fxaa", 1, player.camera, Texture.BILINEAR_SAMPLINGMODE);

let isMouseEnabled = false;

let collisionWorker = new CollisionWorker(player, starSystemManager);

function updateScene() {
    player.nearestBody = starSystemManager.getNearestPlanet();

    if (player.nearestBody != null && player.nearestBody.getAbsolutePosition().length() < player.nearestBody.getRadius() * 2) {
        document.getElementById("planetName")!.innerText = player.nearestBody.getName();
        player.isOrbiting = true;
    } else {
        document.getElementById("planetName")!.innerText = "Outer Space";
        player.isOrbiting = false;
    }

    starSystemManager.update(player, sun.mesh.position, depthRenderer);

    if (isMouseEnabled) {
        player.listenToMouse(mouse, engine.getDeltaTime() / 1000);
    }

    gamepad.update();

    let deplacement = player.listenToGamepad(gamepad, engine.getDeltaTime() / 1000);

    deplacement.addInPlace(player.listenToKeyboard(keyboard, engine.getDeltaTime() / 1000));

    starSystemManager.translateAllCelestialBody(deplacement);

    //starSystemManager.rotateAllAround(Vector3.Zero(), Axis.Y, 0.1 * engine.getDeltaTime() / 1000);

    if (!collisionWorker.isBusy() && player.nearestBody != null && player.nearestBody.getAbsolutePosition().length() < player.nearestBody.getRadius() * 2) {
        if (player.nearestBody instanceof SolidPlanet) {
            //FIXME: se passer de instanceof
            collisionWorker.checkCollision(player.nearestBody);
        }
    }
}

document.addEventListener("keydown", e => {
    if (e.key == "p") { // take screenshots
        Tools.CreateScreenshotUsingRenderTarget(engine, player.camera, {precision: 4});
    }
    //if (e.key == "u") atmosphere.settings.intensity = (atmosphere.settings.intensity == 0) ? 15 : 0;
    if (e.key == "o") ocean.settings.oceanRadius = (ocean.settings.oceanRadius == 0) ? planet.getRadius() : 0;
    if (e.key == "y") flatClouds.settings.cloudLayerRadius = (flatClouds.settings.cloudLayerRadius == 0) ? radius + 15e3 : 0;
    if (e.key == "m") isMouseEnabled = !isMouseEnabled;
    if (e.key == "w" && player.nearestBody != null) (<SolidPlanet><unknown>player.nearestBody).surfaceMaterial.wireframe = !(<SolidPlanet><unknown>player.nearestBody).surfaceMaterial.wireframe;
});

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    engine.resize();
});

scene.executeWhenReady(() => {
    engine.loadingScreen.hideLoadingUI();
    scene.beforeRender = updateScene;
    engine.runRenderLoop(() => scene.render());
});
