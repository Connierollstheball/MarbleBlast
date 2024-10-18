import { Checkpoint } from "./checkpoint";

export class CheckpointMBU extends Checkpoint {
	dtsPath = "shapes_mbu/pads/checkpad.dts";
	collideable = false;

	onMarbleContact() {
		this.level.saveCheckpointState(this);
		this.level.replay.recordMarbleContact(this);
	}
}