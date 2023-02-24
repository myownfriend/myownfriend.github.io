import { WebGL2 } from "./shaders.js";
import {sendToAnalyze, scene, fullRedraw, drawLights} from './scene.js';

export const workspaces = [];

function main() {

	document.adoptedStyleSheets = [scene.css];
	window.addEventListener('load', () => {
		updateMonitorRect();
		scene.wallpaper.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACXBIWXMAAAsTAAALEwEAmpwYAAAACklEQVQIHWOoBAAAewB6N1xddAAAAABJRU5ErkJggg==";
		scene.wallpaper.addEventListener('load', sendToAnalyze);
		setToPreferredTheme();
	});

	createWorkSpaces();
	createButtonListeners();
	createThemeListeners();
	createFileUploadListeners();

	window.addEventListener('resize', () => {
		updateMonitorRect();
		fullRedraw();
	});

	continuous_refresh();
}

function createWorkSpaces(amount=2) {
    for(let i = 0; i < amount ; i++) {
        const canvas = document.createElement('canvas');
        document.getElementById('workspaces').appendChild(canvas);
        workspaces.push(canvas.getContext('2d'));
    }
}

function createButtonListeners() {
	document.getElementById('activities').addEventListener('click', () => {
		if(document.body.classList.contains('app-grid')) {
			document.body.classList.remove('overview');
			document.body.classList.remove('app-grid');
		} else {
			document.body.classList.toggle('overview');
			document.body.classList.remove('app-grid');
		}
	});
	document.getElementById('app-grid-toggle').addEventListener('click', () => {
		document.body.classList.toggle('app-grid');
		document.body.classList.toggle('overview');
	});
	for(const workspace of workspaces)
		workspace.canvas.addEventListener('click', () => {
			document.body.classList.remove('overview');
			document.body.classList.remove('app-grid');
		});
}

function createFileUploadListeners() {
	for(const workspace of workspaces) {
		workspace.canvas.addEventListener('dragover', (ev) => {
			ev.preventDefault();
		});
		workspace.canvas.addEventListener('drop', (ev) => {
			ev.preventDefault();
			uploadFile(ev.dataTransfer.items[0].getAsFile());
		});
	}
	document.getElementById("fileUpload").addEventListener('change', (ev) => {
		uploadFile(ev.target.files[0]);
	});
}

function createThemeListeners() {
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setToPreferredTheme);
	document.getElementById('dark-mode-check').addEventListener('change', (e) => {
		scene.theme = e.target.checked ? 'dark' : 'light';
		document.documentElement.id = scene.theme + "-mode";
	});
}

function setToPreferredTheme() {
	const darkModeCheck = document.getElementById('dark-mode-check');
	darkModeCheck.checked = window.matchMedia('(prefers-color-scheme: dark)').matches;
	darkModeCheck.dispatchEvent(new Event("change"));
}

function updateMonitorRect() {
	const
		width    = document.documentElement.clientWidth,
		height   = document.documentElement.clientHeight,
		uMonitor = new Float32Array([Math.max(1.0, width / height), Math.max(1.0, height / width), width, height]);

	for(const workspace of workspaces) {
		workspace.canvas.width  = width;
		workspace.canvas.height = height;
	}
	for(const obj of scene.lightSurfaces) {
		const gl = obj.context;
		gl.canvas.height = obj.surface.clientHeight;
		gl.canvas.width  = obj.surface.clientWidth;
		gl.uniform4fv(obj.monitor, uMonitor);
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		gl.uniform4fv(obj.rect, new Float32Array([obj.surface.offsetLeft, height - (obj.surface.offsetTop + gl.canvas.height), gl.canvas.width, gl.canvas.height]));
	}
}

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
			sendToAnalyze();
		}
	}
}

function continuous_refresh() {
	drawLights();
	window.requestAnimationFrame(continuous_refresh);
};

main();