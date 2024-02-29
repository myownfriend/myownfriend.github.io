"use strict";
import './canvas.js';

const scene = document.body.appendChild(Object.assign(document.createElement('main'), {
	id : "scene",
	className : 'overview',
	z : 1.1,
	update : redraw,
}));

scene.appendChild((() => {
	const obj = Object.assign(document.createElement('div'), {
		id :'panel',
	});
	const left  = obj.appendChild(document.createElement('section'));
	const cent  = obj.appendChild(document.createElement('section'));
	const right = obj.appendChild(document.createElement('section'));
	left.appendChild((() => {
			const obj = Object.assign(document.createElement('button'), {
				id: 'overview-toggle',
				update : redraw,
			});
			obj.appendChild(document.createElement('div'));
			obj.appendChild(document.createElement('div'));
			obj.onclick = () => {
				if (scene.classList.contains('app-grid'))
					scene.classList.remove('overview', 'app-grid');
				else {
					scene.classList.toggle('overview');
					scene.classList.remove('app-grid');
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

scene.appendChild((() => {
	const obj = Object.assign(document.createElement('div'), {
		id : 'search',
		update : redraw,
	});
	const bar = obj.appendChild(document.createElement('input'));
	const p   = obj.appendChild(document.createElement('label'));
	bar.setAttribute('type', 'text');
	bar.setAttribute('placeholder', 'Type to search');
	p.innerHTML += '<svg><use href="img/icons.svg#search"/></svg>';
	return obj;
})());

scene.appendChild((()=> {
	const obj =  Object.assign(document.createElement('div'), { id:'app-grid'} );
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

scene.appendChild((() => {
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
		scene.classList.toggle('app-grid');
	};
	return obj;
})());

scene.appendChild((() => {
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

const dropdowns = document.body.appendChild(Object.assign(document.createElement('div'), {
	id: 'dropdowns',
}));

dropdowns.appendChild((()=> {
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
		z: 1.2,
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
	theme.onchange = ()=> {
		theme.set();
		update(300);
	};
	background.upload = addToggle('Upload Image', 'file');
	background.upload.firstChild.setAttribute('accept', 'image/jpeg, image/jpg, image/png, image/webp, image/gif, image/svg+xml');
	background.upload.onchange = (e) => {
		background.set(e.target.files[0])
	}
	return obj;
})());

(async () => {
	const scheme = matchMedia('(prefers-color-scheme: dark)');
	scheme.onchange = function() {
		theme.checked = this.matches;
		theme.set();
		update();
	};
	theme.checked = localStorage.getItem('theme') ? localStorage.getItem('theme') === 'dark' : scheme.matches;
	theme.set();
	updateSizes();
	const image = await fetch('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQvOY1r/+BiOh/AAA=')
	.then(res  => res.blob())
	.then(blob => blob);
	background.set(image)
})()

function addAppList(apps, hidden = false) {
	const obj = Object.assign(document.createElement('ul'), {className: 'app-list'});
	if (hidden)
		obj.classList.add('hidden');
	for (let i = 0; i < apps.length; i++)
		obj.innerHTML += `<li class="app${(apps[i][2] ? ` open` : ``)}" ><img src="apps/org.gnome.${apps[i][1]}.svg"/><h2 class="name">${apps[i][0]}</h2></li>`;
	return obj;
}