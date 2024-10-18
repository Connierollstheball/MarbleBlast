import { Helicopter } from "./helicopter";

/** Reduces gravity temporarily. */
export class HelicopterMBU extends Helicopter {
	dtsPath = "shapes_mbu/images/helicopter.dts";
	showSequences = false;
	shareNodeTransforms = false;
	pickUpName = "Gyrocopter PowerUp";
	sounds = ["pugyrocoptervoice.wav", "use_gyrocopter.wav"];

	use() {
		this.level.marble.enableHelicopter(this.level.timeState, true);
		this.level.deselectPowerUp();
	}
}