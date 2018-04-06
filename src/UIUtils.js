'use strict';

(() => {
	function block(e) {
		e.preventDefault();
	}
	function stopProp(e) {
		e.stopPropagation();
	}

	const NON_PASSIVE = {passive: false};

	class UIUtils {
		static make_text(text = '') {
			return document.createTextNode(text);
		}

		static set_attributes(target, attrs) {
			for(const k in attrs) {
				if(Object.prototype.hasOwnProperty.call(attrs, k)) {
					target.setAttribute(k, attrs[k]);
				}
			}
		}

		static make(type, attrs = {}, children = []) {
			const o = document.createElement(type);
			UIUtils.set_attributes(o, attrs);
			for(const c of children) {
				if(typeof c === 'string') {
					o.appendChild(UIUtils.make_text(c));
				} else {
					o.appendChild(c);
				}
			}
			return o;
		}

		static select(element) {
			const range = document.createRange();
			range.selectNodeContents(element);
			const selection = window.getSelection();
			selection.removeAllRanges();
			selection.addRange(range);
		}

		static make_formatter(opts, locale) {
			const fmt = new Intl.NumberFormat(locale, opts);
			return (value) => (
				(opts.pre || '')
				+ fmt.format(value)
				+ (opts.post || '')
			);
		}

		static currency_symbol(currency) {
			return UIUtils.make_formatter({
				currency,
				minimumFractionDigits: 0,
				style: 'currency',
			})(0).replace(/[0-9\-.,]/g, '');
		}

		static odds(p) {
			if(p >= 1) {
				return 'almost certain';
			} else if(p > 1 - 1e-4) {
				return 'very likely';
			} else if(p >= 0.01) {
				return UIUtils.fmtOddsPercent(p);
			} else if(p >= 1e-10) {
				return UIUtils.fmtOddsPer(1 / p);
			} else if(p > 0) {
				return 'negligible';
			} else {
				return '(near-)impossible';
			}
		}

		static make_table(data) {
			const body = data.slice();
			const head = [body.shift()];

			return UIUtils.make('table', {}, [
				UIUtils.make('thead', {}, head.map(
					(row) => UIUtils.make('tr', {}, row.map(
						(value) => UIUtils.make('th', {}, [String(value)])
					))
				)),
				UIUtils.make('tbody', {}, body.map(
					(row) => UIUtils.make('tr', {}, row.map(
						(value) => UIUtils.make('td', {}, [String(value)])
					))
				)),
			]);
		}

		static block_scroll(element) {
			element.addEventListener('wheel', block, NON_PASSIVE);
		}

		static unblock_scroll(element) {
			element.removeEventListener('wheel', block, NON_PASSIVE);
		}

		static show_popup(content) {
			const shade = UIUtils.make('div', {'class': 'shade'});
			const close = UIUtils.make('a', {'class': 'close', 'href': '#'});
			const inner = UIUtils.make('div', {'class': 'scroller'}, [content]);
			const hold = UIUtils.make('div', {'class': 'popup'}, [
				inner,
				close,
			]);

			function doClose(e) {
				e.preventDefault();
				UIUtils.unblock_scroll(shade);
				UIUtils.unblock_scroll(hold);
				inner.removeEventListener('wheel', stopProp, NON_PASSIVE);
				shade.removeEventListener('click', doClose);
				close.removeEventListener('click', doClose);
				document.body.removeChild(shade);
				document.body.removeChild(hold);
			}

			UIUtils.block_scroll(shade);
			UIUtils.block_scroll(hold);
			inner.addEventListener('wheel', stopProp, NON_PASSIVE);
			shade.addEventListener('click', doClose);
			close.addEventListener('click', doClose);

			document.body.appendChild(shade);
			document.body.appendChild(hold);
		}
	}

	UIUtils.fmtOddsPercent = UIUtils.make_formatter({
		maximumFractionDigits: 2,
		minimumFractionDigits: 2,
		style: 'percent',
	});

	UIUtils.fmtOddsPer = UIUtils.make_formatter({
		maximumFractionDigits: 0,
		pre: '1 in ',
	});

	UIUtils.res = window.devicePixelRatio || 1;
	window.devicePixelRatio = 1;

	if(typeof module === 'object') {
		module.exports = UIUtils;
	} else {
		window.UIUtils = UIUtils;
	}
})();
