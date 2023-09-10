"use strict";
const objs        = [];
const animation_state = {
	active : false,
	end    : window.performance.now()
}
const analyst     = new Worker('./js/median_cut.js');
const mon_aspect  = {
	width  : 1.0,
	height : 1.0,
}
const bg_aspect   = {
	width  : 1.0,
	height : 1.0,
};
const scale       = new Float32Array(2);
const css         = new CSSStyleSheet();
const bg_stage    = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
bg_stage.id = 'background';

document.body.appendChild(bg_stage);
document.adoptedStyleSheets = [css];
document.body.addEventListener('change', () => {
	update(300);
});

window.addEventListener('resize', () => {
	const width       = document.documentElement.clientWidth;
	const height      = document.documentElement.clientHeight;
	mon_aspect.width  = Math.max(1.0, width  / height);
	mon_aspect.height = Math.max(1.0, height / width);
	aspectRatioChanged();
	const center_x = width  / 2.0;
	const center_y = height / 2.0;
	// This doesn't need to happen for most canvases on resize
	// For the most part, only the stage canvas changes shape on resize
	// So lets just do this for the stage for now
	objs[0].ctx.canvas.height = objs[0].ctx.canvas.parentElement.clientHeight;
	objs[0].ctx.canvas.width  = objs[0].ctx.canvas.parentElement.clientWidth;
	objs[0].ctx.viewport(0, 0, objs[0].ctx.canvas.width, objs[0].ctx.canvas.height);
	// On resize, all elements change their and x and y offsets and there size changes in
	// relation to the rest of the screen so we need to do this per-item
	for(let i = 0; i < objs.length; i++) {
		objs[i].ctx.uniform4fv(objs[i].rect, [
			(objs[i].ctx.canvas.parentElement.offsetLeft + (objs[i].ctx.canvas.parentElement.offsetWidth  / 2.0) -  center_x) / width  * -2.0,
			(objs[i].ctx.canvas.parentElement.offsetTop  + (objs[i].ctx.canvas.parentElement.offsetHeight / 2.0) -  center_y) / height *  2.0,
			width  / objs[i].ctx.canvas.parentElement.offsetWidth,
			height / objs[i].ctx.canvas.parentElement.offsetHeight
		]);
	}
	update();
});

analyst.onmessage = (e) => {
	css.replaceSync(e.data.css);
	bg_aspect.width  = e.data.aspect[0];
	bg_aspect.height = e.data.aspect[1];
	for(let i = 0; i < objs.length; i++) {
		objs[i].ctx.uniform2fv(objs[i].background, e.data.aspect);
		objs[i].ctx.uniform1i(objs[i].light_length, e.data.light_length);
		objs[i].ctx.bufferData(objs[i].ctx.UNIFORM_BUFFER, e.data.lights, objs[i].ctx.STATIC_READ);
	}
	bg_stage.lastChild.setAttribute('opacity', '1');
	if (bg_stage.childNodes.length > 1) {
		URL.revokeObjectURL(bg_stage.firstChild.getAttribute('href'));
		bg_stage.firstChild.remove();
	}
	aspectRatioChanged();
	update();
};

function aspectRatioChanged() {
	const diff_x   = bg_aspect.width  / mon_aspect.width;
	const diff_y   = bg_aspect.height / mon_aspect.height;
	const min      = 1.0 / Math.min(diff_x, diff_y);
	scale[0]       = diff_x * min;
	scale[1]       = diff_y * min;
	// This would be global if we could do global uniforms
	// We can't so we update each surface indifidually
	for(let i = 0; i < objs.length; i++)
		objs[i].ctx.uniform2fv(objs[i].scale, scale);
}

function update(length = 0) {
	const end = window.performance.now() + length;
	if (end > animation_state.end)
		animation_state.end = end;
	if (animation_state.active)
		return;
	animation_state.active = true;
	window.requestAnimationFrame(refresh);

	function refresh(timestamp) {
		for (let i = 0; i < objs.length; i++) {
			const val = (window.getComputedStyle(objs[i].ctx.canvas).getPropertyValue("background-color").split(', ')[1] | 0) / 255;
			const abs = Math.abs(val);
			objs[i].ctx.uniform1f(objs[i].brightness, Math.cbrt((abs >= 0.04045) ? (val < 0 ? -1 : 1) * Math.pow((abs + 0.055) / 1.055, 2.2) : val / 12.92));
			objs[i].ctx.drawArrays(objs[i].ctx.TRIANGLE_STRIP, 0, 4);
		}
		if (timestamp > animation_state.end)
			return animation_state.active = false;
		window.requestAnimationFrame(refresh);
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
		in      mediump vec2  vPosition;
		uniform mediump vec4  rect;
		uniform mediump vec2  global_scale;
		uniform mediump vec2  background;
		out     mediump vec2  lxy;
		void main() {
			lxy = vPosition * background;
			gl_Position = vec4((vPosition + rect.xy) * (global_scale * rect.zw), 1.0, 1.0);
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
			float i_acc  = 0.0;
			vec2  ab_acc = vec2(0.0, 0.0);
			for (int i = 0; i < length; i++) {
				float intensity = lights[i].intensity.x / pow(distance(lxy, lights[i].pos_color.xy), 2.0);
				i_acc  += intensity;
				ab_acc += intensity * lights[i].pos_color.ab;
			}
			color = vec4(OKLAB_to_SRGB(vec3(brightness, ab_acc / i_acc)),1.0);
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
	data.ctx.bindBuffer(data.ctx.ARRAY_BUFFER, data.ctx.createBuffer());
	data.ctx.bufferData(data.ctx.ARRAY_BUFFER, new Float32Array([-1.0,1.0, -1.0,-1.0, 1.0,1.0, 1.0,-1.0]), data.ctx.STATIC_DRAW);
	data.ctx.enableVertexAttribArray(vPosition);
	data.ctx.vertexAttribPointer(vPosition, 2, data.ctx.FLOAT, false, 0, 0);
	data.ctx.bindBufferBase(data.ctx.UNIFORM_BUFFER, data.ctx.getUniformBlockIndex(program, "lighting"), data.ctx.createBuffer());
	data.background   = data.ctx.getUniformLocation(program, "background");
	data.scale        = data.ctx.getUniformLocation(program, "global_scale");
	data.light_length = data.ctx.getUniformLocation(program, "length");
	data.brightness   = data.ctx.getUniformLocation(program, "brightness");
	data.rect         = data.ctx.getUniformLocation(program, "rect");
	objs.push(data);
}

export async function setBackground(file = null) {
	const allowedFiletypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/jxl"];
	if (file === null) {
		file = await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACXBIWXMAAAsTAAALEwEAmpwYAAAACklEQVQIHWOoBAAAewB6N1xddAAAAABJRU5ErkJggg==')
		.then(res => res.blob())
		.then(blob => blob);
		window.dispatchEvent(new Event("resize"));
	} else if (!allowedFiletypes.includes(file.type))
		return;
	const new_background = document.createElementNS('http://www.w3.org/2000/svg', 'image');
	new_background.setAttribute('preserveAspectRatio', 'xMidYMid slice');
	new_background.setAttribute('height', '100%');
	new_background.setAttribute('width' , '100%');
	new_background.setAttribute('opacity' , '0');

	const temp = new Image();
	temp.src = URL.createObjectURL(file);
	temp.addEventListener('load', () => {
		new_background.setAttribute('href', temp.src);
		createImageBitmap(new_background).then((background) => {
			analyst.postMessage(background, [background]);
		});
	})
	bg_stage.appendChild(new_background);
}