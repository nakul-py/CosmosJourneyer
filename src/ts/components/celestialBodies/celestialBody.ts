import { Vector3, Quaternion } from "@babylonjs/core";
import {Algebra} from "../toolbox/algebra";
import {CelestialBodyType, Transformable} from "./interfaces";

export abstract class CelestialBody implements Transformable {
    protected abstract bodyType: CelestialBodyType;
    protected constructor() {
        //TODO: réunir les attributs fondamentaux de tous les celestialBodies
    }
    public abstract getName(): string;
    public abstract setAbsolutePosition(newPosition: Vector3): void;
    public abstract getAbsolutePosition(): Vector3;
    public abstract getRotationQuaternion(): Quaternion;
    public getBodyType(): CelestialBodyType {
        return this.bodyType;
    }
    public abstract getRadius(): number;
    public abstract update(observerPosition: Vector3, observerDirection: Vector3, lightPosition: Vector3): void;

    public getOriginBodySpaceSamplePosition(): Vector3 {
        let position = this.getAbsolutePosition().clone(); // position de la planète / au joueur
        position.scaleInPlace(-1); // position du joueur / au centre de la planète

        // on applique le quaternion inverse pour obtenir le sample point correspondant à la planète rotatée (fais un dessin si c'est pas clair)
        Algebra.applyQuaternionInPlace(Quaternion.Inverse(this.getRotationQuaternion()), position);

        return position;
    }
}