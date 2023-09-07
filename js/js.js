"use strict";
import {setBackground, createWorkSpace, createLights} from './scene.js';

const panel = document.createElement('div');
panel.id = 'panel';

const activities_toggle = addButton('activities', panel);
activities_toggle.innerHTML = 'Activities';
activities_toggle.addEventListener('click', changeView);

const clock = addButton('clock', panel);
clock.innerHTML = 'Thu Nov 25  2:15 AM';

const system_status_area = addButton('system-status-area', panel);
for (const icon of [
		'night-light',
		'network-wireless-signal-excellent',
		'network-vpn',
		'microphone-sensitivity-high',
		'battery-charging'
	])
	system_status_area.innerHTML += `<svg><use href="img/icons.svg#${icon}"></use></svg>`;

const search = document.createElement('input');
search.id = "search";
search.setAttribute('type', 'text');
search.setAttribute('placeholder', 'Type to search');

const workspaces = document.createElement('div');
workspaces.id = 'workspaces';
for(let i = 0; i < 2; i++) {
	const workspace = createWorkSpace(workspaces);
	workspace.addEventListener('dragover', (ev) => {
		ev.preventDefault();
	});
	workspace.addEventListener('drop', (ev) => {
		ev.preventDefault();
		setBackground(ev.dataTransfer.items[0].getAsFile());
	});
	workspace.addEventListener('click', changeView);
}

const app_grid  = addAppList([
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
]);
app_grid.id = 'app-grid';

const dash = document.createElement('div');
dash.id = 'dash';
dash.className = 'hidden';
dash.appendChild(addAppList( [
	['Files','Nautilus', true],
	['Software','Software', false],
	['Settings','Settings', false]
], true));
dash.innerHTML += `<p class="app"><svg viewbox="-2 -2 20 20"><use href="img/icons.svg#show-apps"></use></svg><label>Show Apps</label></p>`;
dash.lastChild.addEventListener('click', () => {
	document.body.classList.toggle('app-grid');
	document.body.classList.toggle('overview');
});

const toggles = document.createElement('div');
toggles.id = 'toggles';

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

const over_lights = document.createElement('div');
over_lights.className = 'over-lights';
over_lights.innerHTML = `
	<ul id="user-area"><li></li><li></li><li></li><li></li></ul>
	<div id="audio-main">
		<div class="volume-slider">
			<input type="range" min="1" max="100" value="40"/>
		</div>
	</div>`;
over_lights.appendChild(toggles);

const quick_settings = document.createElement('form');
quick_settings.id = 'quick-settings';
quick_settings.className = 'dropdown';
quick_settings.appendChild(over_lights);

createLights(document.body);
createLights(quick_settings);
createLights(dash);

const workarea = document.createElement('section');
workarea.id = 'workarea';
workarea.appendChild(search);
workarea.appendChild(dash);
workarea.appendChild(workspaces);
workarea.appendChild(app_grid);
workarea.appendChild(quick_settings);

document.body.appendChild(panel);
document.body.appendChild(workarea);

setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e)=> {
	setTheme(e.target.matches);
});

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
	const applist = document.createElement('ul');
	applist.className = 'app-list';
	if (hidden)
		applist.classList.add('hidden');
	for (let i = 0; i < apps.length; i++)
		applist.innerHTML += `<li class="app${(apps[i][2] ? ` open` : ``)}" ><img src="apps/org.gnome.${apps[i][1]}.svg"/><label>${apps[i][0]}</label></li>`;
	return applist;
}

function addToggle(name, parent, type="checkbox") {
	const toggle = document.createElement('label');
	toggle.innerHTML = `<input type="${type}"><span>${name}</span>`;
	parent.appendChild(toggle);
	return toggle;
}

function addButton(id, parent) {
	const button = document.createElement('button');
	button.id = id;
	parent.appendChild(button);
	return button;
}