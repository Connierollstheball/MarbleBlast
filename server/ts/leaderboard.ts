import * as http from 'http';
import { promisify } from 'util';
import * as zlib from 'zlib';
import * as fs from 'fs-extra';
import * as path from 'path';
import fetch from 'node-fetch';

import { shared } from './shared';
import { escapeDiscord, secondsToTimeString, uppercaseFirstLetter } from './util';

interface ScoreRow {
	rowid?: number,
	mission?: string,
	time?: number,
	username?: string,
	user_random_id?: string,
	timestamp?: number
}

/** Transmits all the scores for the missions specified in the body payload. */
export const getLeaderboard = async (res: http.ServerResponse, body: string) => {
	if (!body) throw new Error("Missing body.");

	let options: {
		missions: string[]
	} = JSON.parse(body);

	let response: Record<string, [string, number][]> = {};

	for (let mission of options.missions) {
		let rows: ScoreRow[] = shared.getScoresForMissionStatement.all(mission);
		response[mission] = rows.map(x => [x.username.slice(0, 16), x.time]);
	}

	let stringified = JSON.stringify(response);
	res.writeHead(200, {
		'Content-Type': 'application/json',
		'Content-Length': Buffer.byteLength(stringified),
		'Cache-Control': 'no-cache, no-store' // Don't cache this
	});
	res.end(stringified);
};

/** Submits new scores to the leaderboard. */
export const submitScores = async (res: http.ServerResponse, body: string) => {
	if (!body) throw new Error("Missing body.");

	let timestamp = Date.now();
	let data: {
		randomId: string,
		bestTimes: string, // String, because it's compressed and encoded
		latestTimestamp: number
		replays: Record<string, string>
	} = JSON.parse(body);

	// Unpack best times
	let bestTimes: Record<string, [string, number]> = data.bestTimes? JSON.parse((await promisify(zlib.inflate)(Buffer.from(data.bestTimes, 'base64'))).toString()) : {};
	let promises: Promise<void>[] = [];

	// Loop over all new scores
	for (let missionPath in bestTimes) {
		let score = bestTimes[missionPath];
		score[0] = score[0].slice(0, 16); // Fuck you
		let existingRow: ScoreRow = shared.getScoreByUserStatement.get(missionPath, score[0], data.randomId); // See if a score by this player already exists on this mission
		let oldTopScore: ScoreRow = shared.getTopScoreStatement.get(missionPath);
		let inserted = false;

		if (existingRow) {
			if (existingRow.time > score[1]) {
				// If the new score is faster, delete all the old ones and then insert; otherwise do nothing

				// Make sure this step is atomic
				shared.db.transaction(() => {
					shared.deleteScoresStatement.run(missionPath, score[0], data.randomId); // Could be multiple scores!
					shared.insertScoreStatement.run(missionPath, score[1], score[0], data.randomId, timestamp);
				})();

				inserted = true;
			}
		} else {
			// Add the new score to the leaderboard
			shared.insertScoreStatement.run(missionPath, score[1], score[0], data.randomId, timestamp);
			inserted = true;
		}

		if (inserted) {
			// See if this score is now the top #1 score for this mission
			let topScore: ScoreRow = shared.getTopScoreStatement.get(missionPath);
			if (topScore.username !== score[0] || topScore.time !== score[1]) continue;

			if (data.replays[missionPath]) {
				// If a replay was sent, store it
				let replayBuffer = Buffer.from(data.replays[missionPath], 'base64');
				promises.push(fs.writeFile(path.join(__dirname, 'storage', 'wrecs', missionPath.replace(/\//g, '_') + '.wrec'), replayBuffer));
			}

			if (shared.config.discordWebhookUrl) {
				// Broadcast a world record message to the webhook URL
				let allowed = true;
				if (missionPath.includes('custom/')) {
					let scoreCount: number = shared.getMissionScoreCount.pluck().get(missionPath);
					if (scoreCount < shared.config.webhookCustomMinScoreThreshold) allowed = false; // Not enough scores yet, don't broadcast
				}

				if (allowed) broadcastToWebhook(missionPath, score, oldTopScore);
			}
		}
	}

	await Promise.all(promises);

	sendNewScores(res, data.latestTimestamp);
};

/** Broadcasts a new #1 score to a Discord webhook as a world record message. */
const broadcastToWebhook = (missionPath: string, score: [string, number], previousRecord?: ScoreRow) => {
	let missionName = escapeDiscord(getMissionNameFromMissionPath(missionPath)).trim();
	let timeString = secondsToTimeString(score[1] / 1000);
	let modification = missionPath.startsWith('mbp')? 'platinum': missionPath.startsWith('mbu')? 'ultra' : 'gold';
	if (modification !== 'gold') missionPath = missionPath.slice(4);
	let category = uppercaseFirstLetter(missionPath.slice(0, missionPath.indexOf('/')));

	let message = `**${escapeDiscord(score[0])}** has just achieved a world record on **${missionName}** (Web ${uppercaseFirstLetter(modification)} ${category}) of **${timeString}**`;

	// Add absolute and relative improvement data to the message in case this score improves an old one
	if (previousRecord) {
		let diff = previousRecord.time - score[1];
		let diffString: string;

		// Choose the unit based on the magnitude
		if (diff >= 1000) {
			diffString = (diff / 1000).toFixed(3) + ' s';
		} else if (diff >= 1) {
			diffString = diff.toPrecision(3) + ' ms';
		} else if (diff >= 1e-3) {
			diffString = (diff * 1e3).toPrecision(3) + ' μs';
		} else if (diff >= 1e-6) {
			// Nanosecond accuracy is more a meme, in no way do the phyics justify time differences this precise
			diffString = Math.floor(diff * 1e6) + ' ns';
		} else {
			diffString = '<1 ns';
		}

		let relativeDiffString = (((1 -  score[1] / previousRecord.time) || 0) * 100).toPrecision(3) + '%'; // Make sure to catch NaN just in case

		message += ` _(-${diffString} | -${relativeDiffString})_`;
	}

	fetch(shared.config.discordWebhookUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			content: message
		})
	});
};

/** Gets the mission name from a given mission path. */
const getMissionNameFromMissionPath = (missionPath: string) => {
	if (missionPath.includes('custom/')) {
		// Find the corresponding CLA entry
		let claEntry = shared.claList.find(x => x.id === Number(missionPath.slice(missionPath.lastIndexOf('/') + 1)));
		return claEntry.name;
	} else {
		return shared.levelNameMap[missionPath];
	}
};

/** Transmits a score delta, so all new scores since a given timestamp. */
const sendNewScores = (res: http.ServerResponse, timestamp: number) => {
	let result: Record<string, [string, number][]> = {};

	if (timestamp || timestamp === 0) {
		// Send all new scores since that that last timestamp; let the client insert them at the right spot
		let newScores: ScoreRow[] = shared.getNewerScoresStatement.all(timestamp);
		for (let score of newScores) {
			if (!result[score.mission]) result[score.mission] = [];
			result[score.mission].push([score.username.slice(0, 16), score.time]);
		}
	}

	// Also get the timestamp of the score with the highest timestamp
	let latestTimestamp: number = shared.getLatestTimestampStatement.pluck().get();
	if (!latestTimestamp) latestTimestamp = 0;

	let stringified = JSON.stringify({
		latestTimestamp: latestTimestamp,
		scores: result
	});
	res.writeHead(200, {
		'Content-Type': 'application/json',
		'Content-Length': Buffer.byteLength(stringified),
		'Cache-Control': 'no-cache, no-store' // Don't cache this
	});
	res.end(stringified);
};

/** Creates a sheet of default-level world records in CSV format for use in spreadsheets. */
export const getWorldRecordSheet = async (res: http.ServerResponse) => {
	let lastCategory: string = null;
	let output = "";

	for (let missionPath in shared.levelNameMap) {
		let category = uppercaseFirstLetter(missionPath.split('/')[0]);
		if (category === 'Mbp') category = 'Platinum ' + uppercaseFirstLetter(missionPath.split('/')[1]);
		else if (category === 'Mbu') category = 'Ultra ' + uppercaseFirstLetter(missionPath.split('/')[1]);
		else category = 'Gold ' + category;

		if (category !== lastCategory) {
			// Add a header row if the category changes
			output += category + '\n';
			if (!lastCategory) output += "Level,Time,Runner,.wrec submitted?\n";

			lastCategory = category;
		}

		// Get the top score for this mission
		let topScore: ScoreRow = shared.getTopScoreStatement.get(missionPath);
		if (!topScore) topScore = {
			time: 99 * 60 * 1000 + 59 * 1000 + 999,
			username: 'Nardo Polo'
		};

		// Check if a .wrec for this mission exists
		let wrecPath = path.join(__dirname, 'storage', 'wrecs', missionPath.replace(/\//g, '_') + '.wrec');
		let wrecExists = await fs.pathExists(wrecPath);

		// Add row
		output += `${shared.levelNameMap[missionPath]},${topScore.time},${topScore.username.slice(0, 16)},${wrecExists? 'Yes' : 'No'}\n`;
	}

	res.writeHead(200, {
		'Content-Type': 'text/plain; charset=utf-8',
		'Content-Length': Buffer.byteLength(output),
		'Cache-Control': 'no-cache, no-store'
	});
	res.end(output);
};