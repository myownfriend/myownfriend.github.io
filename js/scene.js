import {WebGL2, vs_drawLights, fs_drawLights, fs_drawWallpaper} from './shaders.js';
import {updateMonitorRect} from './js.js';

export const scene = {
	paintObjects : [
				createLights(document.body),
				createLights(document.getElementById('quick-settings')),
				createLights(document.getElementById('dash')),
				createWorkSpaces(document.getElementById('workspaces')),
				createWorkSpaces(document.getElementById('workspaces'))
	            ],
	wallpaper : new Image(),
	analyst   : new Worker('./js/median_cut.js'),
	theme     : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
	aspect    : [],
	css       : new CSSStyleSheet()
};

function createPaint(surface,vs,fs,type) {
	const
		setup = new WebGL2(vs, fs),
		data = {
			context : setup.context,
			program : setup.program
		};
	data.surface = surface;
	data.context.canvas.classList.add(type);
	data.surface.prepend(data.context.canvas);
	data.rect = data.context.getUniformLocation(data.program, "rect");
	data.monitor = data.context.getUniformLocation(data.program, "monitor");
	data.background = data.context.getUniformLocation(data.program, "background");

	const vPosition = data.context.getAttribLocation(data.program, 'vPosition');
	data.context.bindBuffer(data.context.ARRAY_BUFFER, data.context.createBuffer());
	data.context.bufferData(data.context.ARRAY_BUFFER, new Float32Array([-1.0,1.0, -1.0,-1.0, 1.0,1.0, 1.0,-1.0]), data.context.STATIC_DRAW);

	data.context.enableVertexAttribArray(vPosition);
	data.context.vertexAttribPointer(vPosition, 2, data.context.FLOAT, false, 0, 0);

	return data;
}

function createLights(surface) {
	const data = createPaint(surface, vs_drawLights, fs_drawLights, 'light');
	data.lights = data.context.getUniformBlockIndex(data.program, 'lighting');
	data.surfaceColor = data.context.getUniformLocation(data.program, "surfaceColor");
	data.context.bindBufferBase(data.context.UNIFORM_BUFFER, 0, data.context.createBuffer());
	return data;
}

function createWorkSpaces(surface) {
	const
		data = createPaint(surface, vs_drawLights, fs_drawWallpaper, 'workspace'),
		uv   = data.context.getAttribLocation(data.program, 'tuv');
	data.context.bindBuffer(data.context.ARRAY_BUFFER, data.context.createBuffer());
	data.context.bufferData(data.context.ARRAY_BUFFER, new Float32Array([0.0,1.0, 0.0,0.0, 1.0,1.0, 1.0,0.0]), data.context.STATIC_DRAW);
	data.context.enableVertexAttribArray(uv);
	data.context.vertexAttribPointer(uv, 2, data.context.FLOAT, false, 0, 0);
	
	data.context.uniform1i(data.context.getUniformLocation(data.program, 'wallpaper'), 0);
	data.context.pixelStorei(data.context.UNPACK_FLIP_Y_WEBGL, true);
	data.context.bindTexture(data.context.TEXTURE_2D, data.context.createTexture());
	data.context.activeTexture(data.context.TEXTURE0);
	data.context.texParameteri(data.context.TEXTURE_2D, data.context.TEXTURE_MIN_FILTER, data.context.LINEAR);
	data.context.texParameteri(data.context.TEXTURE_2D, data.context.TEXTURE_MAG_FILTER, data.context.LINEAR);
	return data;
}

export function sendToAnalyze() {
	const thumb = new OffscreenCanvas(192 / 2, 128 / 2).getContext('2d');
	thumb.drawImage(scene.wallpaper, 0, 0, thumb.canvas.width, thumb.canvas.height);
	// It's minor but the aspect ratio calculation should be 
	// part of the worker since it's technically a kind of analysis
	// That can't be done until the bullshit createThumbnail function is replaced
	scene.analyst.postMessage({
		wWidth : scene.wallpaper.width,
		wHeight: scene.wallpaper.height,
		width  : thumb.canvas.width,
		height : thumb.canvas.height,
		image  : thumb.getImageData(0, 0, thumb.canvas.width, thumb.canvas.height).data
	});
	URL.revokeObjectURL(scene.wallpaper.src);
}

scene.analyst.onmessage = (e) => {
	scene.css.replaceSync(e.data.css);
	for(const obj of scene.paintObjects) {
		obj.context.uniform2fv(obj.background, e.data.aspect);
		if (obj.context.canvas.classList.contains('light'))
			obj.context.bufferData(obj.context.UNIFORM_BUFFER, new Float32Array(e.data.lights), obj.context.STATIC_DRAW);
		else
			obj.context.texImage2D(obj.context.TEXTURE_2D, 0, obj.context.RGB, scene.wallpaper.width, scene.wallpaper.height, 0, obj.context.RGB, obj.context.UNSIGNED_BYTE, scene.wallpaper);
	}
	updateMonitorRect();
	update(250);
};

export function update(length = 1) {
	const end = window.performance.now() + length;
	window.requestAnimationFrame(refresh);
	function refresh(timestamp) {
		for(const obj of scene.paintObjects) {
			if(obj.context.canvas.classList.contains('light'))
				obj.context.uniform1f(obj.surfaceColor, Number(window.getComputedStyle(obj.surface).getPropertyValue("background-color").split(', ')[1]));
			obj.context.drawArrays(obj.context.TRIANGLE_STRIP, 0, 4);
		}
		if(timestamp < end)
			window.requestAnimationFrame(refresh);
	};
}

