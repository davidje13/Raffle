'use strict';

const Raffle = require('../src/Raffle');

describe('Raffle Integration', () => {
	let worker = null;
	beforeAll(async () => {
		worker = await require('../src/raffle_worker');
	});

	it('calculates probabilities and returns them', async () => {
		const raffle = new Raffle({
			engine: worker.SynchronousEngine,
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
			engine: worker.SynchronousEngine,
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
