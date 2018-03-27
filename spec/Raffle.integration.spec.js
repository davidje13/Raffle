'use strict';

const {SynchronousEngine} = require('../src/raffle_worker');
const Raffle = require('../src/Raffle');

describe('Raffle Integration', () => {
	it('calculates probabilities and returns them', (done) => {
		const raffle = new Raffle({
			engine: SynchronousEngine,
			prizes: [
				{count: 1, value: 0},
				{count: 1, value: 1},
			],
		});

		raffle.enter(1)
			.then((result) => {
				expect(result.range_probability(0.5, 1.5))
					.toBeNear(0.5, 1e-6);
				done();
			});
	});

	it('calculates distributions of repeated runs', (done) => {
		const raffle = new Raffle({
			engine: SynchronousEngine,
			prizes: [
				{count: 1, value: 0},
				{count: 1, value: 1},
			],
		});

		raffle.enter(1)
			.then((result) => result.pow(2))
			.then((result) => {
				expect(result.range_probability(1.5, 2.5))
					.toBeNear(0.25, 1e-6);
				done();
			});
	});
});
