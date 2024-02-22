"use strict";
window.lastDraw = 0;
window.averageFrameTime = 0;
window.frames = 0;
import './oneCanvas.js';

window.fileUpload = document.createElement('input');
window.fileUpload.setAttribute('type', 'file');
window.fileUpload.setAttribute('accept', 'image/jpeg, image/jpg, image/png, image/webp, image/gif, image/svg+xml, image/jxl');
window.fileUpload.onchange = (e) => { background.set(e.target.files[0]) };

window.addAnimation = (() => {
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
		if (!queue.length)
			return active = false;
		requestAnimationFrame(animate);
	}
	return (length, task, cleanup = null) => {
		queue.push({ end : performance.now() + length, task, cleanup });
		if (active) return;
		active = true;
		animate();
	}
})();

window.surfaces = new Array();
window.onresize = () => {
	updateBackground();
	addAnimation(0, updateSurfaces)
};

document.body.className = 'overview';
document.body.depth = 1.0;

document.body.appendChild((() => {
	const obj   = Object.assign(document.createElement('ul'), {id:'panel'});
	const left  = obj.appendChild(document.createElement('li'));
	const cent  = obj.appendChild(document.createElement('li'));
	const right = obj.appendChild(document.createElement('li'));
	left.appendChild((() => {
			const obj = Object.assign(document.createElement('button'), {id: 'overview-toggle'});
			obj.appendChild(document.createElement('div'));
			obj.appendChild(document.createElement('div'));
			obj.onclick = () => {
				if (document.body.classList.contains('app-grid'))
					document.body.classList.remove('overview', 'app-grid');
				else {
					document.body.classList.toggle('overview');
					document.body.classList.remove('app-grid');
				}
			};
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
	return obj;
})());

const workarea = document.body.appendChild(Object.assign(document.createElement('main'), {id : 'workarea'}));

workarea.appendChild((() => {
	const icon = Object.assign(document.createElement('p'), { innerHTML : '<svg><use href="img/icons.svg#search"/></svg>'});
	const bar = icon.appendChild(document.createElement('input'));
	bar.setAttribute('type', 'text');
	bar.setAttribute('placeholder', 'Type to search');
	const obj = Object.assign(document.createElement('label'), { id : 'search', depth: 1.1});
	obj.appendChild(icon);
	return obj;
})());

workarea.appendChild((()=> {
	const obj =  workarea.appendChild(Object.assign(document.createElement('div'), { id:'app-grid'} ));
	obj.appendChild(addAppList([
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
	]));
	return obj;
})());

workarea.appendChild((() => {
	const obj = Object.assign(document.createElement('div'), {id: 'dash', className: 'hidden', depth: 1.1, mask: true});
	obj.appendChild(addAppList( [
		['Files','Nautilus', true],
		['Software','Software', false],
		['Settings','Settings', false]
	], true));
	obj.innerHTML += `<div id="show-apps-toggle" class="app"><svg viewbox="0 0 16 16"><use href="img/icons.svg#show-apps"/></svg><p class="name">Show Apps</p></div>`;
	obj.lastChild.onclick = () => {
		document.body.classList.toggle('app-grid');
	};
	return obj;
})());

workarea.appendChild((() => {
	const obj = Object.assign(document.createElement('div'), { id: 'workspaces'});
	for (let i = 0; i < 2; i++)
		obj.innerHTML += '<svg class="workspace"><use href="#background"/></svg>';
	obj.ondragover = (e) => {
		e.preventDefault();
	};
	obj.ondrop = (e) => {
		e.preventDefault();
		background.set(e.dataTransfer.items[0].getAsFile());
	};
	return obj;
})());

document.body.appendChild((()=> {
	function addToggle(name, type="checkbox") {
		const toggle = toggles.appendChild(document.createElement('input'));
		toggle.setAttribute('name', name);
		toggle.setAttribute('type', type);
		return toggle;
	}
	const obj = Object.assign(document.createElement('form'), {id :'quick-settings', className: 'dropdown', depth: 1.5, mask: true});
	obj.innerHTML = `<ul id="user-area"><li></li><li></li><li></li><li></li></ul>
		<div id="audio-main">
			<div class="volume-slider">
				<input type="range" min="1" max="100" value="40"/>
			</div>
		</div>`;
	const toggles = obj.appendChild(Object.assign(document.createElement('div'), {id: 'toggles'}));
	window.wired  = addToggle('Wired');
	window.wifi   = addToggle('Wi-Fi');
	window.blue   = addToggle('Bluetooth');
	window.power  = addToggle('Power Saver');
	window.theme  = addToggle('Dark Mode');
	theme.set = () => {
		document.body.id = (theme.checked ? 'dark' : 'light') + "-mode";
		addAnimation(300, updateBrightness);
	}
	theme.onchange = theme.set;
	background.upload = addToggle('Upload Image', 'button');
	background.upload.onclick = () => {
		window.fileUpload.click();
	};
	return obj;
})());

(async () => {
	const scheme = matchMedia('(prefers-color-scheme: dark)');
	scheme.onchange = (e)=> {
		theme.checked = e.target.matches;
		theme.set();
	};
	scheme.dispatchEvent(new Event('change'));
	getSurfaces(document.body);
	updateSurfaces();
	surfaces.sort((a,b) => a.depth - b.depth);
	const image = await fetch('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQvOY1r/+BiOh/AAA=')
	.then(res  => res.blob())
	.then(blob => blob);
	background.set(image);
})();

function addAppList(apps, hidden = false) {
	const obj = Object.assign(document.createElement('ul'), {className: 'app-list'});
	if (hidden)
		obj.classList.add('hidden');
	for (let i = 0; i < apps.length; i++)
		obj.innerHTML += `<li class="app${(apps[i][2] ? ` open` : ``)}" ><img src="apps/org.gnome.${apps[i][1]}.svg"/><h2 class="name">${apps[i][0]}</h2></li>`;
	return obj;
}

window.getBrightness = (obj) => {
	const val = (getComputedStyle(obj).getPropertyValue("background-color").split(', ')[1] | 0) / 255;
	const abs = Math.abs(val);
	return Math.cbrt((abs >= 0.04045) ? ((val >= 0) - (val < 0)) * Math.pow((abs + 0.055) / 1.055, 2.2) : val / 12.92);
}