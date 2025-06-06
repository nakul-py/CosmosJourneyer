import { Mission } from "../../missions/mission";
import { Player } from "../../player/player";
import i18n from "../../i18n";
import { ISoundPlayer, SoundType } from "../../audio/soundPlayer";

export class AcceptMissionButton {
    readonly rootNode: HTMLElement;

    constructor(mission: Mission, player: Player, soundPlayer: ISoundPlayer) {
        this.rootNode = document.createElement("button");
        this.rootNode.className = "missionButton";
        this.rootNode.innerText = i18n.t("missions:common:accept");

        if (player.currentMissions.find((m) => m.equals(mission))) {
            this.rootNode.classList.add("accepted");
            this.rootNode.innerText = i18n.t("missions:common:accepted");
        }

        this.rootNode.addEventListener("click", () => {
            soundPlayer.playNow(SoundType.CLICK);
            if (player.currentMissions.find((m) => m.equals(mission))) {
                this.rootNode.classList.remove("accepted");
                this.rootNode.innerText = i18n.t("missions:common:accept");
                player.currentMissions = player.currentMissions.filter((m) => !m.equals(mission));
                return;
            }

            this.rootNode.classList.add("accepted");
            this.rootNode.innerText = i18n.t("missions:common:accepted");
            player.currentMissions.push(mission);
        });
    }
}
