import {Scene} from './scene.js';
import {Monitor} from './monitor.js';

export const monitor = new Monitor();
export const scene   = new Scene();

document.getElementById('activities').addEventListener('click', () => {
	document.body.classList.toggle('overview');
});

monitor.workspaces[0].addEventListener('dragover', (ev) => {
	ev.preventDefault();
});

monitor.workspaces[0].addEventListener('drop', (ev) => {
		ev.preventDefault();
		if (ev.dataTransfer.items) {
			const allowedFiletypes = ["image/jpeg",
									"image/jpg",
									"image/png",
									"image/webp",
									"image/gif",
									"image/svg+xml"
									];
			if (allowedFiletypes.includes(ev.dataTransfer.items[0].type)) {
				if (scene.wallpaper.src != null)
					URL.revokeObjectURL(scene.wallpaper.src);
				scene.set_background(URL.createObjectURL(ev.dataTransfer.items[0].getAsFile()));
				ev.dataTransfer.items.clear();
			}
		}
	}
);

window.addEventListener('resize', () => {
	monitor.refresh();
	monitor.update(scene);
});