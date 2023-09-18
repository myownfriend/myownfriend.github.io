"use strict";
import {getBrightness, background, surfaces} from './common.js';

const canvas = Object.assign(document.createElement('canvas'), {
	depth : 1.0,
	rect  : new Float32Array([-1.0,  1.0, -1.0, -1.0, 1.0,  1.0, 1.0, -1.0])
});
document.body.prepend(canvas);

const gl = canvas.getContext('webgl2', {
	depth     : false,
	alpha     : false,
	stencil   : false,
	antialias : false,
	desynchronized : true,
	colorSpace : 'display-p3',
	preserveDrawingBuffer: true,
	powerPreference : "low-power",
});
const program = gl.createProgram();
const vShader = gl.createShader(gl.VERTEX_SHADER);
const fShader = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(vShader, `#version 300 es
	precision mediump float;
	in   vec2 vPosition;
	out  vec2 lxy;
	void main() {
		lxy         = vPosition.xy;
		gl_Position = vec4(vPosition.xy, 1.0, 1.0);
	}`);
gl.shaderSource(fShader, `#version 300 es
	precision mediump float;
	precision mediump int;
	in vec2 lxy;
	struct light {
		vec4 pos;
		vec4 color;
	};
	layout(std140) uniform lighting {
		light lights[6];
		int   length;
	};
	uniform float depth;
	uniform float brightness;
	out vec4 color;
	vec3 OKLAB_to_SRGB(vec3 OKLAB) {
		vec3 LMS = mat3(
			1.0000000000,  1.0000000000, 1.0000000000,
			0.3963377774, -0.1055613458,-0.0894841775,
			0.2158037573, -0.0638541728,-1.2914855480) * OKLAB;
		vec3 RGB = mat3(
			4.0767245293, -1.2681437731, -0.0041119885,
			-3.3072168827, 2.6093323231, -0.7034763098,
			0.2307590544, -0.3411344290,  1.7068625689) * pow(LMS, vec3(3.0));
		return mix(1.055 * pow(RGB, vec3(1.0/2.2)) - 0.055, RGB * 12.92, lessThanEqual(RGB, vec3(0.0031308)));
	}
	void main() {
		float in_acc = 0.0;
		vec2  ab = vec2(0.0, 0.0);
		for (int i = length - 1; i >= 0; i--) {
			float distance  = distance(vec3(lxy, depth), lights[i].pos.xyz);
			float intensity = lights[i].color.x / (distance * distance);
			ab += intensity * lights[i].color.ab;
			in_acc += intensity;
		}
		ab /= in_acc;
		color = vec4(OKLAB_to_SRGB(vec3(brightness, ab)),1.0);
	}
`);
gl.attachShader(program, vShader);
gl.attachShader(program, fShader);
gl.compileShader(vShader);
gl.compileShader(fShader);
gl.linkProgram(program);
gl.useProgram(program);
gl.depthFunc(gl.NEVER);
const vPosition = gl.getAttribLocation(program, 'vPosition');
gl.enableVertexAttribArray(vPosition);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);

const bright_index = gl.getUniformLocation(program, "brightness");
const depth_index  = gl.getUniformLocation(program, "depth");

export function updateBrightness() {
	canvas.brightness = getBrightness(canvas);
	for (let i = surfaces.length - 1; i >= 0; i--)
		surfaces[i].brightness = getBrightness(surfaces[i]);
}

export function updateBackground(job, timestamp) {
	gl.bufferData(gl.UNIFORM_BUFFER, background.current.lighting, gl.STATIC_READ);
	if (Math.min(1, (timestamp - job.start) / job.time) >= 1 && background.children.length > 1) {
		URL.revokeObjectURL(background.old.image.src);
		background.old.remove();
		background.old = null;
	} else if (timestamp + 17 > job.end)
		job.end += 17;
}

export function updateSurfaces() {
	const monitor = {
		width  : window.innerWidth,
		height : window.innerHeight,
	}
	monitor.aw   = Math.max(1.0, monitor.width  / monitor.height);
	monitor.ah   = Math.max(1.0, monitor.height / monitor.width);
	const diff_x = background.current.aspectWidth  / monitor.aw;
	const diff_y = background.current.aspectHeight / monitor.ah;
	const min    = 1.0 / Math.min(diff_x, diff_y);
	for(let i = 0; i < surfaces.length; i++) {
		const clientRect = surfaces[i].getBoundingClientRect();
		surfaces[i].x = clientRect.x;     surfaces[i].y = clientRect.y;
		surfaces[i].w = clientRect.width; surfaces[i].h = clientRect.height;
		const rectf = {
			x : (clientRect.left   / monitor.width  *  2 - 1),
			y : (clientRect.top    / monitor.height * -2 + 1),
			w : (clientRect.right  / monitor.width  *  2 - 1),
			h : (clientRect.bottom / monitor.height * -2 + 1),
		};
		surfaces[i].rect[0] = rectf.x; surfaces[i].rect[1] = rectf.y;
		surfaces[i].rect[2] = rectf.x; surfaces[i].rect[3] = rectf.h;
		surfaces[i].rect[4] = rectf.w; surfaces[i].rect[5] = rectf.y;
		surfaces[i].rect[6] = rectf.w; surfaces[i].rect[7] = rectf.h;
	}
	canvas.width  = monitor.width;
	canvas.height = monitor.height;
	gl.viewport(0, 0,  gl.canvas.width, gl.canvas.height);
}

export function draw() {
	for (let i = 0; i < surfaces.length; i++) {
		drawSurface(surfaces[i]);
		URL.revokeObjectURL(surfaces[i].url);
		const cvs = new OffscreenCanvas(surfaces[i].w, surfaces[i].h);
		const ctx = cvs.getContext('bitmaprenderer');
		createImageBitmap(canvas, surfaces[i].x, surfaces[i].y, surfaces[i].w, surfaces[i].h).then((image) => {
			ctx.transferFromImageBitmap(image);
			cvs.convertToBlob().then((blob) => {
				surfaces[i].url   = URL.createObjectURL(blob);
				surfaces[i].style = `background-image: url(${surfaces[i].url});`;
			});
			image.close();
		});
	}
	drawSurface(canvas);

	function drawSurface(obj) {
		gl.bufferData(gl.ARRAY_BUFFER, obj.rect, gl.STATIC_DRAW);
		gl.uniform1f(bright_index, obj.brightness);
		gl.uniform1f(depth_index,  obj.depth);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
}

export function getSurfaces(element) {
	for (let i = element.children.length - 1; i > -1; i--)
		getSurfaces(element.children[i]);
	if (!element.hasOwnProperty('depth') || element === document.body)
		return;
	element.setAttribute('data-surface', `${element.length}`);
	const rect = element.getBoundingClientRect();
	surfaces.push(Object.assign(element, {
		x     : rect.x,
		y     : rect.y,
		w     : rect.width,
		h     : rect.height,
		rect  : new Float32Array(8),
		depth : element.depth,
	}));
}
