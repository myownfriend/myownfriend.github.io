"use strict";
import './common.js';
import './separateCanvases.js';

const analyst = new Worker('./js/median_cut.js');

const addAnimationJob = (() => {
	const queue = new Array();
	let  active = false;
	function refresh(timestamp) {
		let redraw = false;
		for (let a = 0; a < queue.length; a++) {
			switch (queue[a].type) {
				case 'theme' :
					updateBrightness();
					redraw = true;
					break;
				case 'background':
					updateBackground(queue[a], timestamp);
					updateSurfaces();
					redraw = true;
					break;
				case 'viewport':
					updateSurfaces(true);
				case 'redraw':
					redraw = true;
			}
			if (queue[a].end < window.performance.now()) {
				queue.splice(a, 1);
				a--;
			}
		}
		if (redraw)
			draw();
		if (!queue.length)
			return active = false;
		window.requestAnimationFrame(refresh);
	}
	return (length, task) => {
		const time = performance.now();
		queue.push({
			start : time,
			type  : task,
			time  : length,
			end   : time + length,
		});
		if (active)
			return;
		active = true;
		window.requestAnimationFrame(refresh);
	}
})()

window.setTheme = (dark) => {
	quick_settings.theme(dark);
	document.body.id = (dark ? 'dark' : 'light') + "-mode";
	addAnimationJob(300, 'theme')
}

window.changeView = () => {
	if (document.body.classList.contains('app-grid')) {
		document.body.classList.remove('overview', 'app-grid');
	} else {
		document.body.classList.toggle('overview');
		document.body.classList.remove('app-grid');
	}
}

window.addEventListener('resize', () => { addAnimationJob(0, 'viewport') });

window.setBackground = (() => {
	return (file) => {
		if (!support.filetypes.includes(file.type))
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
			addAnimationJob(300, 'background');
		};
	}
})();