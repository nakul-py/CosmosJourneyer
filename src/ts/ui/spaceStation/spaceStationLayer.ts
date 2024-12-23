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

import { Observable } from "@babylonjs/core/Misc/observable";
import { generateInfoHTML } from "./spaceStationInfos";
import { Player } from "../../player/player";
import { generateMissionsDom } from "./spaceStationMissions";
import { Settings } from "../../settings";
import { OrbitalObjectModel } from "../../architecture/orbitalObject";
import { OrbitalFacilityModel } from "../../spacestation/orbitalFacility";
import { generateSpaceshipDom } from "./spaceshipDock";
import { promptModalString } from "../../utils/dialogModal";
import i18n from "../../i18n";
import { Sounds } from "../../assets/sounds";

const enum MainPanelState {
    NONE,
    INFO,
    MISSIONS,
    SPACE_SHIP
}

export class SpaceStationLayer {
    private parentNode: HTMLElement;
    private spaceStationHeader: HTMLElement;

    private currentStation: OrbitalFacilityModel | null = null;
    private currentStationParents: OrbitalObjectModel[] = [];

    private readonly spaceStationName: HTMLElement;

    private readonly playerName: HTMLElement;
    private readonly editPlayerNameButton: HTMLElement;

    private readonly playerBalance: HTMLElement;

    private readonly mainPanel: HTMLElement;

    private readonly missionsButton: HTMLElement;

    private readonly spaceshipButton: HTMLElement;

    private readonly infoButton: HTMLElement;

    private readonly takeOffButton: HTMLElement;

    private mainPanelState: MainPanelState = MainPanelState.NONE;

    readonly onTakeOffObservable = new Observable<void>();

    readonly player: Player;

    constructor(player: Player) {
        this.player = player;

        this.parentNode = document.getElementById("spaceStationUI") as HTMLElement;
        this.spaceStationHeader = document.getElementById("spaceStationHeader") as HTMLElement;

        this.spaceStationName = document.querySelector<HTMLElement>("#spaceStationUI .spaceStationName") as HTMLElement;

        this.playerName = document.querySelector<HTMLElement>("#spaceStationUI .playerName h2") as HTMLElement;

        this.editPlayerNameButton = document.querySelector<HTMLElement>("#spaceStationUI .playerName button") as HTMLElement;
        this.editPlayerNameButton.addEventListener("click", async () => {
            Sounds.MENU_SELECT_SOUND.play();
            const newName = await promptModalString(i18n.t("spaceStation:cmdrNameChangePrompt"), player.getName());
            if (newName === null) return;
            player.setName(newName);
            this.updatePlayerName();
        });

        this.playerBalance = document.querySelector<HTMLElement>("#spaceStationUI .playerBalance") as HTMLElement;

        this.mainPanel = document.querySelector<HTMLElement>("#spaceStationUI .mainContainer") as HTMLElement;

        const missionsButton = document.querySelector<HTMLElement>(".spaceStationAction.missionsButton");
        if (missionsButton === null) {
            throw new Error("Missions button not found");
        }
        this.missionsButton = missionsButton;
        this.missionsButton.addEventListener("click", () => {
            this.setMainPanelState(MainPanelState.MISSIONS);
        });

        const spaceshipButton = document.querySelector<HTMLElement>(".spaceStationAction.spaceshipButton");
        if (spaceshipButton === null) {
            throw new Error("Spaceship button not found");
        }
        this.spaceshipButton = spaceshipButton;
        this.spaceshipButton.addEventListener("click", () => {
            this.setMainPanelState(MainPanelState.SPACE_SHIP);
        });

        const infoButton = document.querySelector<HTMLElement>(".spaceStationAction.infoButton");
        if (infoButton === null) {
            throw new Error("Info button not found");
        }
        this.infoButton = infoButton;
        this.infoButton.addEventListener("click", () => {
            this.setMainPanelState(MainPanelState.INFO);
        });

        const takeOffButton = document.querySelector<HTMLElement>(".spaceStationAction.takeOffButton");
        if (takeOffButton === null) {
            throw new Error("Take off button not found");
        }
        this.takeOffButton = takeOffButton;
        this.takeOffButton.addEventListener("click", () => {
            this.onTakeOffObservable.notifyObservers();
        });
    }

    private setMainPanelState(state: MainPanelState) {
        if (this.mainPanelState === state) {
            this.mainPanelState = MainPanelState.NONE;
        } else {
            this.mainPanelState = state;
        }

        if (this.currentStation === null) {
            throw new Error("No current station");
        }

        switch (this.mainPanelState) {
            case MainPanelState.INFO:
                this.mainPanel.classList.remove("hidden");
                this.mainPanel.innerHTML = generateInfoHTML(this.currentStation, this.currentStationParents);
                break;
            case MainPanelState.MISSIONS:
                this.mainPanel.classList.remove("hidden");
                this.mainPanel.innerHTML = "";
                this.mainPanel.appendChild(generateMissionsDom(this.currentStation, this.player));
                break;
            case MainPanelState.SPACE_SHIP:
                this.mainPanel.classList.remove("hidden");
                this.mainPanel.innerHTML = "";
                this.mainPanel.appendChild(generateSpaceshipDom(this.currentStation, this.player));
                break;
            case MainPanelState.NONE:
                this.mainPanel.classList.add("hidden");
                this.mainPanel.innerHTML = "";
                break;
        }
    }

    public setVisibility(visible: boolean) {
        if (this.isVisible() === visible) return;
        this.parentNode.style.visibility = visible ? "visible" : "hidden";
    }

    public isVisible(): boolean {
        return this.parentNode.style.visibility !== "hidden";
    }

    public setStation(station: OrbitalFacilityModel, stationParents: OrbitalObjectModel[], player: Player) {
        if (this.currentStation === station) return;
        this.currentStation = station;
        this.currentStationParents = stationParents;
        this.spaceStationName.textContent = station.name;

        this.updatePlayerName();
        this.updatePlayerBalance();
    }

    private updatePlayerName() {
        this.playerName.textContent = `CMDR ${this.player.getName()}`;
    }

    private updatePlayerBalance() {
        this.playerBalance.textContent = `Balance: ${Settings.CREDIT_SYMBOL}${this.player.balance.toLocaleString()}`;
    }

    public reset() {
        this.currentStation = null;
        this.spaceStationName.textContent = "";
        this.playerName.textContent = "";
        this.playerBalance.textContent = "";
        this.mainPanel.classList.add("hidden");
        this.mainPanel.innerHTML = "";
    }
}
