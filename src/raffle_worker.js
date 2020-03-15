'use strict';

/* eslint-disable no-underscore-dangle */ // Auto-name-mangling

function loadWASM() {
	const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
	const importObject = {
		env: {
			_abort: () => {
				throw new Error();
			},
			_console_log: (n) => {
				console.log(n);
			},
			memory,
		},
	};

	function handleLoaded({instance}) {
		instance.exports._prep();

		function readCumulativeMap(ptr) {
			const [totalP] = new Float64Array(memory.buffer, ptr, 1);
			const [length] = new Int32Array(
				memory.buffer,
				ptr + Float64Array.BYTES_PER_ELEMENT,
				1
			);
			const bytes = length * 3 * Float64Array.BYTES_PER_ELEMENT;
			const cumulativeP = new Float64Array(new SharedArrayBuffer(bytes));
			const data = new Float64Array(
				memory.buffer,
				ptr + Float64Array.BYTES_PER_ELEMENT * 2,
				length * 3
			);
			for(let i = 0; i < length * 3; ++ i) {
				cumulativeP[i] = data[i];
			}
			return {
				cumulativeP,
				totalP,
			};
		}

		function writeCumulativeMap(cumulativeP) {
			const length = Math.floor(cumulativeP.length / 3);
			instance.exports._reset_cprobability_map(length);
			const ptr = instance.exports._get_cprobability_data_origin();
			const data = new Float64Array(memory.buffer, ptr, length * 3);
			for(let i = 0; i < length * 3; ++ i) {
				data[i] = cumulativeP[i];
			}
		}

		return {
			calculate_cprobability_map: (
				prizes,
				tickets,
				pCutoff
			) => {
				instance.exports._reset_prizes();
				for(const prize of prizes) {
					instance.exports._add_prize(prize.count, prize.value);
				}
				const ptr = instance.exports._calculate_cprobability_map(
					tickets,
					pCutoff
				);
				return readCumulativeMap(ptr);
			},
			pow_cprobability_map: (
				cumulativeP,
				power,
				pCutoff
			) => {
				writeCumulativeMap(cumulativeP);
				const ptr = instance.exports._pow_cprobability(
					power,
					pCutoff
				);
				return readCumulativeMap(ptr);
			},
		};
	}

	if(typeof fetch !== 'function') {
		const fs = require('fs');
		// eslint-disable-next-line no-sync
		const bytes = fs.readFileSync('./wasm/dist/main.wasm');
		return WebAssembly.instantiate(bytes, importObject).then(handleLoaded);
	}

	const request = fetch('../wasm/dist/main.wasm');
	if(WebAssembly.instantiateStreaming) {
		return WebAssembly
			.instantiateStreaming(request, importObject)
			.then(handleLoaded);
	} else {
		return request
			.then((res) => res.arrayBuffer())
			.then((bytes) => WebAssembly.instantiate(bytes, importObject))
			.then(handleLoaded);
	}
}

const prep = loadWASM().then(({
	calculate_cprobability_map,
	pow_cprobability_map,
}) => {
	const post = {fn: () => null};
	let perf_now = () => 0;

	const LEVEL = {
		aggregate: 999,
		debug: 1,
		info: 2,
		none: 4,
	};

	const profilingLevel = LEVEL.none;
	const aggs = {};

	function send_profiling(name, millis, level, group) {
		if(profilingLevel === LEVEL.aggregate && group) {
			let o = aggs[group];
			if(!o) {
				o = { n: 0, v: 0 };
				aggs[group] = o;
			}
			o.v += millis;
			if((++ o.n) >= 20) {
				const avgMs = o.v / o.n;
				post.fn({
					message: `${(avgMs * 0.001).toFixed(4)}s : avg. ${group}`,
					type: 'info',
				});
				o.n = 0;
				o.v = 0;
			}
		} else if(level >= profilingLevel) {
			post.fn({
				message: `${(millis * 0.001).toFixed(4)}s : ${name}`,
				type: 'info',
			});
		}
	}

	function make_shared_float_array(length) {
		const bytes = length * Float64Array.BYTES_PER_ELEMENT;
		return new Float64Array(new SharedArrayBuffer(bytes));
	}

	// Share temporary objects to reduce GC activity
	const sharedMaps = (() => {
		const maps = [];

		return {
			get: () => {
				if(maps.length > 0) {
					return maps.pop();
				} else {
					return new Map();
				}
			},
			put: (map) => {
				map.clear();
				maps.push(map);
			},
		};
	})();

	function accumulate(map, key, value) {
		const existing = map.get(key) || 0;
		map.set(key, existing + value);
	}

	const VALUE_SORT = ([v1], [v2]) => (v1 - v2);

	function extract_cumulative_probability(pMap, pCutoff) {
		const CP = 0;
		const P = 1;
		const VALUE = 2;

		const data = Array.from(pMap.entries())
			.filter((entry) => (entry[1] > pCutoff))
			.sort(VALUE_SORT);

		let totalP = 0;
		const cumulativeP = make_shared_float_array(data.length * 3);
		for(let i = 0; i < data.length; ++ i) {
			totalP += data[i][1];
			cumulativeP[i * 3 + CP] = totalP;
		}

		// Normalise to [0 1] to correct for numeric errors
		for(let i = 0; i < data.length; ++ i) {
			const x = i * 3;
			const [value, p] = data[i];
			cumulativeP[x + CP] /= totalP;
			cumulativeP[x + P] = p / totalP;
			cumulativeP[x + VALUE] = value;
		}

		return {cumulativeP, totalP};
	}

	function compound(parts, pCutoff) {
		const P = 1;
		const VALUE = 2;

		const pMap = sharedMaps.get();

		for(const {p, r, value} of parts) {
			for(let i = 0; i < r.length; i += 3) {
				const newP = p * r[i + P];
				if(newP > pCutoff) {
					accumulate(pMap, value + r[i + VALUE], newP);
				}
			}
		}

		return pMap;
	}

	function message_handler_generate({prizes, tickets, pCutoff}) {
		return calculate_cprobability_map(prizes, tickets, pCutoff);
	}

	function message_handler_pow({cumulativeP, power, pCutoff}) {
		return pow_cprobability_map(cumulativeP, power, pCutoff);
	}

	function message_handler_compound({parts, pCutoff}) {
		const pMap = compound(parts, pCutoff);
		const result = extract_cumulative_probability(pMap, pCutoff);
		sharedMaps.put(pMap);
		return result;
	}

	function message_handler(data) {
		const tB = perf_now();
		let result = null;
		let label = data.type;

		switch(data.type) {
		case 'generate':
			result = message_handler_generate(data);
			label += ` ${data.tickets}`;
			break;
		case 'pow':
			result = message_handler_pow(data);
			label += ` ${data.power}`;
			break;
		case 'compound':
			result = message_handler_compound(data);
			break;
		}

		const tE = perf_now();
		send_profiling(`Total for ${label}`, tE - tB, LEVEL.info, data.type);

		return {
			result: {
				cumulativeP: result.cumulativeP,
				normalisation: result.totalP,
				type: 'result',
			},
			transfer: [],
		};
	}

	function message_listener({data}) {
		const {result, transfer} = message_handler(data);
		post.fn(result, transfer);
	}

	// Class exists only for testing
	class SynchronousEngine {
		static queue_task(trigger) {
			return new Promise((resolve) => {
				resolve(message_handler(trigger).result);
			});
		}
	}

	function install_worker() {
		if(typeof self !== 'undefined') {
			if(self.performance) {
				perf_now = () => self.performance.now();
			}
			post.fn = (msg, transfer) => self.postMessage(msg, transfer);
			self.addEventListener('message', message_listener);
			self.postMessage({type: 'loaded'});
		}
	}

	install_worker();

	return {
		SynchronousEngine,
		extract_cumulative_probability,
		message_listener,
		post,
	};
});

if(typeof module === 'object') {
	module.exports = prep;
}
