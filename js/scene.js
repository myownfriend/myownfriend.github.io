"use strict";
const filetypes  = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml" , "image/jxl"];
const surfaces   = [];
const analyst    = new Worker('./js/median_cut.js');
const css        = new CSSStyleSheet();
const animations = {
	queue  : new Array(),
	active : false,
}
const background = {
	stage :  document.createElementNS('http://www.w3.org/2000/svg', 'symbol'),
	aw    :  1.0,
	ah    :  1.0,
	nw    : -1.0,
	nh    : -1.0,
}
background.stage.id = 'background';
background.stage.appendChild(document.createElement('image'));

document.body.appendChild(background.stage);
document.adoptedStyleSheets = [css];
document.body.addEventListener('change', () => {addAnimationJob(300, 'theme')});

window.addEventListener('resize', () => {
	surfaces[0].ctx.canvas.height = surfaces[0].ctx.canvas.parentElement.clientHeight;
	surfaces[0].ctx.canvas.width  = surfaces[0].ctx.canvas.parentElement.clientWidth;
	surfaces[0].ctx.viewport(0, 0, surfaces[0].ctx.canvas.width, surfaces[0].ctx.canvas.height);
	updateSurfaces();
	addAnimationJob(0, 'redraw');
});

analyst.onmessage = (e) => {
	css.replaceSync(e.data.css);
	for(let i = 0; i < surfaces.length; i++) {
		surfaces[i].ctx.uniform1i(surfaces[i].light_length, e.data.light_length);
		surfaces[i].ctx.bufferData(surfaces[i].ctx.UNIFORM_BUFFER, e.data.lights, surfaces[i].ctx.STATIC_READ);
	}
	if (background.aw != e.data.aspect[0] && background.ah != e.data.aspect[1]) {
		background.aw = e.data.aspect[0];
		background.ah = e.data.aspect[1];
		background.nw = e.data.aspect[0] * -1.0;
		background.nh = e.data.aspect[1] * -1.0;
		updateSurfaces();
	}
	addAnimationJob(300, 'background');
};

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
					for (let i = 0; i < surfaces.length; i++) {
						const val = (window.getComputedStyle(surfaces[i].ctx.canvas).getPropertyValue("background-color").split(', ')[1] | 0) / 255;
						const abs = Math.abs(val);
						surfaces[i].ctx.uniform1f(surfaces[i].brightness, Math.cbrt((abs >= 0.04045) ? (val < 0 ? -1 : 1) * Math.pow((abs + 0.055) / 1.055, 2.2) : val / 12.92));
					}
					redraw = true;
					break;
				case 'background':
					const opacity = Math.min(1, (timestamp - job.start) / job.time);
					background.stage.lastChild.setAttribute('opacity', opacity);
					if (opacity >= 1) {
						while (background.stage.children.length > 1) {
							URL.revokeObjectURL(background.stage.firstChild.getAttribute('href'));
							background.stage.firstChild.remove();
						}
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

function updateSurfaces() {
	const monitor = {
		width  : document.documentElement.clientWidth,
		height : document.documentElement.clientHeight,
	}
	monitor.aw = Math.max(1.0, monitor.width  / monitor.height);
	monitor.ah = Math.max(1.0, monitor.height / monitor.width);
	const diff_x = background.aw / monitor.aw;
	const diff_y = background.ah / monitor.ah;
	const min    = 1.0 / Math.min(diff_x, diff_y);
	const scaled = {
		x  : monitor.width  * -1.0,
		y  : monitor.height,
		w  : monitor.width  * diff_x * min,
		h  : monitor.height * diff_y * min,
	}
	for(let i = 0; i < surfaces.length; i++) {
		const rect = {
			x : (((surfaces[i].ctx.canvas.parentElement.offsetWidth  >> 1) + surfaces[i].ctx.canvas.parentElement.offsetLeft) / scaled.x) + 0.5,
			y : (((surfaces[i].ctx.canvas.parentElement.offsetHeight >> 1) + surfaces[i].ctx.canvas.parentElement.offsetTop ) / scaled.y) - 0.5,
			w : scaled.w / surfaces[i].ctx.canvas.parentElement.offsetWidth ,
			h : scaled.h / surfaces[i].ctx.canvas.parentElement.offsetHeight,
		};
		const transform = {
			px : ( 1.0 + rect.x) * rect.w,
			py : ( 1.0 + rect.y) * rect.h,
			nx : (-1.0 + rect.x) * rect.w,
			ny : (-1.0 + rect.y) * rect.h,
		}
		surfaces[i].ctx.bufferData(surfaces[i].ctx.ARRAY_BUFFER, new Float32Array([
			transform.nx, transform.py, background.nw, background.aw,
			transform.nx, transform.ny, background.nw, background.nw,
			transform.px, transform.py, background.aw, background.aw,
			transform.px, transform.ny, background.aw, background.nw
		]), surfaces[i].ctx.STATIC_DRAW);
	}
}

export function createLights(surface) {
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
			vec4 pos_color;
			vec4 intensity;
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
			vec2  ab_acc = vec2(0.0, 0.0);
			for (int i = 0; i < length; i++) {
				float intensity = lights[i].intensity.x / pow(distance(lxy, lights[i].pos_color.xy), 2.0);
				in_acc += intensity;
				ab_acc += intensity * lights[i].pos_color.ab;
			}
			color = vec4(OKLAB_to_SRGB(vec3(brightness, ab_acc / in_acc)),1.0);
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
		updateSurfaces();
	} else if (!filetypes.includes(file.type) || file.name === background.stage.firstChild.getAttribute('name'))
		return;
	const new_background = document.createElementNS('http://www.w3.org/2000/svg', 'image');
	new_background.setAttribute('name',file.name)
	new_background.setAttribute('preserveAspectRatio', 'xMidYMid slice');
	new_background.setAttribute('opacity' , '0');
	const temp = new Image();
	temp.src = URL.createObjectURL(file);
	temp.addEventListener('load', () => {
		new_background.setAttribute('href', temp.src);
		createImageBitmap(new_background).then((background) => {
			analyst.postMessage(background, [background]);
		});
	})
	background.stage.appendChild(new_background);
}