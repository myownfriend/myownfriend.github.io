"use strict";
import { WebGL2, vs_clip, fs_drawLights, fs_drawWallpaper } from './shaders.js';
import { updateMonitorRect } from './js.js';

export const scene = {
	paintObjects : [
				createWorkSpaces(document.getElementById('workspaces')),
				createWorkSpaces(document.getElementById('workspaces')),
				createLights(document.body),
				createLights(document.getElementById('quick-settings')),
				createLights(document.getElementById('dash'))
	            ],
	background: new Image(),
	aspect    : {width: 1.0, height : 1.0},
	analyst   : new Worker('./js/median_cut.js'),
	theme     : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
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
	data.context.canvas.className = type;
	data.surface.prepend(data.context.canvas);
	data.rect = data.context.getUniformLocation(data.program, "rect");
	data.background = data.context.getUniformLocation(data.program, "background");
	data.scale = data.context.getUniformLocation(data.program, "global_scale");
	const vPosition = data.context.getAttribLocation(data.program, 'vPosition');
	data.context.bindBuffer(data.context.ARRAY_BUFFER, data.context.createBuffer());
	data.context.bufferData(data.context.ARRAY_BUFFER, new Float32Array([-1.0,1.0, -1.0,-1.0, 1.0,1.0, 1.0,-1.0]), data.context.STATIC_DRAW);
	data.context.enableVertexAttribArray(vPosition);
	data.context.vertexAttribPointer(vPosition, 2, data.context.FLOAT, false, 0, 0);
	return data;
}

function createLights(surface) {
	const data = createPaint(surface, vs_clip, fs_drawLights, 'light');
	data.lights = data.context.getUniformBlockIndex(data.program, 'lighting');
	data.surfaceColor = data.context.getUniformLocation(data.program, "surfaceColor");
	data.light_length = data.context.getUniformLocation(data.program, "length");
	data.context.bindBufferBase(data.context.UNIFORM_BUFFER, 0, data.context.createBuffer());
	return data;
}

function createWorkSpaces(surface) {
	const
		data = createPaint(surface, vs_clip, fs_drawWallpaper, 'workspace'),
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

scene.analyst.onmessage = (e) => {
	scene.css.replaceSync(e.data.css);
	scene.aspect.width  = e.data.aspect[0];
	scene.aspect.height = e.data.aspect[1];
	for(let i = 0; i < scene.paintObjects.length; i++) {
		const obj = scene.paintObjects[i];
		obj.context.uniform2fv(obj.background, e.data.aspect);
		if (obj.context.canvas.classList.contains('light')) {
			obj.context.uniform1i(obj.light_length, e.data.light_length);
			obj.context.bufferData(obj.context.UNIFORM_BUFFER, e.data.lights, obj.context.STATIC_DRAW);
		} else
			obj.context.texImage2D(obj.context.TEXTURE_2D, 0, obj.context.RGB, scene.background.width, scene.background.height, 0, obj.context.RGB, obj.context.UNSIGNED_BYTE, scene.background);
	}
	updateMonitorRect();
	update(250);
};

export function update(length = 0) {
	const end = window.performance.now() + length;
	function refresh(timestamp) {
		for(let i = 0; i < scene.paintObjects.length; i++) {
			const obj = scene.paintObjects[i];
			if(obj.context.canvas.className === 'light')
				obj.context.uniform1f(obj.surfaceColor, window.getComputedStyle(obj.surface).getPropertyValue("background-color").split(', ')[1] | 0);
			obj.context.drawArrays(obj.context.TRIANGLE_STRIP, 0, 4);
		}
		if(timestamp < end)
			window.requestAnimationFrame(refresh);
	}; window.requestAnimationFrame(refresh);
}
