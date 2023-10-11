"use strict";
import './oneCanvas.js';
/*
 Maybe try to refactor this with element.getAnimations()?
 Being able to see when the animation is finished would be nice.

 Also check out animate();
*/
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
		queue.push({ end : performance.now() + length, task, cleanup });
		if (active) return;
		active = true;
		requestAnimationFrame(animate);
	}
})()

window.surfaces = new Array();
window.addEventListener('resize', ()=> { addAnimation(0, updateSurfaces)});

document.body.className = 'overview';
document.body.depth = 1.0;

const svg = document.body.appendChild(Object.assign(document.createElementNS("http://www.w3.org/2000/svg", 'svg'), {id:"masks"}));
const defs = svg.appendChild(document.createElement('defs'));
svg.innerHTML = `<mask id="masking">
<rect fill="#fff" width="100%" height="100%"></rect>
<rect rx="36px" fill="#000" style="	x: calc(100vw - 10px - 420px); y: 6px; width: 420px; height: 311px;"></rect>
</mask>`;

window.background = document.body.appendChild(Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'symbol'), {
	id : 'background', old : null, current : null,
	set: (() => {
		const types = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
		const analyst = new Worker('./js/median_cut.js');
		return (file) => {
			if (!types.includes(file.type))
				return;
			const bg = document.createElementNS('http://www.w3.org/2000/svg', 'image')
			bg.image = new Image();
			bg.image.src = URL.createObjectURL(file);
			bg.image.addEventListener('load', () => {
				bg.aw = Math.max(1.0, bg.image.width  / bg.image.height);
				bg.ah = Math.max(1.0, bg.image.height / bg.image.width );
				bg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
				bg.setAttribute('href' , bg.image.src);
				bg.setAttribute('width', '100%');
				createImageBitmap(bg.image, {
					resizeWidth : bg.aw * 64,
					resizeHeight: bg.ah * 64,
				}).then((image) => {
					analyst.postMessage(image, [image]);
				});
			}, { once: true });
			analyst.onmessage = (e) => {
				bg.lighting = e.data.lights;
				background.old = background.current;
				background.current = bg;
				background.appendChild(bg);
				addAnimation(300, updateBackground, ()=> {
					if (background.children.length > 1) {
						URL.revokeObjectURL(background.old.image.src);
						background.old.remove();
						background.old = null;
					}
				});
			};
		}
	})()
}));

document.body.appendChild((() => {
	const obj   = Object.assign(document.createElement('ul'), {id:'panel'});
	const left  = obj.appendChild(document.createElement('li'));
	const cent  = obj.appendChild(document.createElement('li'));
	const right = obj.appendChild(document.createElement('li'));
	left.appendChild((() => {
			const obj = Object.assign(document.createElement('button'), {id: 'overview-toggle', innerHTML :'Activities'})
			obj.addEventListener('click', () => {
				if (document.body.classList.contains('app-grid'))
					document.body.classList.remove('overview', 'app-grid');
				else {
					document.body.classList.toggle('overview');
					document.body.classList.remove('app-grid');
				}
			});
			return obj;
	})());
	cent.appendChild(Object.assign(document.createElement('button'), { id: 'clock', innerHTML : 'Thu Nov 25  2:15 AM'}));
	right.appendChild((()=> {
		let text = '';
		for (const icon of [
			'night-light',
			'network-wireless-signal-excellent',
			'network-vpn',
			'microphone-sensitivity-high',
			'battery-charging'
		])
		text += `<svg><use href="img/icons.svg#${icon}"/></svg>`;
		return Object.assign(document.createElement('button'), {id: 'system-status-area', innerHTML : text})
	})())
	return obj
})());

const workarea = document.body.appendChild(Object.assign(document.createElement('main'), {id : 'workarea'}));

workarea.appendChild((() => {
	const icon = Object.assign(document.createElement('p'), { innerHTML : '<svg><use href="img/icons.svg#search"/></svg>'});
	const bar = icon.appendChild(document.createElement('input'));
	bar.setAttribute('type', 'text');
	bar.setAttribute('placeholder', 'Type to search');
	const obj = Object.assign(document.createElement('label'), { id : 'search', depth: 1.1});
	obj.appendChild(icon);
	return obj
})());

workarea.appendChild(Object.assign(addAppList([
	['Weather','Weather', false],
	['Maps', 'Maps', false],
	['Text Editor', 'TextEditor', false],
	['Cheese', 'Cheese', false],
	['Calculator', 'Calculator', false],
	['Boxes', 'Boxes', false],
	['Contacts', 'Contacts', false],
	['Disk Usage Analyzer', 'baobab', false],
	['Photos', 'Photos', false],
	['Tour', 'Tour', false]
]), { id:'app-grid'} ));

workarea.appendChild((() => {
	const obj = Object.assign(document.createElement('div'), {id: 'dash', className: 'hidden', depth: 1.1});
	obj.appendChild(addAppList( [
		['Files','Nautilus', true],
		['Software','Software', false],
		['Settings','Settings', false]
	], true));
	obj.innerHTML += `<div id="show-apps-toggle" class="app"><svg viewbox="0 0 16 16"><use href="img/icons.svg#show-apps"/></svg><p class="name">Show Apps</p></div>`;
	obj.lastChild.addEventListener('click', () => {
		document.body.classList.toggle('app-grid');
	});
	return obj;
})());

workarea.appendChild((() => {
	const obj = Object.assign(document.createElement('div'), { id: 'workspaces'});
	for (let i = 0; i < 2; i++)
		obj.innerHTML += '<svg class="workspace"><use href="#background"/></svg>';
	obj.addEventListener('dragover', (e) => {
		e.preventDefault();
	});
	obj.addEventListener('drop', (e) => {
		e.preventDefault();
		background.set(e.dataTransfer.items[0].getAsFile());
	})
	return obj;
})());

document.body.appendChild((()=> {
	function addToggle(name, type="checkbox") {
		return toggles.appendChild(Object.assign(document.createElement('label'), {innerHTML :`<input type="${type}"><h3>${name}</h3>`}));
	}
	const obj = Object.assign(document.createElement('form'), {id :'quick-settings', className: 'dropdown', depth: 1.5});
	const over = obj.appendChild(Object.assign(document.createElement('div'), {className: 'over-lights', innerHTML : `
		<ul id="user-area"><li></li><li></li><li></li><li></li></ul>
		<div id="audio-main">
			<div class="volume-slider">
				<input type="range" min="1" max="100" value="40"/>
			</div>
		</div>`}));
	const toggles = over.appendChild(Object.assign(document.createElement('div'), {id: 'toggles'}));
	window.wired  = addToggle('Wired');
	window.wifi   = addToggle('Wi-Fi');
	window.blue   = addToggle('Bluetooth');
	window.power  = addToggle('Power Saver');

	window.theme  = addToggle('Dark Mode').firstChild;
	theme.set = () => {
		document.body.id = (theme.checked ? 'dark' : 'light') + "-mode";
		addAnimation(300, updateBrightness);
	}
	theme.addEventListener('change', theme.set);

	background.upload = addToggle('Upload Image', 'file');
	background.upload.addEventListener('change', (e) => { background.set(e.target.files[0]) });
	return obj;
})());

(async () => {
	const scheme = matchMedia('(prefers-color-scheme: dark)');
	scheme.addEventListener('change', (e)=> {
		theme.checked = e.target.matches;
		theme.set();
	});
	scheme.dispatchEvent(new Event('change'));
	getSurfaces(document.body);
	const image = await fetch('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQvOY1r/+BiOh/AAA=')
	.then(res  => res.blob())
	.then(blob => blob);
	background.set(image);
})();

function addAppList(apps, hidden = false) {
	const applist = Object.assign(document.createElement('ul'), {className: 'app-list'});
	if (hidden)
		applist.classList.add('hidden');
	for (let i = 0; i < apps.length; i++)
		applist.innerHTML += `<li class="app${(apps[i][2] ? ` open` : ``)}" ><img src="apps/org.gnome.${apps[i][1]}.svg"/><h2 class="name">${apps[i][0]}</h2></li>`;
	return applist;
}

window.getBrightness = (() => {
	if ('CSS' in window && 'registerProperty' in CSS) {
	   CSS.registerProperty({
		   name: '--brightness',
		   syntax: '<number>',
		   inherits: true,
		   initialValue: 0.5,
	   });
	   return (obj) => {
		   return Number(getComputedStyle(obj).getPropertyValue('--brightness'));
	   }
   }
   return (obj) => {
	   const val = (getComputedStyle(obj).getPropertyValue("background-color").split(', ')[1] | 0) / 255;
	   const abs = Math.abs(val);
	   return Math.cbrt((abs >= 0.04045) ? ((val >= 0) - (val < 0)) * Math.pow((abs + 0.055) / 1.055, 2.2) : val / 12.92);
   }
})();