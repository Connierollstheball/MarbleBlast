import { Shape } from "../shape";
import { Util } from "../util";
import { TimeState } from "../level";
import { Matrix4 } from "../math/matrix4";
import { Vector3 } from "../math/vector3";
import { Quaternion } from "../math/quaternion";
import { Euler } from "../math/euler";

/** The ultra finish pad. */
export class EndPadMBU extends Shape {
	dtsPath = "shapes_mbu/pads/endarea.dts";
	sounds = ['firewrks.wav'];
	buddyshapes: Shape[] = [];
	inArea = 0; // Used to only trigger the event once

	/** @param isMain Whether or not this pad is the main pad, meaning it has to be touched for the level to end. All other pads are purely cosmetic. */
	constructor(isMain: boolean) {
		super();

		if (!isMain) return;

		// Create the finish area collision geometry
		let height = 4.8;
		let radius = 1;
		let transform = new Matrix4();
		transform.compose(new Vector3(0, 0, height/2 + 0.2), new Quaternion().setFromEuler(new Euler(-Math.PI/2, 0, 0)), new Vector3(1, 1, 1));

		this.addCollider((scale: Vector3) => {
			// Create the finish area collision geometry
			// Scaling note: The actual height of the cylinder (here: the y scaling) doesn't change, it's always the same.
			let finishArea = Util.createCylinderConvexHull(radius, height/2, 64, new Vector3(scale.x, 1, scale.y));
			finishArea.margin = 0.005; // OIMO had a margin of 0.005 on every shape. We somewhat try to correct for that by adding it back here.

			return finishArea;
		}, (t: number) => {
			// These checks are to make sure touchFinish is only called once per contact with the collider. For it to be called again, the marble must leave the area again.
			let exit = this.inArea > 0;
			this.inArea = 2;
			if (exit) return;

			this.level.touchFinish(t);
		}, transform);
	}

	tick(time: TimeState, onlyVisual: boolean) {
		if (onlyVisual) return;
		super.tick(time);

		this.inArea--;
	}

	// No fireworks, so just play the sound.
	spawnFirework() {
		this.level.audio.play(this.sounds[0], 1, undefined, this.worldPosition);
	}
}

export class MBUBeam extends Shape {
	collideable = false;
	dtsPath = "shapes_mbu/pads/lightbeam.dts";

	constructor() {
		super();
	}
}