"use strict";
import './oneCanvas.js';

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
		update(scene_graph);
		if (!queue.length)
			return active = false;
		requestAnimationFrame(animate);
	}
	return (length, task, cleanup = null) => {
		queue.push({ end : performance.now() + length, task, cleanup });
		if (active)
			return;
		active = true;
		animate();
	}
})();

window.onresize = () => {
	updateBackground();
	update(scene_graph);
};

const scene_graph = document.body.appendChild(Object.assign(document.createElement('section'), {
	id : "sceneGraph",
	depth : 1.0,
}));
scene_graph.className = 'overview';

scene_graph.appendChild((() => {
	const obj   = Object.assign(document.createElement('ul'), {id:'panel'});
	const left  = obj.appendChild(document.createElement('li'));
	const cent  = obj.appendChild(document.createElement('li'));
	const right = obj.appendChild(document.createElement('li'));
	left.appendChild((() => {
			const obj = Object.assign(document.createElement('button'), {id: 'overview-toggle'});
			obj.appendChild(document.createElement('div'));
			obj.appendChild(document.createElement('div'));
			obj.onclick = () => {
				if (scene_graph.classList.contains('app-grid'))
					scene_graph.classList.remove('overview', 'app-grid');
				else {
					scene_graph.classList.toggle('overview');
					scene_graph.classList.remove('app-grid');
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

const workarea = scene_graph.appendChild(Object.assign(document.createElement('main'), {id : 'workarea'}));

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
	const obj = Object.assign(document.createElement('div'), {
		id: 'dash', className: 'hidden', depth: 1.1});
	obj.mask = createMask(obj);
	obj.appendChild(addAppList( [
		['Files','Nautilus', true],
		['Software','Software', false],
		['Settings','Settings', false]
	], true));
	obj.innerHTML += `<div id="show-apps-toggle" class="app"><svg viewbox="0 0 16 16"><use href="img/icons.svg#show-apps"/></svg><p class="name">Show Apps</p></div>`;
	obj.lastChild.onclick = () => {
		scene_graph.classList.toggle('app-grid');
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

scene_graph.appendChild((()=> {
	function addToggle(name, type="checkbox") {
		const label  = toggles.appendChild(document.createElement('label'));
		const toggle = label.appendChild(document.createElement('input'));
		const word   = label.appendChild(document.createElement('h3'));
		word.innerHTML = `<svg><use href="img/icons.svg#${name.toLowerCase().replace(/\s+/g, "-")}"/></svg>${name}`;
		toggle.setAttribute('type', type);
		return label;
	}
	const obj = Object.assign(document.createElement('form'), {
		id :'quick-settings', className: 'dropdown', depth: 1.5,
	});
	obj.mask = createMask(obj);
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
	window.power  = addToggle('Power Saver',);
	window.theme  = addToggle('Dark Mode').firstChild;
	theme.set = () => {
		document.body.id = (theme.checked ? 'dark' : 'light') + "-mode";
		addAnimation(300, () => {
			update(scene_graph);
		});
	}
	theme.onchange = theme.set;
	background.upload = addToggle('Upload Image', 'file');
	background.upload.setAttribute('accept', 'image/jpeg, image/jpg, image/png, image/webp, image/gif, image/svg+xml, image/jxl');
	background.upload.onchange = (e) => {
		background.set(e.target.files[0])
	}
	return obj;
})());

(async () => {
	const scheme = matchMedia('(prefers-color-scheme: dark)');
	const image = await fetch('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQvOY1r/+BiOh/AAA=')
	.then(res  => res.blob())
	.then(blob => blob);
	background.set(image);
	scheme.onchange = (e)=> {
		theme.checked = e.target.matches;
		theme.set();
	};
	scheme.dispatchEvent(new Event('change'));
})();

function addAppList(apps, hidden = false) {
	const obj = Object.assign(document.createElement('ul'), {className: 'app-list'});
	if (hidden)
		obj.classList.add('hidden');
	for (let i = 0; i < apps.length; i++)
		obj.innerHTML += `<li class="app${(apps[i][2] ? ` open` : ``)}" ><img src="apps/org.gnome.${apps[i][1]}.svg"/><h2 class="name">${apps[i][0]}</h2></li>`;
	return obj;
}