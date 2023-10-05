"use strict";
import './separateCanvases.js';

console.log(devicePixelRatio)

const addAnimation = (() => {
	const queue = new Array();
	let  active = false;
	function animate() {
		for (let i = 0; i < queue.length; i++) {
			queue[i].task();
			if (queue[i].end < performance.now()) {
				if (queue[i].cleanup)
					queue[i].cleanup();
				queue.splice(i, 1);
				i--;
			}
		}
		draw();
		if (!queue.length) return active = false;
		requestAnimationFrame(animate);
	}
	return (length, task, cleanup = null) => {
		queue.push({
			end : performance.now() + length,
			task, cleanup
		});
		if (active) return;
		active = true;
		requestAnimationFrame(animate);
	}
})()

window.addEventListener('resize', () => { addAnimation(0, updateSurfaces)});

window.setTheme = (dark) => {
	quick_settings.theme(dark);
	document.body.id = (dark ? 'dark' : 'light') + "-mode";
	addAnimation(300, updateBrightness);
}

window.changeView = () => {
	if (document.body.classList.contains('app-grid')) {
		document.body.classList.remove('overview', 'app-grid');
	} else {
		document.body.classList.toggle('overview');
		document.body.classList.remove('app-grid');
	}
}

window.background = document.body.appendChild(Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'symbol'), {
	id      : 'background',
	old     : null,
	current : null,
}));

window.setBackground = (() => {
	const filetypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
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
			addAnimation(300, updateBackground, ()=> {
				if (background.children.length > 1) {
					URL.revokeObjectURL(background.old.image.src);
					background.old.remove();
					background.old = null;
				}
			});
		};
	}
})();

window.surfaces = new Array();

window.getBrightness = (() => {
	if ('CSS' in window && 'registerProperty' in CSS) {
		CSS.registerProperty({
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
		const val = (getComputedStyle(obj).getPropertyValue("background-color").split(', ')[1] | 0) / 255;
		const abs = Math.abs(val);
		return Math.cbrt((abs >= 0.04045) ? (val < 0 ? -1 : 1) * Math.pow((abs + 0.055) / 1.055, 2.2) : val / 12.92);
	}
})();