import { Shape } from "../shape";
import { TimeState } from "../level";

/** On contact, sets a new checkpoint with itself as the respawn shape. */
export class Checkpoint extends Shape {
	dtsPath = "shapes/buttons/checkpoint.dts";
	sounds = ['checkpoint.wav'];

	onMarbleContact() {
		this.level.saveCheckpointState(this);
		this.level.replay.recordMarbleContact(this);
	}
}

export class CheckpointMBXP extends Checkpoint {
	dtsPath = "shapes/pads/checkpoint.dts";
	collideable = false;
	fakeCheckPad: Shape;
	isActive = false;

	restartCheckpointShape()
	{
		this.isActive = false;
		this.fakeCheckPad.setOpacity(0);
		this.setOpacity(1);
	}

	tick(time: TimeState, onlyVisual: boolean) {
		if (this.isActive && this.fakeCheckPad.currentOpacity < 1)
		{
			this.fakeCheckPad.setOpacity(this.fakeCheckPad.currentOpacity + 0.05);
			this.setOpacity(this.currentOpacity - 0.05);
		}

		if (!this.isActive && this.fakeCheckPad.currentOpacity > 0)
		{
			this.fakeCheckPad.setOpacity(this.fakeCheckPad.currentOpacity - 0.05);
			this.setOpacity(this.currentOpacity + 0.05);			
		}
		
		super.tick(time, onlyVisual);
	}

	async onLevelStart()
	{
		this.restartCheckpointShape();
	}

	reset() {
		this.restartCheckpointShape();
	}
}