"use strict";
import './scene.js';

document.body.className = 'overview';
document.body.depth = 1.0;
document.body.appendChild((() => {
	const obj = Object.assign(document.createElement('ul'), {id:'panel'});
	const left  = obj.appendChild(document.createElement('li'));
	const cent  = obj.appendChild(document.createElement('li'));
	const right = obj.appendChild(document.createElement('li'));
	left.appendChild((() => {
			const obj = Object.assign(document.createElement('button'), {id: 'overview-toggle', innerHTML :'Activities'})
			obj.addEventListener('click', changeView);
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
	obj.addEventListener('dragover', (ev) => {
		ev.preventDefault();
	});
	obj.addEventListener('drop', (ev) => {
		ev.preventDefault();
		setBackground(ev.dataTransfer.items[0].getAsFile());
	})
	return obj;
})());

window.quick_settings = document.body.appendChild((()=> {
	function addToggle(name, type="checkbox") {
		return toggles.appendChild(Object.assign(document.createElement('label'), {innerHTML :`<input type="${type}"><h3>${name}</h3>`}));
	}
	const obj = Object.assign(document.createElement('form'), {id :'quick-settings', className: 'dropdown', depth: 1.5,
	theme : (val) => {
		theme.checked = val;
	}});
	const over = obj.appendChild(Object.assign(document.createElement('div'), {className: 'over-lights', innerHTML : `
		<ul id="user-area"><li></li><li></li><li></li><li></li></ul>
		<div id="audio-main">
			<div class="volume-slider">
				<input type="range" min="1" max="100" value="40"/>
			</div>
		</div>`}));
	const toggles = over.appendChild(Object.assign(document.createElement('div'), {id: 'toggles'}));
	const wired   = addToggle('Wired');
	const wifi    = addToggle('Wi-Fi');
	const blue    = addToggle('Bluetooth');
	const power   = addToggle('Power Saver');
	const theme   = addToggle('Dark Mode').firstChild;
	const upload  = addToggle('Upload Image', 'file');
	theme.addEventListener('click', (e) => { setTheme(e.target.checked) });
	upload.addEventListener('change', (e) => { setBackground(e.target.files[0]) });
	return obj;
})());

setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e)=> {
	setTheme(e.target.matches);
});

(async () => {
	getSurfaces(document.body);
	const default_background = await fetch('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQvOY1r/+BiOh/AAA=')
	.then(res  => res.blob())
	.then(blob => blob);
	setBackground(default_background);
})();

function addAppList(apps, hidden=false) {
	const applist = Object.assign(document.createElement('ul'), {className: 'app-list'});
	if (hidden)
		applist.classList.add('hidden');
	for (let i = 0; i < apps.length; i++)
		applist.innerHTML += `<li class="app${(apps[i][2] ? ` open` : ``)}" ><img src="apps/org.gnome.${apps[i][1]}.svg"/><h2 class="name">${apps[i][0]}</h2></li>`;
	return applist;
}