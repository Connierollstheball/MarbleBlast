import { Shape } from "../shape";
import { Trigger } from "./trigger";
import { CheckpointMBU } from "../shapes/checkpoint";

/** A checkpoint trigger sets the current checkpoint to an arbitrary shape in the level. */
export class CheckpointTrigger extends Trigger {
	sounds = ['checkpoint.wav'];

	onMarbleEnter() {
		// Shape can be anything, doesn't necessarily have to be a checkpoint
		let respawnShape = this.level.shapes.find(x => x.srcElement?._name.toLowerCase() === this.element.respawnpoint?.toLowerCase()) as Shape;
		if (!respawnShape) return;

		if (respawnShape.dtsPath === "shapes_mbu/pads/checkpad.dts") {
			let MBUThing = respawnShape as CheckpointMBU;
			MBUThing.isActive = true;

			if (this.level.currentCheckpoint && this.level.currentCheckpoint != respawnShape && this.level.currentCheckpoint.dtsPath === "shapes_mbu/pads/checkpad.dts") {
				let OldMBUCheckpoint = this.level.currentCheckpoint as CheckpointMBU;
				OldMBUCheckpoint.isActive = false;
			}
		}

		this.level.saveCheckpointState(respawnShape, this);
		this.level.replay.recordMarbleEnter(this);
	}
}