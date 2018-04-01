'use strict';

(() => {
	const {UIUtils} = window;
	const {make} = UIUtils;

	class RaffleSelectUI {
		constructor({currencyCode}) {
			this.fmtMoney = UIUtils.make_formatter({
				currency: currencyCode,
				minimumFractionDigits: 0,
				style: 'currency',
			});
			this.fmtCount = UIUtils.make_formatter({pre: '\u00D7 '});

			this.raffles = [];

			this.selector = make('select');
			this.preview = make('ul', {'class': 'preview'});
			this.buttons = make('div');

			this.section = make('section', {'class': 'raffle_select'}, [
				this.selector,
				this.preview,
				this.buttons,
			]);

			this.callback = () => null;

			this.selector.addEventListener('change', () => {
				const id = Number.parseInt(this.selector.value, 10);
				this.update_selection(this.raffles[id].raffle);
			});
		}

		update_selection(raffle) {
			this.preview.textContent = '';
			const prizes = raffle.prizes().sort((a, b) => (b.value - a.value));
			for(const {value, count} of prizes) {
				this.preview.appendChild(make('li', {}, [
					make('span', {'class': 'value'}, [this.fmtMoney(value)]),
					make('span', {'class': 'count'}, [this.fmtCount(count)]),
				]));
			}
			this.callback(raffle);
		}

		add_loader(name, fn) {
			const btn = make('button');
			btn.textContent = name;
			let loaded = false;
			btn.addEventListener('click', () => {
				if(loaded) {
					return;
				}
				loaded = true;
				btn.setAttribute('disabled', true);
				btn.textContent = 'Loading\u2026';
				fn()
					.then(() => {
						btn.textContent = 'Loaded';
					})
					.catch((e) => {
						window.console.warn('Failed to load raffle', e);
						btn.setAttribute('disabled', false);
						btn.textContent = name;
						loaded = false;
					});
			});
			this.buttons.appendChild(btn);
		}

		add(name, raffle) {
			const id = this.raffles.length;
			this.raffles.push({name, raffle});
			this.selector.appendChild(make('option', {'value': id}, [name]));
			return id;
		}

		select(id) {
			if(!this.raffles[id]) {
				throw new Error(`Invalid raffle id: ${id}`);
			}
			this.selector.value = id;
			this.update_selection(this.raffles[id].raffle);
		}

		set_callback(fn) {
			this.callback = fn;
		}

		dom() {
			return this.section;
		}
	}

	if(typeof module === 'object') {
		module.exports = RaffleSelectUI;
	} else {
		window.RaffleSelectUI = RaffleSelectUI;
	}
})();
