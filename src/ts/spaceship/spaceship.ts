//  This file is part of Cosmos Journeyer
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

import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MainThruster } from "./mainThruster";
import { WarpDrive } from "./warpDrive";
import { RCSThruster } from "./rcsThruster";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { IPhysicsCollisionEvent, PhysicsMotionType, PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsShapeMesh } from "@babylonjs/core/Physics/v2/physicsShape";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Observable } from "@babylonjs/core/Misc/observable";
import { Axis } from "@babylonjs/core/Maths/math.axis";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { setEnabledBody } from "../utils/havok";
import { getForwardDirection, getRotationQuaternion, getUpwardDirection, rotate, setRotationQuaternion, translate } from "../uberCore/transforms/basicTransform";
import { TransformNode } from "@babylonjs/core/Meshes";
import { Assets } from "../assets";
import { PhysicsRaycastResult } from "@babylonjs/core/Physics/physicsRaycastResult";
import { CollisionMask } from "../settings";
import { Transformable } from "../architecture/transformable";
import { WarpTunnel } from "../utils/warpTunnel";
import { Quaternion } from "@babylonjs/core/Maths/math";
import { LandingPad } from "../landingPad/landingPad";
import { PhysicsEngineV2 } from "@babylonjs/core/Physics/v2";
import { HyperSpaceTunnel } from "../utils/hyperSpaceTunnel";
import { AudioInstance } from "../utils/audioInstance";

enum ShipState {
    FLYING,
    LANDING,
    LANDED
}

export class Spaceship implements Transformable {
    readonly instanceRoot: AbstractMesh;

    readonly aggregate: PhysicsAggregate;
    private readonly collisionObservable: Observable<IPhysicsCollisionEvent>;

    private flightAssistEnabled = true;

    readonly mainThrusters: MainThruster[] = [];
    readonly rcsThrusters: RCSThruster[] = [];

    private readonly warpDrive = new WarpDrive(false);

    private closestWalkableObject: Transformable | null = null;

    private landingTarget: Transformable | null = null;
    private readonly raycastResult = new PhysicsRaycastResult();

    private state = ShipState.FLYING;

    private closestObject = {
        distance: Infinity,
        radius: 1
    };

    readonly warpTunnel: WarpTunnel;
    readonly hyperSpaceTunnel: HyperSpaceTunnel;

    private readonly scene: Scene;

    private targetLandingPad: LandingPad | null = null;

    readonly enableWarpDriveSound: AudioInstance;
    readonly disableWarpDriveSound: AudioInstance;
    readonly acceleratingWarpDriveSound: AudioInstance;
    readonly deceleratingWarpDriveSound: AudioInstance;

    readonly onWarpDriveEnabled = new Observable<void>();
    readonly onWarpDriveDisabled = new Observable<void>();

    constructor(scene: Scene) {
        this.instanceRoot = Assets.CreateSpaceShipInstance();
        setRotationQuaternion(this.instanceRoot, Quaternion.Identity());

        this.aggregate = new PhysicsAggregate(
            this.instanceRoot,
            PhysicsShapeType.CONTAINER,
            {
                mass: 10,
                restitution: 0.2
            },
            scene
        );
        for (const child of this.instanceRoot.getChildMeshes()) {
            const childShape = new PhysicsShapeMesh(child as Mesh, scene);
            childShape.filterMembershipMask = CollisionMask.DYNAMIC_OBJECTS;
            childShape.filterCollideMask = CollisionMask.ENVIRONMENT;
            this.aggregate.shape.addChildFromParent(this.instanceRoot, childShape, child);
        }
        this.aggregate.body.disablePreStep = false;

        this.aggregate.body.setCollisionCallbackEnabled(true);

        this.collisionObservable = this.aggregate.body.getCollisionObservable();
        this.collisionObservable.add((collisionEvent: IPhysicsCollisionEvent) => {
            console.log("Collision");
            if (collisionEvent.impulse < 0.8) return;
            console.log(collisionEvent);
            //Assets.OuchSound.play();
        });

        for (const child of this.instanceRoot.getChildMeshes()) {
            if (child.name.includes("mainThruster")) {
                console.log("Found main thruster");
                this.addMainThruster(child);
            } else if (child.name.includes("rcsThruster")) {
                console.log("Found rcs thruster");
                this.addRCSThruster(child);
            }
        }

        this.warpTunnel = new WarpTunnel(this.getTransform(), scene);
        this.hyperSpaceTunnel = new HyperSpaceTunnel(this.getTransform().getDirection(Axis.Z), scene);
        this.hyperSpaceTunnel.setParent(this.getTransform());
        this.hyperSpaceTunnel.setEnabled(false);

        this.enableWarpDriveSound = new AudioInstance(Assets.ENABLE_WARP_DRIVE_SOUND, Vector3.Zero(), this.getTransform());
        this.disableWarpDriveSound = new AudioInstance(Assets.DISABLE_WARP_DRIVE_SOUND, Vector3.Zero(), this.getTransform());
        this.acceleratingWarpDriveSound = new AudioInstance(Assets.ACCELERATING_WARP_DRIVE_SOUND, Vector3.Zero(), this.getTransform());
        this.deceleratingWarpDriveSound = new AudioInstance(Assets.DECELERATING_WARP_DRIVE_SOUND, Vector3.Zero(), this.getTransform());

        this.acceleratingWarpDriveSound.setTargetVolume(0);
        this.deceleratingWarpDriveSound.setTargetVolume(0);

        this.scene = scene;
    }

    public setClosestWalkableObject(object: Transformable) {
        this.closestWalkableObject = object;
    }

    public getTransform(): TransformNode {
        return this.aggregate.transformNode;
    }

    private addMainThruster(mesh: AbstractMesh) {
        const direction = mesh.getDirection(new Vector3(0, 1, 0));
        this.mainThrusters.push(new MainThruster(mesh, direction, this.aggregate));
    }

    private addRCSThruster(mesh: AbstractMesh) {
        const direction = mesh.getDirection(new Vector3(0, 1, 0));
        const thruster = new RCSThruster(mesh, direction, this.aggregate);
        this.rcsThrusters.push(thruster);

        //FIXME: this is temporary to balance rc thrust
        thruster.setMaxAuthority(thruster.getMaxAuthority() / thruster.leverage);
    }

    public setEnabled(enabled: boolean, havokPlugin: HavokPlugin) {
        this.instanceRoot.setEnabled(enabled);
        setEnabledBody(this.aggregate.body, enabled, havokPlugin);
    }

    public registerClosestObject(distance: number, radius: number) {
        this.closestObject = { distance, radius };
    }

    public enableWarpDrive() {
        for (const thruster of this.mainThrusters) thruster.setThrottle(0);
        for (const thruster of this.rcsThrusters) thruster.deactivate();
        this.warpDrive.enable();
        this.aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);

        this.aggregate.body.setLinearVelocity(Vector3.Zero());
        this.aggregate.body.setAngularVelocity(Vector3.Zero());

        if(!this.acceleratingWarpDriveSound.sound.isPlaying) this.acceleratingWarpDriveSound.sound.play();
        if(!this.deceleratingWarpDriveSound.sound.isPlaying) this.deceleratingWarpDriveSound.sound.play();

        this.enableWarpDriveSound.sound.play();
        this.onWarpDriveEnabled.notifyObservers();
    }

    public disableWarpDrive() {
        this.warpDrive.desengage();
        this.aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);

        this.disableWarpDriveSound.sound.play();
        this.onWarpDriveDisabled.notifyObservers();
    }

    public toggleWarpDrive() {
        if (!this.warpDrive.isEnabled()) this.enableWarpDrive();
        else this.disableWarpDrive();
    }

    /**
     * Returns a readonly interface to the warp drive of the ship.
     * @returns A readonly interface to the warp drive of the ship.
     */
    public getWarpDrive(): WarpDrive {
        return this.warpDrive;
    }

    public setFlightAssistEnabled(enabled: boolean) {
        this.flightAssistEnabled = enabled;
    }

    public getFlightAssistEnabled(): boolean {
        return this.flightAssistEnabled;
    }

    /**
     * Returns the speed of the ship in m/s
     * If warp drive is enabled, returns the warp speed
     * If warp drive is disabled, returns the linear velocity of the ship
     * @returns The speed of the ship in m/s
     */
    public getSpeed(): number {
        return this.warpDrive.isEnabled() ? this.warpDrive.getWarpSpeed() : this.aggregate.body.getLinearVelocity().length();
    }

    public getThrottle(): number {
        return this.warpDrive.isEnabled() ? this.warpDrive.getTargetThrottle() : this.mainThrusters[0].getThrottle();
    }

    public getClosestWalkableObject(): Transformable | null {
        return this.closestWalkableObject;
    }

    public engageLanding(landingTarget: Transformable | null) {
        console.log("Landing sequence engaged");
        this.aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
        this.state = ShipState.LANDING;
        this.landingTarget = landingTarget !== null ? landingTarget : this.closestWalkableObject;
        if (this.landingTarget === null) {
            throw new Error("Landing target is null");
        }
        console.log("landing on", this.landingTarget.getTransform().name);
    }

    public engageLandingOnPad(landingPad: LandingPad) {
        console.log("Landing on pad", landingPad.getTransform().name);
        this.aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
        this.state = ShipState.LANDING;
        this.targetLandingPad = landingPad;
    }

    private completeLanding() {
        console.log("Landing sequence complete");
        this.state = ShipState.LANDED;
        this.aggregate.body.setMotionType(PhysicsMotionType.STATIC);
        this.landingTarget = null;
    }

    private land(deltaTime: number) {
        if (this.targetLandingPad !== null) {
            this.landOnPad(this.targetLandingPad, deltaTime);
        }

        if (this.landingTarget !== null) {
            const gravityDir = this.landingTarget.getTransform().getAbsolutePosition().subtract(this.getTransform().getAbsolutePosition()).normalize();
            const start = this.getTransform().getAbsolutePosition().add(gravityDir.scale(-50e3));
            const end = this.getTransform().getAbsolutePosition().add(gravityDir.scale(50e3));

            (this.scene.getPhysicsEngine() as PhysicsEngineV2).raycastToRef(start, end, this.raycastResult, { collideWith: CollisionMask.ENVIRONMENT });
            if (this.raycastResult.hasHit) {
                const landingSpotNormal = this.raycastResult.hitNormalWorld;

                const landingSpot = this.raycastResult.hitPointWorld.add(this.raycastResult.hitNormalWorld.scale(1.0));

                const distance = landingSpot.subtract(this.getTransform().getAbsolutePosition()).dot(gravityDir);
                translate(this.getTransform(), gravityDir.scale(Math.min(10 * deltaTime * Math.sign(distance), distance)));

                const currentUp = getUpwardDirection(this.getTransform());
                const targetUp = landingSpotNormal;
                let theta = 0.0;
                if (Vector3.Distance(currentUp, targetUp) > 0.01) {
                    const axis = Vector3.Cross(currentUp, targetUp);
                    theta = Math.acos(Vector3.Dot(currentUp, targetUp));
                    rotate(this.getTransform(), axis, Math.min(0.4 * deltaTime, theta));
                }

                if (Math.abs(distance) < 0.3 && Math.abs(theta) < 0.01) {
                    this.completeLanding();
                }
            }
        }
    }

    private landOnPad(landingPad: LandingPad, deltaTime: number) {
        const padUp = landingPad.getTransform().up;

        const targetPosition = landingPad.getTransform().getAbsolutePosition();
        targetPosition.addInPlace(padUp.scale(2));
        const currentPosition = this.getTransform().getAbsolutePosition();

        const distance = Vector3.Distance(targetPosition, currentPosition);

        if (distance < 0.01) {
            this.completeLanding();
            return;
        }

        const targetOrientation = landingPad.getTransform().absoluteRotationQuaternion;
        const currentOrientation = getRotationQuaternion(this.getTransform());

        translate(
            this.getTransform(),
            targetPosition
                .subtract(currentPosition)
                .normalize()
                .scaleInPlace(Math.min(distance, 20 * deltaTime))
        );

        this.getTransform().rotationQuaternion = Quaternion.Slerp(currentOrientation, targetOrientation, deltaTime);
    }

    public update(deltaTime: number) {
        const warpSpeed = getForwardDirection(this.aggregate.transformNode).scale(this.warpDrive.getWarpSpeed());

        const currentForwardSpeed = Vector3.Dot(warpSpeed, this.aggregate.transformNode.getDirection(Axis.Z));
        this.warpDrive.update(currentForwardSpeed, this.closestObject.distance, this.closestObject.radius, deltaTime);

        // the warp throttle goes from 0.1 to 1 smoothly using an inverse function
        if (this.warpDrive.isEnabled()) this.warpTunnel.setThrottle(1 - 1 / (1.1 * (1 + 1e-7 * this.warpDrive.getWarpSpeed())));
        else this.warpTunnel.setThrottle(0);

        for (const thruster of this.mainThrusters) thruster.update();
        for (const thruster of this.rcsThrusters) thruster.update();

        if (this.warpDrive.isDisabled()) {
            for (const thruster of this.mainThrusters) thruster.applyForce();
            for (const thruster of this.rcsThrusters) thruster.applyForce();

            if (this.closestWalkableObject !== null) {
                const gravityDir = this.closestWalkableObject.getTransform().getAbsolutePosition().subtract(this.getTransform().getAbsolutePosition()).normalize();
                this.aggregate.body.applyForce(gravityDir.scale(9.8), this.aggregate.body.getObjectCenterWorld());
            }

            this.acceleratingWarpDriveSound.setTargetVolume(0);
            this.deceleratingWarpDriveSound.setTargetVolume(0);
        } else {
            translate(this.getTransform(), warpSpeed.scale(deltaTime));

            if (currentForwardSpeed < this.warpDrive.getWarpSpeed()) {
                this.acceleratingWarpDriveSound.setTargetVolume(1);
                this.deceleratingWarpDriveSound.setTargetVolume(0);
                console.log(this.acceleratingWarpDriveSound.sound.getVolume());
            } else {
                this.deceleratingWarpDriveSound.setTargetVolume(1);
                this.acceleratingWarpDriveSound.setTargetVolume(0);
            }
        }

        this.enableWarpDriveSound.update(deltaTime);
        this.disableWarpDriveSound.update(deltaTime);
        this.acceleratingWarpDriveSound.update(deltaTime);
        this.deceleratingWarpDriveSound.update(deltaTime);

        if (this.flightAssistEnabled) {
            this.aggregate.body.setAngularDamping(0.9);
        } else {
            //FIXME: for some reason, the angular damping is not working
            this.aggregate.body.setAngularDamping(1);
        }

        if (this.state === ShipState.LANDING) {
            this.land(deltaTime);
        }
    }

    public dispose() {
        this.aggregate.dispose();
        this.instanceRoot.dispose();
    }
}