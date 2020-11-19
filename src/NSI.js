'use strict';

(() => {
	// Thanks, https://github.com/Rob--W/cors-anywhere/
	const cors_proxy_url = 'https://cors-anywhere.herokuapp.com/';

	const nsi_prize_url = 'https://www.nsandi.com/get-to-know-us/monthly-prize-allocation';
	const nsi_prize_selector = (
		'//h3[contains(text(),"Prize draw details")]/..//table/tbody/tr'
	);

	function parseDOM(code) {
		return new DOMParser().parseFromString(code, 'text/html');
	}

	function request_crossdomain(url) {
		return fetch(cors_proxy_url + url, {
			credentials: 'omit',
			mode: 'cors',
		});
	}

	function parse_number(value) {
		const cleaned = value
			.replace('million', '000000')
			.replace(/[^0-9]/g, '');
		return Number.parseInt(cleaned, 10);
	}

	function load_prizes() {
		return request_crossdomain(nsi_prize_url)
			.then((response) => response.text())
			.then(parseDOM)
			.then((xml) => {
				const prizes = xml.evaluate(
					nsi_prize_selector,
					xml,
					null,
					XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
					null
				);

				let row = null;
				const prizesLast = [];
				const prizesNext = [];
				while((row = prizes.iterateNext())) {
					const cells = row.getElementsByTagName('td');
					const value = parse_number(cells[1].textContent);
					if(!value) {
						continue;
					}
					const qtyLast = parse_number(cells[2].textContent);
					const qtyNext = parse_number(cells[3].textContent);
					prizesLast.push({count: qtyLast, value});
					prizesNext.push({count: qtyNext, value});
				}
				return {
					prizesLast: prizesLast.length > 0 ? prizesLast : null,
					prizesNext: prizesNext.length > 0 ? prizesNext : null,
				};
			});
	}

	class NSI {
		constructor(prizes, {
			audienceMultiplier = null,
			audience = null,
		} = {}) {
			this.ps = prizes;
			this.m = audience;
			this.mult = audienceMultiplier;
		}

		prizes() {
			return this.ps;
		}

		audience() {
			if(this.m !== null) {
				return this.m;
			}
			if(this.mult !== null) {
				return this.ps.reduce((a, {count}) => a + count, 0) * this.mult;
			}
			return null;
		}
	}

	NSI.load = () => load_prizes().then(({prizesLast, prizesNext}) => ({
		last: prizesLast && new NSI(prizesLast, {audienceMultiplier: 34500}),
		next: prizesNext && new NSI(prizesNext, {audienceMultiplier: 34500}),
	}));

	if(typeof module === 'object') {
		module.exports = NSI;
	} else {
		window.NSI = NSI;
	}
})();
