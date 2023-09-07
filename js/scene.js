"use strict";
import { WebGL2, vs_clip, fs_drawLights, fs_drawWallpaper } from './shaders.js';

const objs = [];
const background  = new Image();
const analyst     = new Worker('./js/median_cut.js');
const aspect      = {
	width  : 1.0,
	height : 1.0,
};
const css         = new CSSStyleSheet();

document.adoptedStyleSheets = [css];
document.body.addEventListener('change', () => {
	update(300);
});

window.addEventListener('resize', () => {
	const width  = document.documentElement.clientWidth;
	const height = document.documentElement.clientHeight;
	const center_x = width  / 2.0;
	const center_y = height / 2.0;
	const diff_x = aspect.width  / Math.max(1.0, width / height);
	const diff_y = aspect.height / Math.max(1.0, height / width);
	const min    = 1.0 / Math.min(diff_x, diff_y);
	const scale  = new Float32Array([diff_x * min, diff_y * min]);
	for(let i = 0; i < objs.length; i++) {
		objs[i].context.canvas.height = objs[i].context.canvas.parentElement.clientHeight;
		objs[i].context.canvas.width  = objs[i].context.canvas.parentElement.clientWidth;
		objs[i].context.uniform2fv(objs[i].scale, scale);
		objs[i].context.uniform4fv(objs[i].rect, new Float32Array([
			(objs[i].context.canvas.parentElement.offsetLeft + (objs[i].context.canvas.parentElement.offsetWidth  / 2.0) -  center_x) / width  * -2.0,
			(objs[i].context.canvas.parentElement.offsetTop  + (objs[i].context.canvas.parentElement.offsetHeight / 2.0) -  center_y) / height *  2.0,
			width  / objs[i].context.canvas.parentElement.offsetWidth,
			height / objs[i].context.canvas.parentElement.offsetHeight
		]));
		objs[i].context.viewport(0, 0, objs[i].context.canvas.width, objs[i].context.canvas.height);
	}
	update();
});

background.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACXBIWXMAAAsTAAALEwEAmpwYAAAACklEQVQIHWOoBAAAewB6N1xddAAAAABJRU5ErkJggg==";
background.addEventListener('load', () => {
	createImageBitmap(background).then((image) => {
		analyst.postMessage(image, [image]);
	});
	URL.revokeObjectURL(background.src);
});

analyst.onmessage = (e) => {
	css.replaceSync(e.data.css);
	aspect.width  = e.data.aspect[0];
	aspect.height = e.data.aspect[1];
	for(let i = 0; i < objs.length; i++) {
		objs[i].context.uniform2fv(objs[i].background, e.data.aspect);
		if (objs[i].context.canvas.classList.contains('light')) {
			objs[i].context.uniform1i(objs[i].light_length, e.data.light_length);
			objs[i].context.bufferData(objs[i].context.UNIFORM_BUFFER, e.data.lights, objs[i].context.STATIC_DRAW);
		} else
			objs[i].context.texImage2D(objs[i].context.TEXTURE_2D, 0, objs[i].context.RGB, background.width, background.height, 0, objs[i].context.RGB, objs[i].context.UNSIGNED_BYTE, background);
	}
	window.dispatchEvent(new Event("resize"));
	update(250);
};

const animation_state = {
	active : false,
	end    : window.performance.now()
}
function update(length = 0) {
	const end = window.performance.now() + length;
	if(end > animation_state.end)
		animation_state.end = end;
	if (animation_state.active)
		return;
	animation_state.active = true;
	window.requestAnimationFrame(refresh);

	function refresh(timestamp) {
		for(let i = 0; i < objs.length; i++) {
			if(objs[i].context.canvas.className === 'light')
				objs[i].context.uniform1f(objs[i].surfaceColor, window.getComputedStyle(objs[i].context.canvas).getPropertyValue("background-color").split(', ')[1] | 0);
			objs[i].context.drawArrays(objs[i].context.TRIANGLE_STRIP, 0, 4);
		}
		if(timestamp > animation_state.end)
			return animation_state.active = false;
		window.requestAnimationFrame(refresh);	
	}
}

function createPaint(surface, vs, fs, type) {
	const setup = new WebGL2(vs, fs);
	const data = {
		context : setup.context,
		program : setup.program
	};
	surface.prepend(data.context.canvas);
	data.context.canvas.className = type;
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

export function createLights(surface) {
	const data = createPaint(surface, vs_clip, fs_drawLights, 'light');
	data.surfaceColor = data.context.getUniformLocation(data.program, "surfaceColor");
	data.light_length = data.context.getUniformLocation(data.program, "length");
	data.lights = data.context.getUniformBlockIndex(data.program, 'lighting');
	data.context.bindBufferBase(data.context.UNIFORM_BUFFER, 0, data.context.createBuffer());
	objs.push(data);
}

export function createWorkSpace(surface) {
	const data = createPaint(surface, vs_clip, fs_drawWallpaper, 'workspace');
	const uv   = data.context.getAttribLocation(data.program, 'tuv');
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
	objs.push(data);
	return data.context.canvas;
}

export function setBackground(file) {
	const allowedFiletypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/jxl"];
	if (allowedFiletypes.includes(file.type))
		background.src = URL.createObjectURL(file);
}