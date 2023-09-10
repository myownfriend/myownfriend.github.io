"use strict";
const objs = [];
const analyst    = new Worker('./js/median_cut.js');
const aspect     = {
	width  : 1.0,
	height : 1.0,
};
const css         = new CSSStyleSheet();
const bg_stage    = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
bg_stage.id = 'background';

document.body.appendChild(bg_stage);
document.adoptedStyleSheets = [css];
document.body.addEventListener('change', () => {
	update(300);
});

window.addEventListener('resize', () => {
	const width    = document.documentElement.clientWidth;
	const height   = document.documentElement.clientHeight;
	const center_x = width  / 2.0;
	const center_y = height / 2.0;
	const diff_x   = aspect.width  / Math.max(1.0, width / height);
	const diff_y   = aspect.height / Math.max(1.0, height / width);
	const min      = 1.0 / Math.min(diff_x, diff_y);
	const scale    = new Float32Array([diff_x * min, diff_y * min]);
	for(let i = 0; i < objs.length; i++) {
		objs[i].ctx.canvas.height = objs[i].ctx.canvas.parentElement.clientHeight;
		objs[i].ctx.canvas.width  = objs[i].ctx.canvas.parentElement.clientWidth;
		objs[i].ctx.uniform2fv(objs[i].scale, scale);
		objs[i].ctx.uniform4fv(objs[i].rect, [
			(objs[i].ctx.canvas.parentElement.offsetLeft + (objs[i].ctx.canvas.parentElement.offsetWidth  / 2.0) -  center_x) / width  * -2.0,
			(objs[i].ctx.canvas.parentElement.offsetTop  + (objs[i].ctx.canvas.parentElement.offsetHeight / 2.0) -  center_y) / height *  2.0,
			width  / objs[i].ctx.canvas.parentElement.offsetWidth,
			height / objs[i].ctx.canvas.parentElement.offsetHeight
		]);
		objs[i].ctx.viewport(0, 0, objs[i].ctx.canvas.width, objs[i].ctx.canvas.height);
	}
	update();
});

analyst.onmessage = (e) => {
	css.replaceSync(e.data.css);
	aspect.width  = e.data.aspect[0];
	aspect.height = e.data.aspect[1];
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
	window.dispatchEvent(new Event("resize"));
	update();
};

const animation_state = {
	active : false,
	end    : window.performance.now()
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
			objs[i].ctx.uniform1f(objs[i].brightness, getSurfaceBrightness(objs[i].ctx.canvas));
			objs[i].ctx.drawArrays(objs[i].ctx.TRIANGLE_STRIP, 0, 4);
		}
		if (timestamp > animation_state.end)
			return animation_state.active = false;
		window.requestAnimationFrame(refresh);
	}

	function getSurfaceBrightness(surface) {
		const val = (window.getComputedStyle(surface).getPropertyValue("background-color").split(', ')[1] | 0) / 255;
		const abs = Math.abs(val);
		return Math.cbrt((abs >= 0.04045) ? (val < 0 ? -1 : 1) * Math.pow((abs + 0.055) / 1.055, 2.2) : val / 12.92);
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
	data.rect = data.ctx.getUniformLocation(program, "rect");
	data.background = data.ctx.getUniformLocation(program, "background");
	data.scale = data.ctx.getUniformLocation(program, "global_scale");
	data.brightness = data.ctx.getUniformLocation(program, "brightness");
	data.light_length = data.ctx.getUniformLocation(program, "length");
	const vPosition = data.ctx.getAttribLocation(program, 'vPosition');
	data.ctx.bindBuffer(data.ctx.ARRAY_BUFFER, data.ctx.createBuffer());
	data.ctx.bufferData(data.ctx.ARRAY_BUFFER, new Float32Array([-1.0,1.0, -1.0,-1.0, 1.0,1.0, 1.0,-1.0]), data.ctx.STATIC_DRAW);
	data.ctx.enableVertexAttribArray(vPosition);
	data.ctx.vertexAttribPointer(vPosition, 2, data.ctx.FLOAT, false, 0, 0);
	data.ctx.bindBufferBase(data.ctx.UNIFORM_BUFFER, data.ctx.getUniformBlockIndex(program, "lighting"), data.ctx.createBuffer());
	objs.push(data);
}

export async function setBackground(file = null) {
	const allowedFiletypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/jxl"];
	if (file === null) {
		file = await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACXBIWXMAAAsTAAALEwEAmpwYAAAACklEQVQIHWOoBAAAewB6N1xddAAAAABJRU5ErkJggg==')
		.then(res => res.blob())
		.then(blob => blob);
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