import { Gem } from "./gem";
import { MissionElementItem } from "../parsing/mis_parser";

/** Gems need to be collected before being able to finish. */
export class GemMBU extends Gem {
	dtsPath = "shapes_mbu/items/gem.dts";

	constructor(element: MissionElementItem) {
		super(element);

		// Determine the color of the gem:
		let color = element.datablock.slice("GemItem".length, element.datablock.indexOf("_MBU"));
		if (color.length === 0) color = Gem.pickRandomColor(); // Random if no color specified

		this.matNamesOverride["base.gem"] = color.toLowerCase() + ".gem";
	}
}