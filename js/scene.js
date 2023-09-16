"use strict";
import {support} from './support.js';

const surfaces   = [];
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
		for (let i = 0; i < animations.queue.length; i++) {
			const job = animations.queue[i];
			switch (job.type) {
				case 'theme' :
					for (let i = 0; i < surfaces.length; i++)
						surfaces[i].ctx.uniform1f(surfaces[i].brightness, getBrightness(surfaces[i].ctx.canvas));
					redraw = true;
					break;
				case 'background':
					const opacity = Math.min(1, (timestamp - job.start) / job.time);
					if (opacity >= 1 && background.children.length > 1) {
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
				animations.queue.splice(i, 1);
				i--;
			}
		}
		if (redraw)
			for (let i = 0; i < surfaces.length; i++)
				surfaces[i].ctx.drawArrays(surfaces[i].ctx.TRIANGLE_STRIP, 0, 4);
		if (!animations.queue.length)
			return animations.active = false;
		window.requestAnimationFrame(refresh);
	}
}

function getBrightness(obj) {
	if (support.customCSSProperties)
		return window.getComputedStyle(obj).getPropertyValue("--brightness");
	const val = (window.getComputedStyle(obj).getPropertyValue("background-color").split(', ')[1] | 0) / 255;
	const abs = Math.abs(val);
	return Math.cbrt((abs >= 0.04045) ? (val < 0 ? -1 : 1) * Math.pow((abs + 0.055) / 1.055, 2.2) : val / 12.92);
}

function updateSurfaces(full = false) {
	const monitor = {
		width  : document.documentElement.clientWidth,
		height : document.documentElement.clientHeight,
	}
	monitor.aw = Math.max(1.0, monitor.width  / monitor.height);
	monitor.ah = Math.max(1.0, monitor.height / monitor.width);
	const diff_x = background.current.aspectW / monitor.aw;
	const diff_y = background.current.aspectH / monitor.ah;
	const min    = 1.0 / Math.min(diff_x, diff_y);
	const scaled = {
		x  : 1.0 / (monitor.width  * -1.0),
		y  : 1.0 / (monitor.height *  1.0),
		w  : monitor.width  * diff_x * min,
		h  : monitor.height * diff_y * min,
	}
	for(let i = 0; i < surfaces.length; i++) {
		const clientRect = surfaces[i].ctx.canvas.parentElement.getBoundingClientRect();
		if (full) {
			surfaces[i].ctx.canvas.height = clientRect.height * window.devicePixelRatio;
			surfaces[i].ctx.canvas.width  = clientRect.width  * window.devicePixelRatio;
			surfaces[i].ctx.viewport(0, 0,  surfaces[i].ctx.canvas.width, surfaces[i].ctx.canvas.height);
		}
		const rect = {
			x : /* scaled.x * */ ((clientRect.width  >> 1) + clientRect.x) / monitor.width  * -1.0 + 0.5,
			y : /* scaled.y * */ ((clientRect.height >> 1) + clientRect.y) / monitor.height *  1.0 - 0.5,
			w : monitor.width  / clientRect.width  * diff_x * min, // scaled.w / clientRect.width ,
			h : monitor.height / clientRect.height * diff_y * min, // scaled.h / clientRect.height,
		};
		const transform = {
			px : ( 1.0 + rect.x) * rect.w,
			py : ( 1.0 + rect.y) * rect.h,
			nx : (-1.0 + rect.x) * rect.w,
			ny : (-1.0 + rect.y) * rect.h,
		}
		surfaces[i].ctx.bufferData(surfaces[i].ctx.ARRAY_BUFFER, new Float32Array([
			transform.nx, transform.py, -1.0,  1.0,
			transform.nx, transform.ny, -1.0, -1.0,
			transform.px, transform.py,  1.0,  1.0,
			transform.px, transform.ny,  1.0, -1.0
		]), surfaces[i].ctx.STATIC_DRAW);
	}
}

export function createSurface(surface) {
	const canvas  = document.createElement('canvas');
	surface.prepend(canvas);
	const data = {
		ctx : canvas.getContext('webgl2', {
			depth     : false,
			alpha     : false,
			stencil   : false,
			antialias : false,
			desynchronized : true,
			preserveDrawingBuffer: true,
			powerPreference : "low-power",
		}),
	};
	const program = data.ctx.createProgram();
	const vShader = data.ctx.createShader(data.ctx.VERTEX_SHADER);
	const fShader = data.ctx.createShader(data.ctx.FRAGMENT_SHADER);
	data.ctx.shaderSource(vShader, `#version 300 es
		precision mediump float;
		in   vec4 vPosition;
		out  vec2 lxy;
		void main() {
			lxy = vPosition.zw;
			gl_Position = vec4(vPosition.xy, 1.0, 1.0);
		}`);
	data.ctx.shaderSource(fShader, `#version 300 es
		precision mediump float;
		precision mediump int;
		in vec2 lxy;
		struct light {
			vec4 pos;
			vec4 color;
		};
		layout(std140) uniform lighting {
			light lights[6];
		};
		uniform float brightness;
		uniform int length;
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
			for (int i = 0; i < length; i++) {
				float intensity = lights[i].color.x / pow(distance(lxy, lights[i].pos.xy), 2.0);
				in_acc += intensity;
				ab += intensity * lights[i].color.ab;
			}
			ab /= in_acc;
			color = vec4(OKLAB_to_SRGB(vec3(brightness, ab)),1.0);
		}`);
	data.ctx.attachShader(program, vShader);
	data.ctx.attachShader(program, fShader);
	data.ctx.compileShader(vShader);
	data.ctx.compileShader(fShader);
	data.ctx.linkProgram(program);
	data.ctx.useProgram(program);
	data.ctx.enable(data.ctx.DITHER);
	data.ctx.depthFunc(data.ctx.NEVER);
	const vPosition = data.ctx.getAttribLocation(program, 'vPosition');
	data.ctx.enableVertexAttribArray(vPosition);
	data.ctx.bindBuffer(data.ctx.ARRAY_BUFFER, data.ctx.createBuffer());
	data.ctx.vertexAttribPointer(vPosition, 4, data.ctx.FLOAT, false, 0, 0);
	data.light_length = data.ctx.getUniformLocation(program, "length");
	data.brightness   = data.ctx.getUniformLocation(program, "brightness");
	data.ctx.bindBufferBase(data.ctx.UNIFORM_BUFFER, data.ctx.getUniformBlockIndex(program, "lighting"), data.ctx.createBuffer());
	surfaces.push(data);
}

export async function setBackground(file = null) {
	if (file === null) {
		file = await fetch('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQvOY1r/+BiOh/AAA=')
		.then(res => res.blob())
		.then(blob => blob);
	} else if (!support.filetypes.includes(file.type))
		return;
	const temp = new Image();
	temp.src = URL.createObjectURL(file);
	temp.addEventListener('load', () => {
		URL.revokeObjectURL(temp.src);
		const newbg = Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'image'), {
			image    : temp,
			aspectW  : Math.max(1.0, temp.width  / temp.height),
			aspectH  : Math.max(1.0, temp.height / temp.width ),
		});
		newbg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
		newbg.setAttribute('href', newbg.image.src);
		newbg.setAttribute('width'  , '100%');
		newbg.setAttribute('height' , '100%');
		createImageBitmap(newbg.image, {
			resizeWidth:  newbg.aspectW * 64,
			resizeHeight: newbg.aspectH * 64,
		}).then((image) => {
			analyst.postMessage(image, [image]);
		});
		analyst.onmessage = (e) => {
			for(let i = 0; i < surfaces.length; i++) {
				surfaces[i].ctx.uniform1i(surfaces[i].light_length, e.data.light_length);
				surfaces[i].ctx.bufferData(surfaces[i].ctx.UNIFORM_BUFFER, e.data.lights, surfaces[i].ctx.STATIC_READ);
			}
			background.old = background.current;
			background.current = newbg;
			background.appendChild(newbg);
			updateSurfaces();
			addAnimationJob(300, 'background');
		};
	})
}