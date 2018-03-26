'use strict';

const {
	calculate_final_odds,
	calculate_odds,
	calculate_probability_map,
	extract_cumulative_probability,
	ln_factorial,
	message_listener,
	post,
} = require('../src/raffle_worker');

describe('ln_factorial', () => {
	it('calculates log(n!) for small n', () => {
		// Simple (sum of logs) domain
		expect(ln_factorial(0)).toBeNear(0.0, 1e-6);
		expect(ln_factorial(1)).toBeNear(0.0, 1e-6);
		expect(ln_factorial(2)).toBeNear(0.6931472, 1e-6);
		expect(ln_factorial(3)).toBeNear(1.7917595, 1e-6);
		expect(ln_factorial(4)).toBeNear(3.1780538, 1e-6);
		expect(ln_factorial(256)).toBeNear(1167.2572786, 1e-6);
	});

	it('calculates log(n!) for large n', () => {
		// Stirling approximation domain
		expect(ln_factorial(257)).toBeNear(1172.8063546, 1e-6);
		expect(ln_factorial(300)).toBeNear(1414.9058499, 1e-6);
	});

	it('calculates log(n!) for very large n', () => {
		expect(ln_factorial(1000000)).toBeNear(12815518.3846582, 1e-6);
	});

	it('loses minimal precision', () => {
		const a = ln_factorial(1000000001);
		const b = ln_factorial(1000000000);

		expect(Math.exp(a - b)).toBeNear(1000000001, 1e4);
	});
});

describe('calculate_odds', () => {
	it('generates a table of probabilities', () => {
		const odds = calculate_odds(9, 5, 4);

		expect(odds.length).toEqual(5);
		/* eslint-disable space-in-parens */
		expect(odds[0]).toBeNear( 1 / 126, 1e-6); // 5c0 * 4c4 =  1*1 =  1
		expect(odds[1]).toBeNear(20 / 126, 1e-6); // 5c1 * 4c3 =  5*4 = 20
		expect(odds[2]).toBeNear(60 / 126, 1e-6); // 5c2 * 4c2 = 10*6 = 60
		expect(odds[3]).toBeNear(40 / 126, 1e-6); // 5c3 * 4c1 = 10*4 = 40
		expect(odds[4]).toBeNear( 5 / 126, 1e-6); // 5c4 * 4c0 =  5*1 =  5
		/* eslint-enable space-in-parens */
	});

	it('gives an exact list for 0 samples', () => {
		const odds = calculate_odds(7, 5, 0);

		expect(odds.length).toEqual(1);
		expect(odds[0]).toEqual(1);
	});

	it('gives an exact list for 1 sample', () => {
		const odds = calculate_odds(7, 5, 1);

		expect(odds.length).toEqual(2);
		expect(odds[0]).toEqual(2 / 7);
		expect(odds[1]).toEqual(5 / 7);
	});

	it('fills in imposible high values with 0', () => {
		const odds = calculate_odds(7, 2, 4);

		expect(odds.length).toEqual(5);
		expect(odds[0]).toBeNear(1 / 7, 1e-6);
		expect(odds[1]).toBeNear(4 / 7, 1e-6);
		expect(odds[2]).toBeNear(2 / 7, 1e-6);
		expect(odds[3]).toBeNear(0 / 7, 1e-6);
		expect(odds[4]).toBeNear(0 / 7, 1e-6);
	});

	it('fills in imposible low values with 0', () => {
		const odds = calculate_odds(7, 5, 4);

		expect(odds.length).toEqual(5);
		expect(odds[0]).toBeNear(0 / 7, 1e-6);
		expect(odds[1]).toBeNear(0 / 7, 1e-6);
		expect(odds[2]).toBeNear(2 / 7, 1e-6);
		expect(odds[3]).toBeNear(4 / 7, 1e-6);
		expect(odds[4]).toBeNear(1 / 7, 1e-6);
	});

	it('fills in certainties', () => {
		const odds = calculate_odds(3, 2, 3);

		expect(odds.length).toEqual(4);
		expect(odds[0]).toBeNear(0, 1e-6);
		expect(odds[1]).toBeNear(0, 1e-6);
		expect(odds[2]).toBeNear(1, 1e-6);
		expect(odds[3]).toBeNear(0, 1e-6);
	});
});

describe('calculate_final_odds', () => {
	function call(total, targets, samples) {
		const odds = calculate_odds(total, targets, samples);
		return {
			actual: calculate_final_odds(total, targets, samples),
			expected: odds[odds.length - 1],
		};
	}

	it('returns calculate_odds[samples]', () => {
		const {actual, expected} = call(100, 20, 10);

		expect(actual).toBeNear(expected, 1e-6);
	});

	it('gives an exact value for 0 samples', () => {
		const {actual, expected} = call(100, 20, 0);

		expect(actual).toEqual(expected);
	});

	it('gives an exact value for 1 sample', () => {
		const {actual, expected} = call(100, 20, 1);

		expect(actual).toEqual(expected);
	});

	it('recognises impossible outcomes', () => {
		const {actual} = call(7, 2, 4);

		expect(actual).toEqual(0);
	});
});

describe('calculate_probability_map', () => {
	it('creates a map of value to probability', () => {
		const pMap = calculate_probability_map([
			{count: 1, value: 1},
			{count: 7, value: 0},
		], 1, 0);

		expect(pMap.size).toEqual(2);
		expect(pMap.get(0)).toEqual(0.875); // 7/8
		expect(pMap.get(1)).toEqual(0.125); // 1/8
	});

	it('combines winnings from different tickets', () => {
		const pMap = calculate_probability_map([
			{count: 2, value: 1},
			{count: 6, value: 0},
		], 2, 0);

		expect(pMap.size).toEqual(3);
		expect(pMap.get(0)).toBeNear(0.5357143, 1e-6); // 6/8 * 5/7 * 2C0
		expect(pMap.get(1)).toBeNear(0.4285714, 1e-6); // 2/8 * 6/7 * 2C1
		expect(pMap.get(2)).toBeNear(0.0357143, 1e-6); // 2/8 * 1/7 * 2C2
	});

	it('combines winnings from different prizes', () => {
		const pMap = calculate_probability_map([
			{count: 1, value: 10},
			{count: 3, value: 5},
			{count: 4, value: 0},
		], 4, 0);

		expect(pMap.size).toEqual(6);

		// (4x0): 4/8 * 3/7 * 2/6 * 1/5 * 4C4
		expect(pMap.get(0)).toBeNear(0.0142857, 1e-6);

		// (1x5, 3x0): 3/8 * 4C1 * 4/7 * 3/6 * 2/5 * 3C3
		expect(pMap.get(5)).toBeNear(0.1714286, 1e-6);

		// (1x10, 3x0): 1/8 * 4C1 * 4/7 * 3/6 * 2/5 * 3C3 +
		// ( 2x5, 2x0): 3/8 * 2/7 * 4C2 * 4/6 * 3/5 * 2C2
		expect(pMap.get(10)).toBeNear(0.3142857, 1e-6);

		// (1x10, 1x5, 2x0): 1/8 * 4C1 * 3/7 * 3C1 * 4/6 * 3/5 * 2C2 +
		// (      3x5, 1x0): 3/8 * 2/7 * 1/6 * 4C3 * 4/5 * 1C1
		expect(pMap.get(15)).toBeNear(0.3142857, 1e-6);

		// (1x10, 2x5, 1x0): 1/8 * 4C1 * 3/7 * 2/6 * 3C2 * 4/5 * 1C1
		expect(pMap.get(20)).toBeNear(0.1714286, 1e-6);

		// (1x10, 3x5): 1/8 * 4C1 * 3/7 * 2/6 * 1/5 * 3C3
		expect(pMap.get(25)).toBeNear(0.0142857, 1e-6);
	});
});

describe('extract_cumulative_probability', () => {
	it('creates a cumulative probability array from a map', () => {
		const pMap = new Map();
		pMap.set(0, 0.5);
		pMap.set(1, 0.5);

		const {cumulativeP} = extract_cumulative_probability(pMap);

		expect(cumulativeP).toEqual([
			{cp: 0.5, p: 0.5, value: 0},
			{cp: 1.0, p: 0.5, value: 1},
		]);
	});

	it('ensures low-to-high ordering', () => {
		const pMap = new Map();
		pMap.set(1, 0.5);
		pMap.set(0, 0.5);

		const {cumulativeP} = extract_cumulative_probability(pMap);

		expect(cumulativeP).toEqual([
			{cp: 0.5, p: 0.5, value: 0},
			{cp: 1.0, p: 0.5, value: 1},
		]);
	});

	it('normalises the output to [0 1]', () => {
		const pMap = new Map();
		pMap.set(1, 1);
		pMap.set(0, 1);

		const {cumulativeP, totalP} = extract_cumulative_probability(pMap);

		expect(totalP).toEqual(2);
		expect(cumulativeP).toEqual([
			{cp: 0.5, p: 0.5, value: 0},
			{cp: 1.0, p: 0.5, value: 1},
		]);
	});
});

describe('message_listener', () => {
	beforeEach(() => {
		post.fn = jasmine.createSpy('fn');
	});

	it('performs a calculation when called', () => {
		// With these values we can expect a precise result;
		// No need to mess about with floating point rounding errors
		const event = {
			data: {
				pCutoff: 0,
				prizes: [
					{count: 1, value: 1},
					{count: 7, value: 0},
				],
				tickets: 1,
			},
		};
		message_listener(event);

		expect(post.fn).toHaveBeenCalledWith({
			cumulativeP: [
				{cp: 0.875, p: 0.875, value: 0},
				{cp: 1.000, p: 0.125, value: 1},
			],
			normalisation: 1,
			type: 'result',
		});
	});
});
