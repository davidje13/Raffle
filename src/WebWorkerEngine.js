'use strict';

if(typeof require !== 'function') {
	window.require = (name) => window[name.replace('./', '')];
}

(() => {
	function find_last_binary(l, fn) {
		let p0 = 0;
		let p1 = l.length;
		while(p0 + 1 < p1) {
			const p = (p0 + p1) >> 1;
			if(fn(l[p])) {
				p0 = p;
			} else {
				p1 = p;
			}
		}
		return p0;
	}

	function worker_fn(callback) {
		return (event) => {
			switch(event.data.type) {
			case 'loaded':
				callback(false);
				break;
			case 'info':
				window.console.log(event.data.message);
				break;
			case 'result':
				callback(true, event.data);
				break;
			}
		};
	}

	class WebWorkerEngine {
		constructor({basePath = 'src'} = {}) {
			this.workerFilePath = `${basePath}/raffle_worker.js`;
		}

		queue_task(trigger, transfer) {
			return new Promise((resolve) => {
				const worker = new Worker(this.workerFilePath);
				worker.addEventListener('message', worker_fn((r, data) => {
					if(r) {
						worker.terminate();
						resolve(data);
					} else {
						worker.postMessage(trigger, transfer);
					}
				}));
			});
		}
	}

	class SharedWebWorkerEngine {
		constructor({basePath = 'src', workers = 4} = {}) {
			const workerFilePath = `${basePath}/raffle_worker.js`;

			this.queue = [];
			this.threads = [];
			for(let i = 0; i < workers; ++ i) {
				const thread = {
					reject: null,
					resolve: 1, // Initial loading marker
					run: ({reject, resolve, transfer, trigger}) => {
						thread.reject = reject;
						thread.resolve = resolve;
						thread.worker.postMessage(trigger, transfer);
					},
					worker: new Worker(workerFilePath),
				};
				thread.worker.addEventListener('message', worker_fn((r, d) => {
					const fn = thread.resolve;
					if(this.queue.length > 0) {
						thread.run(this.queue.shift());
					} else {
						thread.reject = null;
						thread.resolve = null;
					}
					if(r) {
						fn(d);
					}
				}));
				this.threads.push(thread);
			}
		}

		queue_task(trigger, transfer, priority) {
			return new Promise((resolve, reject) => {
				for(const thread of this.threads) {
					if(thread.resolve === null) {
						thread.run({reject, resolve, transfer, trigger});
						return;
					}
				}
				const o = {priority, reject, resolve, transfer, trigger};
				if(priority === 0) {
					this.queue.push(o);
				} else {
					const i = find_last_binary(
						this.queue,
						(x) => (x.priority >= priority)
					);
					this.queue.splice(i, 0, o);
				}
			});
		}

		terminate() {
			for(const {reject} of this.queue) {
				if(reject !== null) {
					reject('Terminated');
				}
			}
			this.queue.length = 0;

			for(const thread of this.threads) {
				if(thread.reject !== null) {
					thread.reject('Terminated');
					thread.reject = null;
					thread.resolve = null;
					thread.worker.terminate();
				}
			}
			this.threads.length = 0;
		}
	}

	const exports = {
		SharedWebWorkerEngine,
		WebWorkerEngine,
	};

	if(typeof module === 'object') {
		module.exports = exports;
	} else {
		Object.assign(WebWorkerEngine, exports);
		Object.assign(window, exports);
	}
})();
