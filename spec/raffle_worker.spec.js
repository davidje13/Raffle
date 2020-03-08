'use strict';

let worker = null;
beforeAll(async () => {
	worker = await require('../src/raffle_worker');
});

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

describe('mult', () => {
	it('multiplies two probability maps', () => {
		const pMap1 = new Map();
		pMap1.set(0, 0.5);
		pMap1.set(1, 0.5);

		const pMap2 = new Map();
		pMap2.set(2, 0.25);
		pMap2.set(5, 0.25);
		pMap2.set(7, 0.50);

		const pMapM = worker.mult(pMap1, pMap2, 0);

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

		const pMapM = worker.mult(pMap1, pMap2, 0);

		expect(pMapM.size).toEqual(3);
		expect(pMapM.get(1)).toEqual(0.25);
		expect(pMapM.get(3)).toEqual(0.50);
		expect(pMapM.get(5)).toEqual(0.25);
	});

	it('returns identity transforms if a parameter is null', () => {
		const pMap1 = new Map();
		pMap1.set(0, 1);

		expect(worker.mult(pMap1, null, 0)).toEqual(pMap1);
		expect(worker.mult(null, pMap1, 0)).toEqual(pMap1);
	});

	it('returns null if both parameters are null', () => {
		expect(worker.mult(null, null, 0)).toBeNull();
	});
});

describe('power', () => {
	it('repeatedly multiplies a probability map by itself', () => {
		const pMap = new Map();
		pMap.set(0, 0.5);
		pMap.set(1, 0.5);

		const pMapP = worker.pow(pMap, 2, 0);

		expect(pMapP.size).toEqual(3);
		expect(pMapP.get(0)).toEqual(0.25);
		expect(pMapP.get(1)).toEqual(0.50);
		expect(pMapP.get(2)).toEqual(0.25);
	});

	it('handles large powers', () => {
		const pMap = new Map();
		pMap.set(0, 0.5);
		pMap.set(1, 0.5);

		const pMapP = worker.pow(pMap, 12, 0);

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

		const pMapP = worker.pow(pMap, 1, 0);

		expect(pMapP).toEqual(pMap);
	});

	it('returns a unitary pMap if the power is 0', () => {
		const pMap = new Map();
		pMap.set(0, 0.5);
		pMap.set(1, 0.5);

		const pMapP = worker.pow(pMap, 0, 0);

		expect(pMapP.size).toEqual(1);
		expect(pMapP.get(0)).toEqual(1);
	});
});

describe('extract_cumulative_probability', () => {
	it('creates a cumulative probability array from a map', () => {
		const pMap = new Map();
		pMap.set(0, 0.5);
		pMap.set(1, 0.5);

		const {cumulativeP} = worker.extract_cumulative_probability(pMap, 0);

		expect(cumulativeP).toEqual(make_cp([
			{cp: 0.5, p: 0.5, value: 0},
			{cp: 1.0, p: 0.5, value: 1},
		]));
	});

	it('ensures low-to-high ordering', () => {
		const pMap = new Map();
		pMap.set(1, 0.5);
		pMap.set(0, 0.5);

		const {cumulativeP} = worker.extract_cumulative_probability(pMap, 0);

		expect(cumulativeP).toEqual(make_cp([
			{cp: 0.5, p: 0.5, value: 0},
			{cp: 1.0, p: 0.5, value: 1},
		]));
	});

	it('normalises the output to [0 1]', () => {
		const pMap = new Map();
		pMap.set(1, 1);
		pMap.set(0, 1);

		const {
			cumulativeP,
			totalP,
		} = worker.extract_cumulative_probability(pMap, 0);

		expect(totalP).toEqual(2);
		expect(cumulativeP).toEqual(make_cp([
			{cp: 0.5, p: 0.5, value: 0},
			{cp: 1.0, p: 0.5, value: 1},
		]));
	});
});

describe('message_listener', () => {
	beforeEach(() => {
		worker.post.fn = jasmine.createSpy('fn');
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
		worker.message_listener(event);

		expect(worker.post.fn).toHaveBeenCalledWith({
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
		worker.message_listener(event);

		expect(worker.post.fn).toHaveBeenCalledWith({
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
		worker.message_listener(event);

		expect(worker.post.fn).toHaveBeenCalledWith({
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
