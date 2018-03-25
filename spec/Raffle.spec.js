'use strict';

const Raffle = require('../src/Raffle');

describe('Raffle', () => {
	beforeEach(() => {
		Raffle.generator = jasmine.createSpy('generator')
			.and.callFake((tickets, prizes, pCutoff, callback) => {
				callback([
					{p: 0.5, value: 0},
					{p: 1.0, value: 1},
				]);
			});
	});

	it('stores an audience size', () => {
		const raffle = new Raffle({audience: 7});

		expect(raffle.audience()).toEqual(7);
	});

	it('uses the total number of prizes as a default audience size', () => {
		const raffle = new Raffle({
			prizes: [
				{count: 3, value: 7},
				{count: 10, value: 2},
				{count: 2, value: 2},
				{count: 1, value: 0},
			],
		});

		expect(raffle.audience()).toEqual(16);
	});

	describe('enter', () => {
		it('asynchronously creates a result with the ticket count', (done) => {
			const raffle = new Raffle({audience: 7});
			raffle.enter(2).then((result) => {
				expect(result.tickets()).toEqual(2);
				done();
			});
		});

		it('stores calculated probabilities in the result', (done) => {
			const raffle = new Raffle({audience: 7});
			raffle.enter(2).then((result) => {
				expect(result.cumulativeP).toEqual([
					{p: 0.5, value: 0},
					{p: 1.0, value: 1},
				]);
				done();
			});
		});
	});
});

describe('Raffle Result', () => {
	let result = null;

	beforeEach((done) => {
		Raffle.generator = (tickets, prizes, pCutoff, callback) => {
			callback([
				{p: 0.5, value: 0},
				{p: 1.0, value: 1},
			]);
		};
		const raffle = new Raffle({audience: 7});
		raffle.enter(2).then((res) => {
			result = res;
			done();
		});
	});

	describe('min_value', () => {
		it('returns the lowest possible prize value', () => {
			expect(result.min_value()).toEqual(0);
		});
	});

	describe('max_value', () => {
		it('returns the highest possible prize value', () => {
			expect(result.max_value()).toEqual(1);
		});
	});

	describe('exact_probability', () => {
		it('returns the probability of getting a specific prize value', () => {
			expect(result.exact_probability(0)).toEqual(0.5);
			expect(result.exact_probability(1)).toEqual(0.5);
		});

		it('returns zero for impossible values', () => {
			expect(result.exact_probability(-1)).toEqual(0);
			expect(result.exact_probability(0.5)).toEqual(0);
			expect(result.exact_probability(2)).toEqual(0);
		});
	});

	describe('range_probability', () => {
		it('returns the probability of low <= value < high', () => {
			expect(result.range_probability(-100, 0.5)).toEqual(0.5);
			expect(result.range_probability(0.5, 100)).toEqual(0.5);
		});

		it('returns zero for ranges containing no outcomes', () => {
			expect(result.range_probability(0.4, 0.6)).toEqual(0);
		});

		it('is inclusive of the lower bound', () => {
			expect(result.range_probability(0, 0.1)).toEqual(0.5);
			expect(result.range_probability(1, 1.1)).toEqual(0.5);
		});

		it('is exclusive of the upper bound', () => {
			expect(result.range_probability(-0.1, 0)).toEqual(0);
			expect(result.range_probability(0.9, 1)).toEqual(0);
		});

		it('returns 1 if the entire range is covered', () => {
			expect(result.range_probability(-100, 100)).toEqual(1);
			expect(result.range_probability(0, 1.1)).toEqual(1);
		});

		it('returns zero for ranges outside the possible values', () => {
			expect(result.range_probability(-100, -50)).toEqual(0);
			expect(result.range_probability(50, 100)).toEqual(0);
		});
	});
});
