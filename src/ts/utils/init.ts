import { DepthRenderer, Engine, Scene } from "@babylonjs/core";

export function initCanvasEngineScene(idCanvas: string): [HTMLCanvasElement, Engine, Scene] {
    const canvas = document.getElementById(idCanvas) as HTMLCanvasElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const engine = new Engine(canvas);
    engine.loadingScreen.displayLoadingUI();

    console.log("GPU utilisé : " + engine.getGlInfo().renderer);

    const scene = new Scene(engine);

    return [canvas, engine, scene];
}

export function initDepthRenderer(scene: Scene): DepthRenderer {
    const depthRenderer = new DepthRenderer(scene);
    scene.customRenderTargets.push(depthRenderer.getDepthMap());
    depthRenderer.getDepthMap().renderList = [];

    return depthRenderer;
}