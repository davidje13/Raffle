'use strict';

const Raffle = require('../src/Raffle');
const prep = require('../src/raffle_worker');

let SynchronousEngine;

beforeAll(async () => {
	const v = await prep;
	SynchronousEngine = v.SynchronousEngine;
});

describe('Raffle Integration', () => {
	it('calculates probabilities and returns them', async () => {
		const raffle = new Raffle({
			engine: SynchronousEngine,
			prizes: [
				{count: 1, value: 0},
				{count: 1, value: 1},
			],
		});

		const result = await raffle.enter(1);

		expect(result.range_probability(0.5, 1.5))
			.toBeNear(0.5, 1e-6);
	});

	it('calculates distributions of repeated runs', async () => {
		const raffle = new Raffle({
			engine: SynchronousEngine,
			prizes: [
				{count: 1, value: 0},
				{count: 1, value: 1},
			],
		});

		const oneRun = await raffle.enter(1);
		const twoRuns = await oneRun.pow(2);

		expect(twoRuns.range_probability(1.5, 2.5))
			.toBeNear(0.25, 1e-6);
	});
});
