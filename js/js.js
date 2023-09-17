"use strict";
import {setBackground, createSurface} from './scene.js';

document.body.className = "overview";

const panel = Object.assign(document.createElement('ul'), {id:'panel'});
const panel_left  = document.createElement('li');
const panel_cent  = document.createElement('li');
const panel_right = document.createElement('li');

const activities_toggle = addButton('overview-toggle', panel_left);
activities_toggle.innerHTML = 'Activities';
activities_toggle.addEventListener('click', changeView);

const clock = addButton('clock', panel_cent);
clock.innerHTML = 'Thu Nov 25  2:15 AM';

const system_status_area = addButton('system-status-area', panel_right);
for (const icon of [
		'night-light',
		'network-wireless-signal-excellent',
		'network-vpn',
		'microphone-sensitivity-high',
		'battery-charging'
	])
	system_status_area.innerHTML += `<svg><use href="img/icons.svg#${icon}"/></svg>`;

panel.appendChild(panel_left);
panel.appendChild(panel_cent);
panel.appendChild(panel_right);

const search = Object.assign(document.createElement('label'), { id : 'search'});
const search_bar = document.createElement('input');
search_bar.setAttribute('type', 'text');
search_bar.setAttribute('placeholder', 'Type to search');
const search_decoration = document.createElement('p');
search_decoration.innerHTML += '<svg><use href="img/icons.svg#search"/></svg>'
search_decoration.appendChild(search_bar);
search.appendChild(search_decoration);

const workspaces = Object.assign(document.createElement('div'), { id: 'workspaces'});
for(let i = 0; i < 2; i++)
	workspaces.innerHTML += '<svg class="workspace"><use href="#background"/></svg>';

workspaces.addEventListener('dragover', (ev) => {
	ev.preventDefault();
});
workspaces.addEventListener('drop', (ev) => {
	ev.preventDefault();
	setBackground(ev.dataTransfer.items[0].getAsFile());
});
workspaces.addEventListener('click', changeView);

const app_grid  = Object.assign(addAppList([
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
]), { id:'app-grid'} );

const dash = Object.assign(document.createElement('div'), {id: 'dash', className: 'hidden'});
dash.appendChild(addAppList( [
	['Files','Nautilus', true],
	['Software','Software', false],
	['Settings','Settings', false]
], true));
dash.innerHTML += `<div id="show-apps-toggle" class="app"><svg viewbox="0 0 16 16"><use href="img/icons.svg#show-apps"/></svg><p class="name">Show Apps</p></div>`;
dash.lastChild.addEventListener('click', () => {
	document.body.classList.toggle('app-grid');
});

const toggles = Object.assign(document.createElement('div'), {id: 'toggles'});

const settings = {
	wired        : addToggle('Wired', toggles),
	wifi         : addToggle('Wi-Fi', toggles),
	bluetooth    : addToggle('Bluetooth', toggles),
	power        : addToggle('Power Saver', toggles),
	dark_mode    : addToggle('Dark Mode', toggles).firstChild,
	file_upload  : addToggle('Upload Image', toggles, 'file'),
}
settings.dark_mode.addEventListener('click', (e) => {
	setTheme(e.target.checked);
});
settings.file_upload.addEventListener('change', (e) => {
	setBackground(e.target.files[0]);
});

const over_lights = Object.assign(document.createElement('div'), {className: 'over-lights'});
over_lights.innerHTML = `
	<ul id="user-area"><li></li><li></li><li></li><li></li></ul>
	<div id="audio-main">
		<div class="volume-slider">
			<input type="range" min="1" max="100" value="40"/>
		</div>
	</div>`;
over_lights.appendChild(toggles);

const quick_settings = Object.assign(document.createElement('form'), {id :'quick-settings', className: 'dropdown'});
quick_settings.appendChild(over_lights);

const workarea = Object.assign(document.createElement('main'), {id : 'workarea'});
workarea.appendChild(search);
workarea.appendChild(app_grid);
workarea.appendChild(dash);
workarea.appendChild(workspaces);

document.body.appendChild(panel);
document.body.appendChild(workarea);
document.body.appendChild(quick_settings);

setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e)=> {
	setTheme(e.target.matches);
});

createSurface(document.body);
createSurface(search);
createSurface(dash);
createSurface(quick_settings);

setBackground();

function setTheme(dark) {
	settings.dark_mode.checked = dark;
	document.body.id = (dark ? 'dark' : 'light') + "-mode";
	document.body.dispatchEvent(new Event("change"));
}

function changeView() {
	if (document.body.classList.contains('app-grid')) {
		document.body.classList.remove('overview', 'app-grid');
	} else {
		document.body.classList.toggle('overview');
		document.body.classList.remove('app-grid');
	}
	document.body.dispatchEvent(new Event("change"));
}

function addAppList(apps, hidden=false) {
	const applist = Object.assign(document.createElement('ul'), {className: 'app-list'});
	if (hidden)
		applist.classList.add('hidden');
	for (let i = 0; i < apps.length; i++)
		applist.innerHTML += `<li class="app${(apps[i][2] ? ` open` : ``)}" ><img src="apps/org.gnome.${apps[i][1]}.svg"/><p class="name">${apps[i][0]}</p></li>`;
	return applist;
}

function addToggle(name, parent, type="checkbox") {
	const toggle = document.createElement('label');
	toggle.innerHTML = `<input type="${type}"><span>${name}</span>`;
	parent.appendChild(toggle);
	return toggle;
}

function addButton(id, parent) {
	const button = Object.assign(document.createElement('button'), {id: id});
	parent.appendChild(button);
	return button;
}