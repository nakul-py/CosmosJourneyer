import { Crater } from "../terrain/crater/crater";
import { TerrainSettings } from "../terrain/terrainSettings";

export interface CollisionData {
    taskType: string;
    planetID: string;
    chunkLength: number;
    position: number[];
    craters: Crater[];
    terrainSettings: TerrainSettings;
}