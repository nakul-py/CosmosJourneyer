import { NewtonianTransform } from "../uberCore/transforms/newtonianTransform";
import { Input, InputType } from "../inputs/input";
import { UberCamera } from "../uberCore/uberCamera";
import { AbstractController } from "../uberCore/abstractController";
import { Assets } from "../assets";
import { Keyboard } from "../inputs/keyboard";
import { UberOrbitCamera } from "../uberCore/uberOrbitCamera";
import { Mouse } from "../inputs/mouse";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Thruster } from "./thruster";
import { WarpDrive } from "./warpDrive";
import { parseSpeed } from "../utils/parseSpeed";

export class ShipController extends AbstractController {
    readonly transform: NewtonianTransform;

    readonly rollAuthority = 1;
    readonly pitchAuthority = 1;
    readonly yawAuthority = 1;

    readonly thirdPersonCamera: UberOrbitCamera;
    readonly firstPersonCamera: UberCamera;

    private flightAssistEnabled = true;

    private isWarpDriveEnabled = false;

    private readonly thrusters: Thruster[] = [];

    private readonly warpDrive = new WarpDrive();

    constructor(scene: Scene) {
        super();

        this.transform = new NewtonianTransform("shipTransform");

        this.firstPersonCamera = new UberCamera("firstPersonCamera", Vector3.Zero(), scene);
        this.firstPersonCamera.parent = this.transform.node;

        this.thirdPersonCamera = new UberOrbitCamera("thirdPersonCamera", Vector3.Zero(), scene, 30, 3.14, 1.4);
        this.thirdPersonCamera.parent = this.transform.node;

        const spaceship = Assets.CreateSpaceShipInstance();
        spaceship.parent = this.transform.node;

        spaceship.getChildMeshes().forEach((child) => {
            if (child.name.includes("thruster")) {
                console.log("Found thruster");
                this.addThruster(child);
            }
        });
    }

    public override addInput(input: Input): void {
        super.addInput(input);
        if (input.type == InputType.KEYBOARD) {
            const keyboard = input as Keyboard;
            keyboard.addPressedOnceListener("f", () => {
                this.flightAssistEnabled = !this.flightAssistEnabled;
            });
            keyboard.addPressedOnceListener("h", () => {
                this.toggleWarpDrive();
            });
        }
    }

    private addThruster(mesh: AbstractMesh) {
        const direction = mesh.getDirection(new Vector3(0, 1, 0));
        this.thrusters.push(new Thruster(mesh, direction));
    }

    public getActiveCamera(): UberCamera {
        return this.thirdPersonCamera;
    }

    public toggleWarpDrive() {
        this.isWarpDriveEnabled = !this.isWarpDriveEnabled;
        if (this.isWarpDriveEnabled) for (const thruster of this.thrusters) thruster.setThrottle(0);
    }

    private getTotalAuthority(direction: Vector3) {
        if (this.isWarpDriveEnabled) return Math.max(Vector3.Dot(this.transform.getForwardDirectionLocal(), direction), 0) * 5000000 * this.warpDrive.getThrottle();

        let totalAuthority = 0;
        for (const thruster of this.thrusters) totalAuthority += thruster.getAuthority(direction);
        return totalAuthority;
    }

    listenTo(input: Input, deltaTime: number): Vector3 {
        if (this.getActiveCamera() == this.thirdPersonCamera) {
            if (input.type == InputType.KEYBOARD) {
                const keyboard = input as Keyboard;
                if (keyboard.isPressed("1")) this.thirdPersonCamera.rotatePhi(0.8 * deltaTime);
                if (keyboard.isPressed("3")) this.thirdPersonCamera.rotatePhi(-0.8 * deltaTime);
                if (keyboard.isPressed("5")) this.thirdPersonCamera.rotateTheta(-0.8 * deltaTime);
                if (keyboard.isPressed("2")) this.thirdPersonCamera.rotateTheta(0.8 * deltaTime);

            } else if (input.type == InputType.MOUSE) {
                const mouse = input as Mouse;
                this.thirdPersonCamera.rotatePhi(mouse.getYaw() * deltaTime);
                this.thirdPersonCamera.rotateTheta(mouse.getPitch() * deltaTime);
            }
        }

        this.transform.rotationAcceleration.x += this.rollAuthority * input.getRoll() * deltaTime;
        this.transform.rotationAcceleration.y += this.pitchAuthority * input.getPitch() * deltaTime;
        this.transform.rotationAcceleration.z += this.yawAuthority * input.getYaw() * deltaTime;

        if (!this.isWarpDriveEnabled) for (const thruster of this.thrusters) {
            thruster.updateThrottle(0.3 * deltaTime * input.getZAxis() * thruster.getForwardAuthority01());
            thruster.updateThrottle(0.3 * deltaTime * -input.getZAxis() * thruster.getBackwardAuthority01());

            thruster.updateThrottle(0.3 * deltaTime * input.getYAxis() * thruster.getUpwardAuthority01());
            thruster.updateThrottle(0.3 * deltaTime * -input.getYAxis() * thruster.getDownwardAuthority01());

            thruster.updateThrottle(0.3 * deltaTime * input.getXAxis() * thruster.getLeftAuthority01());
            thruster.updateThrottle(0.3 * deltaTime * -input.getXAxis() * thruster.getRightAuthority01());
        }

        const forwardAcceleration = this.transform.getForwardDirection()
            .scale(this.getTotalAuthority(this.transform.getForwardDirectionLocal()) * deltaTime);
        const backwardAcceleration = this.transform.getBackwardDirection()
            .scale(this.getTotalAuthority(this.transform.getBackwardDirectionLocal()) * deltaTime);

        const upwardAcceleration = this.transform.getUpwardDirection()
            .scale(this.getTotalAuthority(this.transform.getUpwardDirectionLocal()) * deltaTime);
        const downwardAcceleration = this.transform.getDownwardDirection()
            .scale(this.getTotalAuthority(this.transform.getDownwardDirectionLocal()) * deltaTime);

        const rightAcceleration = this.transform.getRightDirection()
            .scale(this.getTotalAuthority(this.transform.getRightDirectionLocal()) * deltaTime);
        const leftAcceleration = this.transform.getLeftDirection()
            .scale(this.getTotalAuthority(this.transform.getLeftDirectionLocal()) * deltaTime);

        this.transform.acceleration.addInPlace(forwardAcceleration);
        this.transform.acceleration.addInPlace(backwardAcceleration);

        this.transform.acceleration.addInPlace(upwardAcceleration);
        this.transform.acceleration.addInPlace(downwardAcceleration);

        this.transform.acceleration.addInPlace(rightAcceleration);
        this.transform.acceleration.addInPlace(leftAcceleration);

        return Vector3.Zero();
    }

    update(deltaTime: number): Vector3 {
        this.transform.rotationAcceleration.copyFromFloats(0, 0, 0);
        this.transform.acceleration.copyFromFloats(0, 0, 0);
        for (const input of this.inputs) this.listenTo(input, deltaTime);
        const displacement = this.transform.update(deltaTime).negate();

        for (const thruster of this.thrusters) {
            thruster.update();
            const direction = thruster.getDirection();
            const worldMatrix = this.transform.node.getWorldMatrix();
            const localDirection = Vector3.TransformNormal(direction, worldMatrix);
            thruster.plume.setDirection(localDirection.negate());
            thruster.plume.applyAcceleration(this.transform.acceleration.negate());
        };

        if (this.flightAssistEnabled && this.transform.rotationAcceleration.length() == 0) {
            this.transform.rotationSpeed.scaleInPlace(0.9);
        }

        (document.querySelector("#speedometer") as HTMLElement).innerHTML = `${parseSpeed(this.transform.speed.length())}`;

        this.transform.translate(displacement);
        return displacement;
    }
}