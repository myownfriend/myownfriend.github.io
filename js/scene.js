"use strict";
import {support} from './support.js';

const surfaces   = new Array();
const analyst    = new Worker('./js/median_cut.js');
const animations = {
	queue  : new Array(),
	active : false,
}
const background = Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'symbol'), {
	id      : 'background',
	old     : null,
	current : null,
});

document.body.appendChild(background);
document.body.addEventListener('change', () => {addAnimationJob(300, 'theme')});

window.addEventListener('resize', () => {
	updateSurfaces(true);
	addAnimationJob(0, 'redraw');
});

function addAnimationJob(length, task) {
	animations.queue.push({
	   start : performance.now(),
	   type  : task,
	   time  : length,
	   end   : performance.now() + length,
	});
	if (animations.active)
		return;
	animations.active = true;
	window.requestAnimationFrame(refresh);

	function refresh(timestamp) {
		let redraw = false;
		for (let a = 0; a < animations.queue.length; a++) {
			const job = animations.queue[a];
			switch (job.type) {
				case 'theme' :
					for (let s = surfaces.length - 1; s >= 0; s--)
						surfaces[s].uniform1f(surfaces[s].brightness, getBrightness(surfaces[s].canvas));
					redraw = true;
					break;
				case 'background':
					if (Math.min(1, (timestamp - job.start) / job.time) >= 1 && background.children.length > 1) {
						URL.revokeObjectURL(background.old.image.src);
						background.old.remove();
						background.old = null;
						redraw = true;
					} else if (timestamp + 17 > job.end)
						job.end += 17;
					break;
				case 'redraw':
					redraw = true;
			}
			if (job.end < window.performance.now()) {
				animations.queue.splice(a, 1);
				a--;
			}
		}
		if (redraw)
			for (let s = 0; s < surfaces.length; s++)
				surfaces[s].drawArrays(surfaces[s].TRIANGLE_STRIP, 0, 4);
		if (!animations.queue.length)
			return animations.active = false;
		window.requestAnimationFrame(refresh);
	}
}

function updateSurfaces(full = false) {
	const monitor = {
		width  : document.documentElement.clientWidth,
		height : document.documentElement.clientHeight,
	}
	monitor.aw = Math.max(1.0, monitor.width  / monitor.height);
	monitor.ah = Math.max(1.0, monitor.height / monitor.width);
	const diff_x = background.current.aspectWidth  / monitor.aw;
	const diff_y = background.current.aspectHeight / monitor.ah;
	const min    = 1.0 / Math.min(diff_x, diff_y);
	const scaled = {
		x  : 1.0 / (monitor.width  * -1.0),
		y  : 1.0 / (monitor.height *  1.0),
		w  : monitor.width  * diff_x * min,
		h  : monitor.height * diff_y * min,
	}
	for(let i = 0; i < surfaces.length; i++) {
		const clientRect = surfaces[i].canvas.getBoundingClientRect();
		if (full) {
			surfaces[i].canvas.height = clientRect.height * window.devicePixelRatio;
			surfaces[i].canvas.width  = clientRect.width  * window.devicePixelRatio;
			surfaces[i].viewport(0, 0,  surfaces[i].canvas.width, surfaces[i].canvas.height);
		}
		const rect = {
			x : scaled.x * (((clientRect.width  >> 1) + clientRect.x) / monitor.width  * -1.0 + 0.5),
			y : scaled.y * (((clientRect.height >> 1) + clientRect.y) / monitor.height *  1.0 - 0.5),
			w : monitor.width  / clientRect.width  * diff_x * min, // scaled.w / clientRect.width ,
			h : monitor.height / clientRect.height * diff_y * min, // scaled.h / clientRect.height,
		};
		const transform = {
			px : ( 1.0 + rect.x) * rect.w, py : ( 1.0 + rect.y) * rect.h,
			nx : (-1.0 + rect.x) * rect.w, ny : (-1.0 + rect.y) * rect.h,
		}
		surfaces[i].bufferData(surfaces[i].ARRAY_BUFFER, new Float32Array([
			transform.nx, transform.py, transform.nx, transform.ny,
			transform.px, transform.py, transform.px, transform.ny
		]), surfaces[i].STATIC_DRAW);
	}
}

var getBrightness = function (obj) {
	const val = (window.getComputedStyle(obj).getPropertyValue("background-color").split(', ')[1] | 0) / 255;
	const abs = Math.abs(val);
	return Math.cbrt((abs >= 0.04045) ? (val < 0 ? -1 : 1) * Math.pow((abs + 0.055) / 1.055, 2.2) : val / 12.92);
}
if (support.customCSSProperties)
	getBrightness = function (obj) {
		return window.getComputedStyle(obj).getPropertyValue("--brightness");
	}

export function createSurface(surface) {
	const canvas = document.createElement('canvas');
	surface.prepend(canvas);
	const gl = canvas.getContext('webgl2', {
			depth     : false,
			alpha     : false,
			stencil   : false,
			antialias : false,
			desynchronized : true,
			preserveDrawingBuffer: true,
			powerPreference : "low-power",
	});
	const program = gl.createProgram();
	const vShader = gl.createShader(gl.VERTEX_SHADER);
	const fShader = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(vShader, `#version 300 es
		precision mediump float;
		in   vec2 pos;
		in   vec2 luv;
		out  vec2 lxy;
		void main() {
			lxy = luv;
			gl_Position = vec4(pos.xy, 1.0, 1.0);
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
		//uniform float depth;
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
				float intensity = lights[i].color.x / pow(distance(lxy, lights[i].pos.xy), 2.0);
				in_acc += intensity;
				ab += intensity * lights[i].color.ab;
			}
			ab /= in_acc;
			color = vec4(OKLAB_to_SRGB(vec3(brightness, ab)),1.0);
		}`);
	gl.attachShader(program, vShader);
	gl.attachShader(program, fShader);
	gl.compileShader(vShader);
	gl.compileShader(fShader);
	gl.linkProgram(program);
	gl.useProgram(program);
	gl.depthFunc(gl.NEVER);

	const luv = gl.getAttribLocation(program, 'luv');
	gl.enableVertexAttribArray(luv);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.vertexAttribPointer(luv, 2, gl.FLOAT, false, 0, 0);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0]), gl.STATIC_DRAW);

	const pos = gl.getAttribLocation(program, 'pos');
	gl.enableVertexAttribArray(pos);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

	gl.brightness = gl.getUniformLocation(program, "brightness");
	gl.bindBufferBase(gl.UNIFORM_BUFFER, gl.getUniformBlockIndex(program, "lighting"), gl.createBuffer());
	surfaces.push(gl);
}

export async function setBackground(file = null) {
	if (file === null) {
		file = await fetch('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQvOY1r/+BiOh/AAA=')
		.then(res  => res.blob())
		.then(blob => blob);
	} else if (!support.filetypes.includes(file.type))
		return;
	const newbg = Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'image'), {
		image : new Image()
	});
	newbg.image.src = URL.createObjectURL(file);
	newbg.image.addEventListener('load', () => {
		newbg.aspectWidth  = Math.max(1.0, newbg.image.width  / newbg.image.height);
		newbg.aspectHeight = Math.max(1.0, newbg.image.height / newbg.image.width );
		newbg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
		newbg.setAttribute('href'  , newbg.image.src);
		newbg.setAttribute('width' , '100%');
		createImageBitmap(newbg.image, {
			resizeWidth:  newbg.aspectWidth  * 64,
			resizeHeight: newbg.aspectHeight * 64,
		}).then((image) => {
			analyst.postMessage(image, [image]);
		});
	});
	analyst.onmessage = (e) => {
		newbg.lighting = e.data.lights;
		for(let i = 0; i < surfaces.length; i++)
			surfaces[i].bufferData(surfaces[i].UNIFORM_BUFFER, e.data.lights, surfaces[i].STATIC_READ);
		background.old = background.current;
		background.current = newbg;
		background.appendChild(newbg);
		updateSurfaces();
		addAnimationJob(300, 'background');
	};
}