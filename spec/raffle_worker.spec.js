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
