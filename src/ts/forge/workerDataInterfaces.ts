import {Direction} from "../utils/direction";
import {TerrainSettings} from "../terrain/terrainSettings";
import {TaskType} from "./taskInterfaces";

export interface WorkerData {
    taskType: TaskType;
    planetName: string;
    planetDiameter: number;
    terrainSettings: TerrainSettings;
    position: number[];
}

export interface BuildData extends WorkerData {
    nbVerticesPerSide: number;
    depth: number;
    direction: Direction;
    seed: number[];
}

export interface CollisionData extends WorkerData {

}