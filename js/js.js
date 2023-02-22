import { WebGL2 } from "./shaders.js";
import {sendToAnalyze, scene, fullRedraw, drawLights} from './scene.js';

export const workspaces = [];
export const monitor = {};

function main() {

	document.adoptedStyleSheets = [scene.css];
	window.addEventListener('load', () => {
		updateMonitorRect();
		scene.wallpaper.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACXBIWXMAAAsTAAALEwEAmpwYAAAACklEQVQIHWOoBAAAewB6N1xddAAAAABJRU5ErkJggg==";
		scene.wallpaper.addEventListener('load', sendToAnalyze);
		changetoPreferredTheme();
	});

	createWorkSpaces();
	createButtonListeners();
	createThemeListener();
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

function constructor2() {
    workspaces = []
    for(let i = 0; i < 2; i++) {
        const gl = new WebGL2('','');
        document.getElementById('workspaces').appendChild(gl.context.canvas);
        workspaces.push(gl.context);
    }
}

function createButtonListeners() {
	document.getElementById('activities').addEventListener('click', () => {
		document.body.classList.toggle('overview');
	});
}

function createFileUploadListeners() {
	workspaces[0].canvas.addEventListener('dragover', (ev) => {
		ev.preventDefault();
	});
	workspaces[0].canvas.addEventListener('drop', (ev) => {
		ev.preventDefault();
		uploadFile(ev.dataTransfer.items[0].getAsFile());
	});
	document.getElementById("fileUpload").addEventListener('change', (ev) => {
		uploadFile(ev.target.files[0]);
	});
}

function createThemeListener() {
	window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', changetoPreferredTheme);
	document.getElementById('dark-mode-check').addEventListener('change', (e) => {
		scene.theme = e.target.checked ? 'dark' : 'light';
		document.documentElement.id = scene.theme + "-mode";
	});
}

function changetoPreferredTheme() {
	const darkModeCheck = document.getElementById('dark-mode-check');
	darkModeCheck.checked = window.matchMedia('(prefers-color-scheme: dark)').matches;
	darkModeCheck.dispatchEvent(new Event("change"));
}

function updateMonitorRect() {
	monitor.width  = document.documentElement.clientWidth;
	monitor.height = document.documentElement.clientHeight;
	monitor.aspect = [Math.max(1.0, monitor.width / monitor.height), Math.max(1.0, monitor.height / monitor.width)];
	for(const obj of scene.lightSurfaces) {
		const gl = obj.context;
		gl.uniform4fv(obj.monitor, new Float32Array([monitor.aspect[0], monitor.aspect[1], monitor.width, monitor.height]));
		gl.uniform4fv(obj.rect, new Float32Array([obj.surface.offsetLeft, monitor.height - (obj.surface.offsetTop + gl.canvas.height), gl.canvas.width, gl.canvas.height]));
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