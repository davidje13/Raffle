'use strict';

(() => {
	class SharedPromise {
		constructor(promise) {
			this.state = 0;
			this.chained = [];
			this.v = null;

			const fullResolve = (v) => {
				this.v = v;
				this.state = 1;
				this.chained.forEach(({resolve}) => resolve(v));
				this.chained = null;
			};

			const fullReject = (v) => {
				this.v = v;
				this.state = 2;
				this.chained.forEach(({reject}) => reject(v));
				this.chained = null;
			};

			if(typeof promise === 'function') {
				promise(fullResolve, fullReject);
			} else {
				promise.then(fullResolve).catch(fullReject);
			}
		}

		promise() {
			return new Promise((resolve, reject) => {
				if(this.state === 1) {
					resolve(this.v);
				} else if(this.state === 2) {
					reject(this.v);
				} else {
					this.chained.push({reject, resolve});
				}
			});
		}

		static resolve(v) {
			return new SharedPromise(Promise.resolve(v));
		}

		static reject(v) {
			return new SharedPromise(Promise.reject(v));
		}
	}

	if(typeof module === 'object') {
		module.exports = SharedPromise;
	} else {
		window.SharedPromise = SharedPromise;
	}
})();
