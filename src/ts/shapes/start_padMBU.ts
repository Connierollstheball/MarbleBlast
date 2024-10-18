import { Shape } from "../shape";
import { Util } from "../util";
import { TimeState } from "../level";

/** The starting location of the level. */
export class StartPadMBU extends Shape {
	dtsPath = "shapes_mbu/pads/startarea.dts";
	animationStartTime = -Infinity;

	get animationDuration() {
		return this.dts.sequences[0].duration * 1000;
	}

	doStartAnim() {
		let time = this.level.timeState;
		this.animationStartTime = time.timeSinceLoad;
	}

	render(time: TimeState) {
		let currentCompletion = Util.clamp((time.timeSinceLoad - this.animationStartTime) / this.animationDuration, 0, 1);
		this.sequenceKeyframeOverride.set(this.dts.sequences[0], currentCompletion * (this.dts.sequences[0].numKeyframes - 1));

		super.render(time);
	}

	reset() {
		super.reset();
		this.doStartAnim();
	}

	async onLevelStart()
	{
		this.doStartAnim();
		console.log("peepee");
	}
}