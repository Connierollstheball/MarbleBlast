import { Shape } from "../shape";
import { Util } from "../util";
import { TimeState } from "../level";

/** The starting location of the level. */
export class StartPad extends Shape {
	dtsPath = "shapes/pads/startarea.dts";
}

export class StartPadMBU extends Shape {
	dtsPath = "shapes_mbu/pads/startarea.dts";
	animationStartTime = -Infinity;
	startbeam: Shape;

	get animationDuration() {
		return this.dts.sequences[0].duration * 1000;
	}

	doStartAnim() {
		this.startbeam.setOpacity(1);
		let time = this.level.timeState;
		this.animationStartTime = time.timeSinceLoad;
	}

	render(time: TimeState) {
		let currentCompletion = Util.clamp((time.timeSinceLoad - this.animationStartTime) / this.animationDuration, 0, 1);
		this.sequenceKeyframeOverride.set(this.dts.sequences[0], currentCompletion * (this.dts.sequences[0].numKeyframes - 1));
		
		if (currentCompletion > 0.8)
		{
			this.startbeam.setOpacity(1 - ((currentCompletion - 0.8) / 0.2));
		}

		super.render(time);
	}

	reset() {
		super.reset();
		this.doStartAnim();
	}

	async onLevelStart()
	{
		this.doStartAnim();
	}
}