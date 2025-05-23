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

import { TutorialControlsInputs } from "../ui/tutorial/tutorialLayerInputs";
import {
    axisCompositeToString,
    dPadCompositeToString,
    pressInteractionToStrings
} from "../utils/strings/inputControlsString";
import { Tutorial } from "./tutorial";
import coverImgSrc from "../../asset/tutorials/starMapTutorial/cover.webp";
import openImgSrc from "../../asset/tutorials/starMapTutorial/open.webp";
import controlsImgSrc from "../../asset/tutorials/starMapTutorial/controls.webp";
import missionImgSrc from "../../asset/tutorials/starMapTutorial/mission.webp";
import plotItineraryImgSrc from "../../asset/tutorials/starMapTutorial/plotItinerary.webp";
import jumpImgSrc from "../../asset/tutorials/starMapTutorial/jump.webp";
import saveData from "../../asset/tutorials/starMapTutorial/save.json";
import i18n from "../i18n";
import { getGlobalKeyboardLayoutMap } from "../utils/keyboardAPI";
import { safeParseSave, Save } from "../saveFile/saveFileData";
import { StarSystemDatabase } from "../starSystem/starSystemDatabase";
import { Result } from "../utils/types";
import { SaveLoadingError } from "../saveFile/saveLoadingError";
import { StarMapInputs } from "../starmap/starMapInputs";
import DPadComposite from "@brianchirls/game-input/controls/DPadComposite";
import { GeneralInputs } from "../inputs/generalInputs";
import AxisComposite from "@brianchirls/game-input/controls/AxisComposite";
import { StarSystemInputs } from "../inputs/starSystemInputs";

export class StarMapTutorial implements Tutorial {
    readonly coverImageSrc: string = coverImgSrc;

    getSaveData(starSystemDatabase: StarSystemDatabase): Result<Save, SaveLoadingError> {
        return safeParseSave(saveData, starSystemDatabase);
    }

    getTitle() {
        return i18n.t("tutorials:starMap:title");
    }

    getDescription() {
        return i18n.t("tutorials:starMap:description");
    }

    async getContentPanelsHtml(): Promise<string[]> {
        const keyboardLayoutMap = await getGlobalKeyboardLayoutMap();
        const welcomePanelHtml = `
        <div class="tutorialContent">
            <img src="${coverImgSrc}" alt="Welcome to Cosmos Journeyer">
            <p>${i18n.t("tutorials:starMap:welcome")}</p>
            
            ${i18n.t("tutorials:common:navigationInfo", {
                // This displays a small internationalized text to explain the keys to navigate the tutorial
                nextKeys: pressInteractionToStrings(TutorialControlsInputs.map.nextPanel, keyboardLayoutMap).join(
                    ` ${i18n.t("common:or")} `
                ),
                previousKeys: pressInteractionToStrings(TutorialControlsInputs.map.prevPanel, keyboardLayoutMap).join(
                    ` ${i18n.t("common:or")} `
                )
            })}
        </div>`;

        const toggleStarMapKeys = pressInteractionToStrings(GeneralInputs.map.toggleStarMap, keyboardLayoutMap).join(
            ` ${i18n.t("common:or")} `
        );

        const howToOpenPanelHtml = `
        <div class="tutorialContent">
            <p>${i18n.t("tutorials:starMap:open1")}</p> 
            <p>${i18n.t("tutorials:starMap:open2", { keys: toggleStarMapKeys })}</p> 
            <img src="${openImgSrc}" alt="Star map opening" class="tutorialImage">
            <p>${i18n.t("tutorials:starMap:open3")}</p>
        </div>`;

        const horizontalKeys = dPadCompositeToString(
            StarMapInputs.map.move.bindings[0].control as DPadComposite,
            keyboardLayoutMap
        );
        const verticalKeys = axisCompositeToString(
            StarMapInputs.map.upDown.bindings[0].control as AxisComposite,
            keyboardLayoutMap
        );
        const rawKeys = horizontalKeys.concat(verticalKeys);

        const keys = rawKeys.map((key) => key[1].replace("Key", "")).join(", ");

        const howToUseStarMapPanelHtml = `
        <div class="tutorialContent">
            <p>${i18n.t("tutorials:starMap:controls1", { keys })}</p>
            <img src="${controlsImgSrc}" alt="Star map controls" class="tutorialImage">
            <p>${i18n.t("tutorials:starMap:controls2")}</p>
        </div>`;

        const howToMissionsPanelHtml = `
        <div class="tutorialContent">
            <p>${i18n.t("tutorials:starMap:missions1")}</p>
            <img src="${missionImgSrc}" alt="Star map missions" class="tutorialImage">
            <p>${i18n.t("tutorials:starMap:missions2")}</p>
        </div>`;

        const howToInteractWithSystemPanelHtml = `
        <div class="tutorialContent">
            <p>${i18n.t("tutorials:starMap:system1")}</p>
            <p>${i18n.t("tutorials:starMap:system2")}</p>
            <img src="${plotItineraryImgSrc}" alt="Star map system interactions" class="tutorialImage">
            <p>${i18n.t("tutorials:starMap:system3")}</p>
        </div>`;

        const jumpKeys = pressInteractionToStrings(StarSystemInputs.map.jumpToSystem, keyboardLayoutMap).join(
            ` ${i18n.t("common:or")} `
        );

        const howToInterstellarTravelPanelHtml = `
        <div class="tutorialContent">
            <p>${i18n.t("tutorials:starMap:travel1")}</p>
            <p>${i18n.t("tutorials:starMap:travel2", { keys: jumpKeys })}</p>
            <img src="${jumpImgSrc}" alt="Interstellar jump" class="tutorialImage">
            <p>${i18n.t("tutorials:starMap:travel3")}</p>
        </div>`;

        const endPanelHtml = `
        <div class="tutorialContent">
            <img src="${coverImgSrc}" alt="Welcome to Cosmos Journeyer">
            <p>${i18n.t("tutorials:starMap:congratulations")}</p>
            ${i18n.t("tutorials:common:tutorialEnding", {
                // This displays a small internationalized text to explain the keys to end the tutorial
                keyQuit: pressInteractionToStrings(TutorialControlsInputs.map.nextPanel, keyboardLayoutMap).join(
                    ` ${i18n.t("common:or")} `
                )
            })}
        </div>`;

        return [
            welcomePanelHtml,
            howToOpenPanelHtml,
            howToUseStarMapPanelHtml,
            howToMissionsPanelHtml,
            howToInteractWithSystemPanelHtml,
            howToInterstellarTravelPanelHtml,
            endPanelHtml
        ];
    }
}
