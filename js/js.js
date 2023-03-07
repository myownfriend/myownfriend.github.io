import {sendToAnalyze, scene, update} from './scene.js';

document.adoptedStyleSheets = [scene.css];

window.addEventListener('load', () => {
	updateMonitorRect();
	scene.wallpaper.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACXBIWXMAAAsTAAALEwEAmpwYAAAACklEQVQIHWOoBAAAewB6N1xddAAAAABJRU5ErkJggg==";
	scene.wallpaper.addEventListener('load', sendToAnalyze);
	setToPreferredTheme();
});
for(const workspace of document.getElementsByClassName('workspace')) {
	workspace.addEventListener('dragover', (ev) => {
		ev.preventDefault();
	});
	workspace.addEventListener('drop', (ev) => {
		ev.preventDefault();
		uploadFile(ev.dataTransfer.items[0].getAsFile());
	});
	workspace.addEventListener('click', () => {
		document.body.classList.remove('overview','app-grid');
		document.body.classList.add('desktop');
		update(300);
	});
}
document.getElementById("fileUpload").addEventListener('change', (ev) => {
	uploadFile(ev.target.files[0]);
});
document.getElementById('activities').addEventListener('click', () => {
	if(document.body.classList.contains('app-grid')) {
		document.body.classList.remove('overview', 'app-grid');
		document.body.classList.add('desktop');
	} else {
		document.body.classList.toggle('overview');
		document.body.classList.toggle('desktop');
		document.body.classList.remove('app-grid');
	}
	update(300);
});
document.getElementById('app-grid-toggle').addEventListener('click', () => {
	document.body.classList.toggle('app-grid');
	document.body.classList.toggle('overview');
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setToPreferredTheme);
document.getElementById('dark-mode-check').addEventListener('change', (e) => {
	scene.theme = e.target.checked ? 'dark' : 'light';
	document.documentElement.id = scene.theme + "-mode";
	update(300);
});
window.addEventListener('resize', updateMonitorRect);

function setToPreferredTheme() {
	const darkModeCheck = document.getElementById('dark-mode-check');
	darkModeCheck.checked = window.matchMedia('(prefers-color-scheme: dark)').matches;
	darkModeCheck.dispatchEvent(new Event("change"));
}

export function updateMonitorRect() {
	const
		width  = document.documentElement.clientWidth,
		height = document.documentElement.clientHeight,
		aspect = new Float32Array([Math.max(1.0, width / height), Math.max(1.0, height / width)]),
		center = [width  / 2, height / 2];

	for(const obj of scene.paintObjects) {
		const gl = obj.context;
		gl.canvas.height = obj.surface.clientHeight;
		gl.canvas.width  = obj.surface.clientWidth;
		gl.uniform2fv(obj.monitor, aspect);
		gl.uniform4fv(obj.rect, new Float32Array([
			(obj.surface.offsetLeft + (obj.surface.offsetWidth  / 2) -  center[0]) / width  * -2.0,
			(obj.surface.offsetTop  + (obj.surface.offsetHeight / 2) -  center[1]) / height *  2.0,
			width  / obj.surface.offsetWidth,
			height / obj.surface.offsetHeight
		]));
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	}
	update();
}

function uploadFile(file) {
	const allowedFiletypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
	if (allowedFiletypes.includes(file.type))
		scene.wallpaper.src = URL.createObjectURL(file);
}