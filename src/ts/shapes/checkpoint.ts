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

export class CheckpointMBU extends Checkpoint {
	dtsPath = "shapes_mbu/pads/checkpad.dts";
	collideable = false;
	fakeCheckPad: Shape;
	isActive = false;

	onCheckpointActivate() {
		this.isActive = true;
	}

	restartCheckpointShape()
	{
		this.isActive = false;
		this.fakeCheckPad.setOpacity(0);
		this.setOpacity(1);
	}

	tick(time: TimeState, onlyVisual: boolean) {
		if (this.isActive && this.fakeCheckPad.currentOpacity < 1)
		{
			this.fakeCheckPad.setOpacity(this.fakeCheckPad.currentOpacity + 0.01);
			this.setOpacity(this.currentOpacity - 0.01);
		}

		if (!this.isActive && this.fakeCheckPad.currentOpacity > 0)
		{
			this.fakeCheckPad.setOpacity(this.fakeCheckPad.currentOpacity - 0.01);
			this.setOpacity(this.currentOpacity + 0.01);			
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