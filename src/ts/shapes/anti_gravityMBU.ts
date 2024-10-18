import { AntiGravity } from "./anti_gravity";

/** Changes the gravity on pickup. */
export class AntiGravityMBU extends AntiGravity {
	dtsPath = "shapes_mbu/items/antigravity.dts";
	autoUse = true;
	pickUpName = "Gravity Modifier";
}