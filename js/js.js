"use strict";
import './canvas.js';

document.body.depth = 1.0;
const scene_graph = document.body.appendChild(Object.assign(document.createElement('main'), {
	id : "scene",
	className : 'overview',
	depth : 1.1,
	update : redraw,
}));

scene_graph.appendChild((() => {
	const obj   = Object.assign(document.createElement('ul'), {
		id :'panel',
	});
	const left  = obj.appendChild(document.createElement('li'));
	const cent  = obj.appendChild(document.createElement('li'));
	const right = obj.appendChild(document.createElement('li'));
	left.appendChild((() => {
			const obj = Object.assign(document.createElement('button'), {
				id: 'overview-toggle',
				update : redraw,
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
		update : redraw,
	}));
	const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	function updateClock() {
		const date = new Date();
		cent.innerHTML = `${weekday[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}
		                  <time>
						     ${date.getHours() % 12}:${date.getMinutes()} ${date.getHours() >= 12 ? 'P':'A'}M
						  </time>`;
	}
	updateClock();
	setInterval(updateClock, 1000 * 60);
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
			update : redraw,
		})
	})())
	return obj;
})());

scene_graph.appendChild((() => {
	const obj = Object.assign(document.createElement('label'), {
		id : 'search',
		update : redraw,
	});
	const bar = obj.appendChild(document.createElement('input'));
	const p   = obj.appendChild(document.createElement('p'));
	bar.setAttribute('type', 'text');
	bar.setAttribute('placeholder', 'Type to search');
	p.innerHTML += '<svg><use href="img/icons.svg#search"/></svg>';
	return obj;
})());

scene_graph.appendChild((()=> {
	const obj =  scene_graph.appendChild(Object.assign(document.createElement('div'), { id:'app-grid'} ));
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

scene_graph.appendChild((() => {
	const obj = Object.assign(document.createElement('div'), {
		id: 'dash',
		className: 'hidden',
		update : redraw,
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

scene_graph.appendChild((() => {
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

document.body.appendChild((()=> {
	function addToggle(name, type="checkbox") {
		const label  = toggles.appendChild(document.createElement('label'));
		label.update = redraw;
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
		update : redraw,
	});
	obj.mask = createMask(obj);
	const userarea = obj.appendChild(Object.assign(document.createElement('ul'), {id: 'user-area'}));
	for (let i = 0; i < 4; i++) {
		userarea.appendChild(Object.assign(document.createElement('li'), {
			update : redraw,
		}));
	}
	const audio_area = obj.appendChild(Object.assign(document.createElement('div'), {
		id : 'audio-main'
	}))
	const volume = audio_area.appendChild(Object.assign(document.createElement('div'), {
		className : 'volume-slider'
	}));
	const track = volume.appendChild(Object.assign(document.createElement('div'), {
		className : 'track',
		update : redraw,
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
	background.upload.firstChild.setAttribute('accept', 'image/jpeg, image/jpg, image/png, image/webp, image/gif, image/svg+xml');
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

	updateSizes();
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