'use strict';

(() => {
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
