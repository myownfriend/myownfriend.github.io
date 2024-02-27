"use strict";
import './canvas.js';

const scene_graph = document.body.appendChild(Object.assign(document.createElement('section'), {
	id : "sceneGraph",
	className : 'overview',
	depth : 1.0,
	update : drawSelf,
}));

scene_graph.appendChild((() => {
	const obj   = Object.assign(document.createElement('ul'), {
		id:'panel',
		depth : 1.1,
	});
	const left  = obj.appendChild(document.createElement('li'));
	const cent  = obj.appendChild(document.createElement('li'));
	const right = obj.appendChild(document.createElement('li'));
	left.appendChild((() => {
			const obj = Object.assign(document.createElement('button'), {
				id: 'overview-toggle',
				update : drawSelf,
			});
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
	cent.appendChild(Object.assign(document.createElement('button'), {
		id: 'clock',
		update : drawSelf,
		innerHTML : 'Thu Nov 25  2:15 AM'}
	));
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
		return Object.assign(document.createElement('button'), {
			id: 'system-status-area',
			innerHTML : text,
			update : drawSelf,
		})
	})())
	return obj;
})());

const workarea = scene_graph.appendChild(Object.assign(document.createElement('main'), {
	id : 'workarea',
	depth : 1.1,
}));

workarea.appendChild((() => {
	const obj = Object.assign(document.createElement('label'), {
		id : 'search',
		update : drawSelf,
	});
	const bar = obj.appendChild(document.createElement('input'));
	const p   = obj.appendChild(document.createElement('p'));
	bar.setAttribute('type', 'text');
	bar.setAttribute('placeholder', 'Type to search');
	p.innerHTML += '<svg><use href="img/icons.svg#search"/></svg>';
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
		id: 'dash',
		className: 'hidden',
		update : drawSelf,
	});
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
		obj.innerHTML += '<svg><use href="#background"/></svg>';
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
		label.update = drawSelf;
		const toggle = label.appendChild(document.createElement('input'));
		const word   = label.appendChild(document.createElement('h3'));
		word.innerHTML = `<svg><use href="img/icons.svg#${name.toLowerCase().replace(/\s+/g, "-")}"/></svg>${name}`;
		toggle.setAttribute('type', type);
		return label;
	}
	const obj = Object.assign(document.createElement('form'), {
		id :'quick-settings',
		className: 'dropdown',
		depth: 1.2,
		update : drawSelf,
	});
	obj.mask = createMask(obj);
	const userarea = obj.appendChild(Object.assign(document.createElement('ul'), {id: 'user-area'}));
	for (let i = 0; i < 4; i++) {
		userarea.appendChild(Object.assign(document.createElement('li'), {
			update : drawSelf,
		}));
	}
	const audio_area = obj.appendChild(Object.assign(document.createElement('div'), {id : 'audio-main'}))
	const volume = audio_area.appendChild(Object.assign(document.createElement('div'), {className : 'volume-slider'}));
	const track = volume.appendChild(Object.assign(document.createElement('div'), {
		className : 'track',
		update : drawSelf,
	}));
	const range = volume.appendChild(document.createElement('input'));
	range.setAttribute('type', 'range');

	const toggles = obj.appendChild(Object.assign(document.createElement('div'), {id: 'toggles'}));
	window.wired  = addToggle('Wired');
	window.wifi   = addToggle('Wi-Fi');
	window.blue   = addToggle('Bluetooth');
	window.power  = addToggle('Power Saver',);
	window.theme  = addToggle('Dark Style').firstChild;

	theme.set = setTheme;
	theme.onchange = theme.set;

	background.upload = addToggle('Upload Image', 'file');
	background.upload.firstChild.setAttribute('accept', 'image/jpeg, image/jpg, image/png, image/webp, image/gif, image/svg+xml, image/jxl');
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
	theme.checked = localStorage.getItem('theme') ? localStorage.getItem('theme') == 'dark' : scheme.matches;
	theme.set();
})();

function addAppList(apps, hidden = false) {
	const obj = Object.assign(document.createElement('ul'), {className: 'app-list'});
	if (hidden)
		obj.classList.add('hidden');
	for (let i = 0; i < apps.length; i++)
		obj.innerHTML += `<li class="app${(apps[i][2] ? ` open` : ``)}" ><img src="apps/org.gnome.${apps[i][1]}.svg"/><h2 class="name">${apps[i][0]}</h2></li>`;
	return obj;
}