import {BuildTask, DeleteTask, Task} from "./taskInterfaces";

/*export class BuildTaskQueue {
    array: ArrayBuffer
    constructor(array: ArrayBuffer) {
        this.array = array;
    }
}*/

export class WorkerPool {
    availableWorkers: Worker[] = []; // liste des workers disponibles pour exécuter des tâches
    finishedWorkers: Worker[] = []; // liste des workers ayant terminé leur tâche (prêts à être réintégré dans la liste des workers disponibles)
    taskQueue: (BuildTask | DeleteTask)[] = [];

    //TODO: continuer à expérimenter avec le SharedArrayBuffer
    //sharedMemoryBuffer: SharedArrayBuffer;
    //sharedTaskQueue: BuildTaskQueue;

    constructor(nbWorkers: number) {
        //this.sharedMemoryBuffer = new SharedArrayBuffer(0);
        //this.sharedTaskQueue = new BuildTaskQueue(this.sharedMemoryBuffer);
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!");
        for (let i = 0; i < nbWorkers; i++) {
            let worker = new Worker(new URL('../workers/workerScript', import.meta.url), { type: "module" });
            this.availableWorkers.push(worker);
            //worker.postMessage(this.sharedMemoryBuffer);
        }
    }

    public submitTask(task: Task) {
        this.taskQueue.push(task);
    }
}