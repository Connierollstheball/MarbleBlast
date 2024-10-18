import { Shape } from "../shape";
import { MissionElementStaticShape } from "../parsing/mis_parser";

/** A plain sign showing a direction. */
export class SignPlain extends Shape {
	dtsPath = "shapes/signs/plainsign.dts";
	shareMaterials = false;

	constructor(element: MissionElementStaticShape) {
		super();

		// Determine the direction to show
		let direction = element.datablock.slice("SignPlain".length).toLowerCase();
		switch (direction) {
			case "right": this.matNamesOverride["base.plainsign"] = "right.plainsign"; break;
			case "left": this.matNamesOverride["base.plainsign"] = "left.plainsign"; break;
			case "up": this.matNamesOverride["base.plainsign"] = "up.plainsign"; break;
			case "down": this.matNamesOverride["base.plainsign"] = "down.plainsign"; break;
		}
	}
}

export class MBUSign extends Shape {
	constructor(dataBlock: string) {
		super();

		console.log(dataBlock);

		switch (dataBlock)
		{
			case "arrowup":
				this.dtsPath = "shapes_mbu/signs/arrowsign_up.dts";
				break;
			case "arrowdown":
				this.dtsPath = "shapes_mbu/signs/arrowsign_down.dts";
				break;
			case "arrowside":
				this.dtsPath = "shapes_mbu/signs/arrowsign_side.dts";
				break;
		}
	}
}