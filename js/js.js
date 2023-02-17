import {set_background, refresh} from './scene.js';
import {Monitor} from './monitor.js';

export const monitor = new Monitor();
const scene   = {
	paintObjects : [
	            document.body,
	            document.getElementById('audiodropdown')
	            ],
	wallpaper :  new Image(),
	lights : [],
	theme : (window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light',
	stage : {
		light : 1,
		dark  : 0
	}
}

function setMode() {
	document.documentElement.id = scene.theme + "-mode";
	document.getElementById('dark-mode-check').checked = scene.theme == 'dark' ? true : false;
} setMode();

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { 
	scene.theme = (window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
	setMode();
	refresh(scene);
});

document.getElementById('dark-mode-check').addEventListener('change', () => {
	scene.theme = (scene.theme == 'dark') ? 'light' : 'dark';
	setMode();
	refresh(scene)
});

scene.wallpaper.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACXBIWXMAAAsTAAALEwEAmpwYAAAACklEQVQIHWOoBAAAewB6N1xddAAAAABJRU5ErkJggg==";

set_background(scene);

document.getElementById('activities').addEventListener('click', () => {
	document.body.classList.toggle('overview');
});


window.addEventListener('resize', () => {
	monitor.refresh();
	monitor.update(scene);
});

function uploadFile(file) {
	if (file) {
		const allowedFiletypes = ["image/jpeg",
								"image/jpg",
								"image/png",
								"image/webp",
								"image/gif",
								"image/svg+xml"
								];
		if (allowedFiletypes.includes(file.type)) {
			if (scene.wallpaper.src != null)
				URL.revokeObjectURL(scene.wallpaper.src);
			scene.wallpaper.src = URL.createObjectURL(file)
			set_background(scene);
		}
	}
}
monitor.workspaces[0].addEventListener('dragover', (ev) => {
	ev.preventDefault();
});
monitor.workspaces[0].addEventListener('drop', (ev) => {
	ev.preventDefault();
	uploadFile(ev.dataTransfer.items[0].getAsFile());
});
document.getElementById("fileUpload").addEventListener('change', (ev) => {
	uploadFile(ev.target.files[0]);
});