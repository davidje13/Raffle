'use strict';

(() => {
	class RaffleSelectUI {
		constructor() {
			this.raffles = [];
			this.section = document.createElement('section');
			this.raffleSelect = document.createElement('select');
			this.section.appendChild(this.raffleSelect);
			this.raffleButtons = document.createElement('div');
			this.section.appendChild(this.raffleButtons);
			this.callback = () => null;

			this.raffleSelect.addEventListener('change', () => {
				const id = Number.parseInt(this.raffleSelect.value, 10);
				this.callback(this.raffles[id].raffle);
			});
		}

		add_loader(name, fn) {
			const btn = document.createElement('button');
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
			this.raffleButtons.appendChild(btn);
		}

		add(name, raffle) {
			const id = this.raffles.length;
			this.raffles.push({name, raffle});
			const opt = document.createElement('option');
			opt.textContent = name;
			opt.setAttribute('value', id);
			this.raffleSelect.appendChild(opt);
			return id;
		}

		select(id) {
			if(!this.raffles[id]) {
				throw new Error(`Invalid raffle id: ${id}`);
			}
			this.raffleSelect.value = id;
			this.callback(this.raffles[id].raffle);
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
