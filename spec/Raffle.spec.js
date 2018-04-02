'use strict';

const Raffle = require('../src/Raffle');

class SpyEngine {
	constructor(response) {
		/* eslint-disable jasmine/no-unsafe-spy */
		/*
		 * To be safe, this object can only be created from within
		 * a beforeEach / it block
		 */
		this.queue_task = jasmine.createSpy('queue_task')
			.and.callFake(() => Promise.resolve(response));
		/* eslint-enable jasmine/no-unsafe-spy */
	}
}

function make_cp(data) {
	const cumulativeP = new Float64Array(data.length * 3);
	for(let i = 0; i < data.length; ++ i) {
		const x = i * 3;
		const d = data[i];
		cumulativeP[x] = d.cp;
		cumulativeP[x + 1] = d.p;
		cumulativeP[x + 2] = d.value;
	}
	return cumulativeP;
}

describe('Raffle', () => {
	let engine = null;

	beforeEach(() => {
		engine = new SpyEngine({
			cumulativeP: make_cp([
				{cp: 0.5, p: 0.5, value: 0},
				{cp: 1.0, p: 0.5, value: 1},
			]),
		});
	});

	it('stores an audience size', () => {
		const raffle = new Raffle({audience: 7, engine});

		expect(raffle.audience()).toEqual(7);
	});

	it('uses the total number of prizes as a default audience size', () => {
		const raffle = new Raffle({
			engine,
			prizes: [
				{count: 3, value: 7},
				{count: 10, value: 2},
				{count: 2, value: 2},
				{count: 1, value: 0},
			],
		});

		expect(raffle.audience()).toEqual(16);
	});

	it('stores prizes in rarity order', () => {
		const raffle = new Raffle({
			engine,
			prizes: [
				{count: 3, value: 7},
				{count: 10, value: 2},
				{count: 1, value: 0},
			],
		});

		expect(raffle.prizes()).toEqual([
			{count: 1, value: 0},
			{count: 3, value: 7},
			{count: 10, value: 2},
		]);
	});

	it('combines prizes of the same value', () => {
		const raffle = new Raffle({
			engine,
			prizes: [
				{count: 3, value: 7},
				{count: 10, value: 2},
				{count: 2, value: 2},
				{count: 1, value: 0},
			],
		});

		expect(raffle.prizes()).toEqual([
			{count: 1, value: 0},
			{count: 3, value: 7},
			{count: 12, value: 2},
		]);
	});

	it('fills in 0 prizes if the audience size is large', () => {
		const raffle = new Raffle({
			audience: 20,
			engine,
			prizes: [
				{count: 3, value: 7},
				{count: 10, value: 2},
				{count: 2, value: 2},
				{count: 1, value: 0},
			],
		});

		expect(raffle.audience()).toEqual(20);
		expect(raffle.prizes()).toEqual([
			{count: 3, value: 7},
			{count: 5, value: 0},
			{count: 12, value: 2},
		]);
	});

	describe('enter', () => {
		it('asynchronously creates a result with the ticket count', (done) => {
			const raffle = new Raffle({audience: 7, engine});
			raffle.enter(2).then((result) => {
				expect(result.tickets()).toEqual(2);
				done();
			});
		});

		it('stores calculated probabilities in the result', (done) => {
			const raffle = new Raffle({audience: 7, engine});
			raffle.enter(2).then((result) => {
				expect(result.cumulativeP).toEqual(make_cp([
					{cp: 0.5, p: 0.5, value: 0},
					{cp: 1.0, p: 0.5, value: 1},
				]));
				done();
			});
		});
	});
});

describe('Raffle Result', () => {
	let result = null;

	beforeEach((done) => {
		const engine = new SpyEngine({
			cumulativeP: make_cp([
				{cp: 0.2, p: 0.2, value: 0},
				{cp: 0.6, p: 0.4, value: 1},
				{cp: 1.0, p: 0.4, value: 2},
			]),
		});

		const raffle = new Raffle({audience: 7, engine});
		raffle.enter(2).then((res) => {
			result = res;
			done();
		});
	});

	describe('min', () => {
		it('returns the lowest possible prize value', () => {
			expect(result.min()).toEqual(0);
		});
	});

	describe('max', () => {
		it('returns the highest possible prize value', () => {
			expect(result.max()).toEqual(2);
		});
	});

	describe('mean', () => {
		it('returns the mean prize value', () => {
			expect(result.mean()).toBeNear(1.2, 1e-6);
		});
	});

	describe('exact_probability', () => {
		it('returns the probability of getting a specific prize value', () => {
			expect(result.exact_probability(0)).toBeNear(0.2, 1e-6);
			expect(result.exact_probability(1)).toBeNear(0.4, 1e-6);
			expect(result.exact_probability(2)).toBeNear(0.4, 1e-6);
		});

		it('returns zero for impossible values', () => {
			expect(result.exact_probability(-1)).toEqual(0);
			expect(result.exact_probability(0.5)).toEqual(0);
			expect(result.exact_probability(3)).toEqual(0);
		});
	});

	describe('range_probability', () => {
		it('returns the probability of low <= value < high', () => {
			expect(result.range_probability(-100, 0.5)).toBeNear(0.2, 1e-6);
			expect(result.range_probability(0.5, 100)).toBeNear(0.8, 1e-6);
		});

		it('returns zero for ranges containing no outcomes', () => {
			expect(result.range_probability(0.4, 0.6)).toEqual(0);
		});

		it('is inclusive of the lower bound', () => {
			expect(result.range_probability(0, 0.1)).toBeNear(0.2, 1e-6);
			expect(result.range_probability(1, 1.1)).toBeNear(0.4, 1e-6);
			expect(result.range_probability(2, 2.1)).toBeNear(0.4, 1e-6);
		});

		it('is exclusive of the upper bound', () => {
			expect(result.range_probability(-0.1, 0)).toEqual(0);
			expect(result.range_probability(0.9, 1)).toEqual(0);
			expect(result.range_probability(1.9, 2)).toEqual(0);
		});

		it('returns 1 if the entire range is covered', () => {
			expect(result.range_probability(-100, 100)).toEqual(1);
			expect(result.range_probability(0, 2.1)).toEqual(1);
		});

		it('returns zero for ranges outside the possible values', () => {
			expect(result.range_probability(-100, -50)).toEqual(0);
			expect(result.range_probability(50, 100)).toEqual(0);
		});
	});

	describe('percentile', () => {
		it('returns the winnings of the nth luckiest person', () => {
			expect(result.percentile(0)).toEqual(0);
			expect(result.percentile(19)).toEqual(0);
			expect(result.percentile(21)).toEqual(1);
			expect(result.percentile(25)).toEqual(1);
			expect(result.percentile(50)).toEqual(1);
			expect(result.percentile(59)).toEqual(1);
			expect(result.percentile(61)).toEqual(2);
			expect(result.percentile(75)).toEqual(2);
			expect(result.percentile(100)).toEqual(2);
		});

		it('caps extreme values', () => {
			expect(result.percentile(-1)).toEqual(0);
			expect(result.percentile(101)).toEqual(2);
		});
	});

	describe('median', () => {
		it('returns the 50th percentile', () => {
			expect(result.median()).toEqual(1);
		});
	});

	describe('mode', () => {
		it('returns the value with the highest probability', () => {
			expect(result.mode()).toEqual(2);
		});
	});
});
