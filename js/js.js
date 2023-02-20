import {sendToAnalyze, refresh, PaintObject} from './scene.js';
import {Monitor} from './monitor.js';

export const monitor = new Monitor();

const scene   = {
	paintObjects : [
				new PaintObject(document.body),
				new PaintObject(document.getElementById('quick-settings')),
	            ],
	wallpaper : new Image(),
	theme : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
	css : new CSSStyleSheet()
};
document.adoptedStyleSheets = [scene.css];
scene.wallpaper.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACXBIWXMAAAsTAAALEwEAmpwYAAAACklEQVQIHWOoBAAAewB6N1xddAAAAABJRU5ErkJggg==";

sendToAnalyze(scene);
changetoPreferredTheme();

function changetoPreferredTheme() {
	const darkModeCheck = document.getElementById('dark-mode-check');
	darkModeCheck.checked = window.matchMedia('(prefers-color-scheme: dark)').matches;
	darkModeCheck.dispatchEvent(new Event("change"));
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', changetoPreferredTheme);
document.getElementById('dark-mode-check').addEventListener('change', (e) => {
	scene.theme = e.target.checked ? 'dark' : 'light';
	document.documentElement.id = scene.theme + "-mode";
	//refresh(scene);
});

document.getElementById('activities').addEventListener('click', () => {
	document.body.classList.toggle('overview');
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
			sendToAnalyze(scene);
		}
	}
}
monitor.workspaces[0].canvas.addEventListener('dragover', (ev) => {
	ev.preventDefault();
});
monitor.workspaces[0].canvas.addEventListener('drop', (ev) => {
	ev.preventDefault();
	uploadFile(ev.dataTransfer.items[0].getAsFile());
});
document.getElementById("fileUpload").addEventListener('change', (ev) => {
	uploadFile(ev.target.files[0]);
});

window.addEventListener('resize', () => {
	monitor.refresh();
	monitor.update(scene);
});

function continuous_refresh() {
	refresh(scene);
	window.requestAnimationFrame(continuous_refresh);
}; continuous_refresh();