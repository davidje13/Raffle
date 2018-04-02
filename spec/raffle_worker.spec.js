'use strict';

const {
	calculate_final_odds,
	calculate_odds,
	calculate_probability_map,
	extract_cumulative_probability,
	ln_factorial,
	message_listener,
	mult,
	post,
	pow,
} = require('../src/raffle_worker');

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

	it('fills in certainties due to full sampling', () => {
		const odds = calculate_odds(3, 2, 3);

		expect(odds.length).toEqual(4);
		expect(odds[0]).toBeNear(0, 1e-6);
		expect(odds[1]).toBeNear(0, 1e-6);
		expect(odds[2]).toBeNear(1, 1e-6);
		expect(odds[3]).toBeNear(0, 1e-6);
	});

	it('fills in certainties due to no targets', () => {
		const odds = calculate_odds(3, 0, 2);

		expect(odds.length).toEqual(3);
		expect(odds[0]).toBeNear(1, 1e-6);
		expect(odds[1]).toBeNear(0, 1e-6);
		expect(odds[2]).toBeNear(0, 1e-6);
	});

	it('fills in certainties due to saturated targets', () => {
		const odds = calculate_odds(3, 3, 2);

		expect(odds.length).toEqual(3);
		expect(odds[0]).toBeNear(0, 1e-6);
		expect(odds[1]).toBeNear(0, 1e-6);
		expect(odds[2]).toBeNear(1, 1e-6);
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

describe('mult', () => {
	it('multiplies two probability maps', () => {
		const pMap1 = new Map();
		pMap1.set(0, 0.5);
		pMap1.set(1, 0.5);

		const pMap2 = new Map();
		pMap2.set(2, 0.25);
		pMap2.set(5, 0.25);
		pMap2.set(7, 0.50);

		const pMapM = mult(pMap1, pMap2, 0);

		expect(pMapM.size).toEqual(6);
		expect(pMapM.get(2)).toEqual(0.125);
		expect(pMapM.get(3)).toEqual(0.125);
		expect(pMapM.get(5)).toEqual(0.125);
		expect(pMapM.get(6)).toEqual(0.125);
		expect(pMapM.get(7)).toEqual(0.250);
		expect(pMapM.get(8)).toEqual(0.250);
	});

	it('combines incident values', () => {
		const pMap1 = new Map();
		pMap1.set(0, 0.5);
		pMap1.set(2, 0.5);

		const pMap2 = new Map();
		pMap2.set(1, 0.5);
		pMap2.set(3, 0.5);

		const pMapM = mult(pMap1, pMap2, 0);

		expect(pMapM.size).toEqual(3);
		expect(pMapM.get(1)).toEqual(0.25);
		expect(pMapM.get(3)).toEqual(0.50);
		expect(pMapM.get(5)).toEqual(0.25);
	});

	it('returns identity transforms if a parameter is null', () => {
		const pMap1 = new Map();
		pMap1.set(0, 1);

		expect(mult(pMap1, null, 0)).toEqual(pMap1);
		expect(mult(null, pMap1, 0)).toEqual(pMap1);
	});

	it('returns null if both parameters are null', () => {
		expect(mult(null, null, 0)).toBeNull();
	});
});

describe('power', () => {
	it('repeatedly multiplies a probability map by itself', () => {
		const pMap = new Map();
		pMap.set(0, 0.5);
		pMap.set(1, 0.5);

		const pMapP = pow(pMap, 2, 0);

		expect(pMapP.size).toEqual(3);
		expect(pMapP.get(0)).toEqual(0.25);
		expect(pMapP.get(1)).toEqual(0.50);
		expect(pMapP.get(2)).toEqual(0.25);
	});

	it('handles large powers', () => {
		const pMap = new Map();
		pMap.set(0, 0.5);
		pMap.set(1, 0.5);

		const pMapP = pow(pMap, 12, 0);

		expect(pMapP.size).toEqual(13);
		expect(pMapP.get(0)).toBeNear(1 / 4096, 1e-6);
		expect(pMapP.get(1)).toBeNear(12 / 4096, 1e-6);
		expect(pMapP.get(2)).toBeNear(66 / 4096, 1e-6);
		expect(pMapP.get(3)).toBeNear(220 / 4096, 1e-6);
		expect(pMapP.get(4)).toBeNear(495 / 4096, 1e-6);
		expect(pMapP.get(5)).toBeNear(792 / 4096, 1e-6);
		expect(pMapP.get(6)).toBeNear(924 / 4096, 1e-6);
		expect(pMapP.get(7)).toBeNear(792 / 4096, 1e-6);
		expect(pMapP.get(8)).toBeNear(495 / 4096, 1e-6);
		expect(pMapP.get(9)).toBeNear(220 / 4096, 1e-6);
		expect(pMapP.get(10)).toBeNear(66 / 4096, 1e-6);
		expect(pMapP.get(11)).toBeNear(12 / 4096, 1e-6);
		expect(pMapP.get(12)).toBeNear(1 / 4096, 1e-6);
	});

	it('returns identity transforms if the power is 1', () => {
		const pMap = new Map();
		pMap.set(0, 0.5);
		pMap.set(1, 0.5);

		const pMapP = pow(pMap, 1, 0);

		expect(pMapP).toEqual(pMap);
	});

	it('returns a unitary pMap if the power is 0', () => {
		const pMap = new Map();
		pMap.set(0, 0.5);
		pMap.set(1, 0.5);

		const pMapP = pow(pMap, 0, 0);

		expect(pMapP.size).toEqual(1);
		expect(pMapP.get(0)).toEqual(1);
	});
});

describe('extract_cumulative_probability', () => {
	it('creates a cumulative probability array from a map', () => {
		const pMap = new Map();
		pMap.set(0, 0.5);
		pMap.set(1, 0.5);

		const {cumulativeP} = extract_cumulative_probability(pMap, 0);

		expect(cumulativeP).toEqual(make_cp([
			{cp: 0.5, p: 0.5, value: 0},
			{cp: 1.0, p: 0.5, value: 1},
		]));
	});

	it('ensures low-to-high ordering', () => {
		const pMap = new Map();
		pMap.set(1, 0.5);
		pMap.set(0, 0.5);

		const {cumulativeP} = extract_cumulative_probability(pMap, 0);

		expect(cumulativeP).toEqual(make_cp([
			{cp: 0.5, p: 0.5, value: 0},
			{cp: 1.0, p: 0.5, value: 1},
		]));
	});

	it('normalises the output to [0 1]', () => {
		const pMap = new Map();
		pMap.set(1, 1);
		pMap.set(0, 1);

		const {cumulativeP, totalP} = extract_cumulative_probability(pMap, 0);

		expect(totalP).toEqual(2);
		expect(cumulativeP).toEqual(make_cp([
			{cp: 0.5, p: 0.5, value: 0},
			{cp: 1.0, p: 0.5, value: 1},
		]));
	});
});

describe('message_listener', () => {
	beforeEach(() => {
		post.fn = jasmine.createSpy('fn');
	});

	it('simulates odds in a raffle if called with "generate"', () => {
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
				type: 'generate',
			},
		};
		message_listener(event);

		expect(post.fn).toHaveBeenCalledWith({
			cumulativeP: make_cp([
				{cp: 0.875, p: 0.875, value: 0},
				{cp: 1.000, p: 0.125, value: 1},
			]),
			normalisation: 1,
			type: 'result',
		}, jasmine.anything());
	});

	it('raises a distribution to a power if called with "pow"', () => {
		const event = {
			data: {
				cumulativeP: make_cp([
					{cp: 0.5, p: 0.5, value: 0},
					{cp: 1.0, p: 0.5, value: 1},
				]),
				pCutoff: 0,
				power: 2,
				type: 'pow',
			},
		};
		message_listener(event);

		expect(post.fn).toHaveBeenCalledWith({
			cumulativeP: make_cp([
				{cp: 0.25, p: 0.25, value: 0},
				{cp: 0.75, p: 0.50, value: 1},
				{cp: 1.00, p: 0.25, value: 2},
			]),
			normalisation: 1,
			type: 'result',
		}, jasmine.anything());
	});

	it('compounds results if called with "compound"', () => {
		const event = {
			data: {
				pCutoff: 0,
				parts: [
					{
						p: 0.5,
						r: make_cp([
							{cp: 0.5, p: 0.5, value: 0},
							{cp: 1.0, p: 0.5, value: 1},
						]),
						value: 0,
					},
					{
						p: 0.5,
						r: make_cp([
							{cp: 0.5, p: 0.25, value: 0},
							{cp: 1.0, p: 0.75, value: 1},
						]),
						value: 1,
					},
				],
				type: 'compound',
			},
		};
		message_listener(event);

		expect(post.fn).toHaveBeenCalledWith({
			cumulativeP: make_cp([
				{cp: 0.250, p: 0.250, value: 0},
				{cp: 0.625, p: 0.375, value: 1},
				{cp: 1.000, p: 0.375, value: 2},
			]),
			normalisation: 1,
			type: 'result',
		}, jasmine.anything());
	});
});
