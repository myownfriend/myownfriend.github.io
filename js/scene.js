"use strict";
import {background, support} from './common.js';
import {
	getSurfaces,
	updateBackground,
	updateSurfaces,
	updateBrightness,
	draw } from './separateCanvases.js';

const analyst = new Worker('./js/median_cut.js');
const animations = {
	queue  : new Array(),
	active : false,
}

document.body.prepend(background);

function addAnimationJob(length, task) {
	const time = performance.now();
	animations.queue.push({
	   start : time,
	   type  : task,
	   time  : length,
	   end   : time + length,
	});
	if (animations.active)
		return;
	animations.active = true;
	window.requestAnimationFrame(refresh);

	function refresh(timestamp) {
		let redraw = false;
		for (let a = 0; a < animations.queue.length; a++) {
			switch (animations.queue[a].type) {
				case 'theme' :
					updateBrightness();
					redraw = true;
					break;
				case 'background':
					updateBackground(animations.queue[a], timestamp);
					updateSurfaces();
					redraw = true;
					break;
				case 'viewport':
					updateSurfaces(true);
				case 'redraw':
					redraw = true;
			}
			if (animations.queue[a].end < window.performance.now()) {
				animations.queue.splice(a, 1);
				a--;
			}
		}
		if (redraw) draw();
		if (!animations.queue.length)
			return animations.active = false;
		window.requestAnimationFrame(refresh);
	}
}

document.body.addEventListener('change', () => { addAnimationJob(300, 'theme') });

window.addEventListener('resize', () => { addAnimationJob(0, 'viewport') });

export async function createScene() {
	getSurfaces(document.body);
	const default_background = await fetch('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQvOY1r/+BiOh/AAA=')
	.then(res  => res.blob())
	.then(blob => blob);
	setBackground(default_background);
}

export function setBackground(file) {
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