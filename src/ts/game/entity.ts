import { EntityState } from "../../../shared/game_server_format";
import { Game } from "./game";

export abstract class Entity {
	id: number;

	game: Game;
	owned = false;
	version = 0;
	challengeable = false;

	stateNeedsStore = false;
	internalStateNeedsStore = true; // Start out true so we store it once in the beninging... in the... in the beni... in the beninging (listen properly)

	constructor(game: Game) {
		this.game = game;
	}

	abstract update(): void;
	abstract render(): void;
	abstract reset(): void;
	abstract stop(): void;

	beforeReconciliation() {}
	afterReconciliation() {}

	interactWith(otherObject: Entity) {
		this.game.state.recordEntityInteraction(this, otherObject);
	}

	getCurrentState(): EntityState { return null; }
	getInitialState(): EntityState { return null; }
	loadState(state: EntityState, meta: { frame: number, remote: boolean }) {}

	getInternalState(): any { return null; }
	loadInternalState(state: any, frame: number) {}
}