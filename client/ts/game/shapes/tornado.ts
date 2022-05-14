import { AudioSource, AudioManager } from "../../audio";
import { ForceShape } from "./force_shape";
import { Vector3 } from "../../math/vector3";

/** Sucks the marble in and then slings it upwards. */
export class Tornado extends ForceShape {
	dtsPath = "shapes/hazards/tornado.dts";
	collideable = false;
	sounds = ["tornado.wav"];
	soundSource: AudioSource;

	constructor() {
		super();

		this.addSphericalForce(8, -60);
		this.addSphericalForce(3, 60);
		this.addFieldForce(3, new Vector3(0, 0, 150)); // The upwards force is always in the same direction regardless of tornado orientation
	}

	async onLevelStart() {
		this.soundSource = AudioManager.createAudioSource(this.sounds[0], AudioManager.soundGain, this.worldPosition);
		this.soundSource.setLoop(true);
		this.soundSource.play();
		await this.soundSource.promise;
	}
}