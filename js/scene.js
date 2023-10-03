"use strict";
import './separateCanvases.js';

const addAnimationJob = (() => {
	const queue = new Array();
	let  active = false;
	function animate(timestamp) {
		for (let a = 0; a < queue.length; a++) {
			queue[a].task();
			if (queue[a].end < window.performance.now()) {
				if (queue[a].cleanup)
					queue[a].cleanup();
				queue.splice(a, 1);
				a--;
			}
		}
		draw();
		if (!queue.length)
			return active = false;
		window.requestAnimationFrame(animate);
	}
	return (length, task, cleanup = null) => {
		const time = performance.now();
		queue.push((() => {
			const start = time;
			return {
				task,
				end : start + length,
				cleanup
			}
		})())
		if (active)
			return;
		active = true;
		window.requestAnimationFrame(animate);
	}
})()

window.addEventListener('resize', () => {
	addAnimationJob(0, () => {
	updateSurfaces(true);
})});

window.setTheme = (dark) => {
	quick_settings.theme(dark);
	document.body.id = (dark ? 'dark' : 'light') + "-mode";
	addAnimationJob(300, () => {
		updateBrightness();
	});
}

window.background = document.body.appendChild(Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'symbol'), {
	id      : 'background',
	old     : null,
	current : null,
}));

window.surfaces = new Array();

window.filetypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

window.getBrightness = (()=> {
	if ('CSS' in window && 'registerProperty' in CSS) {
		window.CSS.registerProperty({
			name: '--brightness',
			syntax: '<number>',
			inherits: false,
			initialValue: 0.5,
		});
		return (obj) => {
			return obj.computedStyleMap().get('--brightness');
		}
	}
	return (obj) => {
		const val = (window.getComputedStyle(obj).getPropertyValue("background-color").split(', ')[1] | 0) / 255;
		const abs = Math.abs(val);
		return Math.cbrt((abs >= 0.04045) ? (val < 0 ? -1 : 1) * Math.pow((abs + 0.055) / 1.055, 2.2) : val / 12.92);
	}
})();

window.changeView = () => {
	if (document.body.classList.contains('app-grid')) {
		document.body.classList.remove('overview', 'app-grid');
	} else {
		document.body.classList.toggle('overview');
		document.body.classList.remove('app-grid');
	}
}

window.setBackground = (() => {
	const analyst = new Worker('./js/median_cut.js');
	return (file) => {
		if (!filetypes.includes(file.type))
			return;
		const newbg = Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'image'), {
			image : new Image()
		});
		newbg.image.src = URL.createObjectURL(file);
		newbg.image.addEventListener('load', () => {
			newbg.aspectWidth  = Math.max(1.0, newbg.image.width  / newbg.image.height);
			newbg.aspectHeight = Math.max(1.0, newbg.image.height / newbg.image.width );
			newbg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
			newbg.setAttribute('href'  , newbg.image.src);
			newbg.setAttribute('width' , '100%');
			createImageBitmap(newbg.image, {
				resizeWidth : newbg.aspectWidth  * 64,
				resizeHeight: newbg.aspectHeight * 64,
			}).then((image) => {
				analyst.postMessage(image, [image]);
			});
		}, { once: true });
		analyst.onmessage = (e) => {
			newbg.lighting = e.data.lights;
			background.old = background.current;
			background.current = newbg;
			background.appendChild(newbg);
			addAnimationJob(300, ()=> {
				updateBackground();
				updateSurfaces();
			}, ()=> {
				if (background.children.length > 1) {
					URL.revokeObjectURL(background.old.image.src);
					background.old.remove();
					background.old = null;
				}
			});
		};
	}
})();