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

const svg = document.createElement('svg');
svg.appendChild(bg_stage);
document.body.appendChild(svg);
document.adoptedStyleSheets = [css];
document.body.addEventListener('change', () => {
	update(300);
});

setBackground();

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

analyst.onmessage = (e) => {
	css.replaceSync(e.data.css);
	aspect.width  = e.data.aspect[0];
	aspect.height = e.data.aspect[1];
	for(let i = 0; i < objs.length; i++) {
		objs[i].context.uniform2fv(objs[i].background, e.data.aspect);
		objs[i].context.uniform1i(objs[i].light_length, e.data.light_length);
		objs[i].context.bufferData(objs[i].context.UNIFORM_BUFFER, e.data.lights, objs[i].context.STATIC_READ);
	}
	bg_stage.lastChild.setAttribute('opacity', '1');
	if (bg_stage.childNodes.length > 1) {
		URL.revokeObjectURL(bg_stage.firstChild.getAttribute('href'));
		bg_stage.firstChild.remove();
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
	if (end > animation_state.end)
		animation_state.end = end;
	if (animation_state.active)
		return;
	animation_state.active = true;
	window.requestAnimationFrame(refresh);

	function refresh(timestamp) {
		for (let i = 0; i < objs.length; i++) {
			objs[i].context.uniform1f(objs[i].surfaceColor, window.getComputedStyle(objs[i].context.canvas).getPropertyValue("background-color").split(', ')[1] | 0);
			objs[i].context.drawArrays(objs[i].context.TRIANGLE_STRIP, 0, 4);
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
		context : canvas.getContext('webgl2', {
			depth     : false,
			alpha     : false,
			stencil   : false,
			antialias : false,
			preserveDrawingBuffer: true,
		}),
	};
	const program = data.context.createProgram();
	const vShader = data.context.createShader(data.context.VERTEX_SHADER);
	const fShader = data.context.createShader(data.context.FRAGMENT_SHADER);
	data.context.shaderSource(vShader, `#version 300 es
		precision mediump float;
		in      vec2  vPosition;
		in      vec2  tuv;
		uniform vec4  rect;
		uniform vec2  global_scale;
		uniform vec2  background;
		uniform float surfaceColor;
		out     float brightness;
		out     vec2  luv;
		out     vec2  uv;
		vec3 SRGB_to_OKLAB(vec3 sRGB) {
			vec3 RGB = mix(pow((sRGB + 0.055) / 1.055, vec3(2.2)), sRGB / 12.92, lessThanEqual(sRGB,vec3(0.04045)));
			vec3 LMS = mat3(
					0.4122214708,  0.2119034982, 0.0883024619,
					0.5363325363,  0.6806995451, 0.2817188376,
					0.0514459929,  0.1073969566, 0.6299787005) * RGB;
			return mat3(
					0.2104542553,  1.9779984951, 0.0259040371,
					0.7936177850, -2.4285922050, 0.7827717662,
				-0.0040720468,  0.4505937099,-0.8086757660) * (sign(LMS) * pow(abs(LMS), vec3(0.3333333333333)));
		}
		void main() {
			brightness  = SRGB_to_OKLAB(vec3(surfaceColor / 255.0)).r;
			luv = vPosition * background;
			uv  = tuv;
			gl_Position = vec4((vPosition + rect.xy) * (global_scale * rect.zw), 1.0, 1.0);
		}`);
	data.context.shaderSource(fShader, `#version 300 es
		precision mediump float;
		in vec2 luv;
		in float brightness;
		uniform int length;
		struct light {
			vec4 pos_color;
			vec4 intensity;
		};
		layout(std140) uniform lighting {
			light lights[6];
		};
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
				float intensity = lights[i].intensity.x / pow(distance(luv, lights[i].pos_color.xy), 2.0);
				i_acc  += intensity;
				ab_acc += intensity * lights[i].pos_color.ab;
			}
			color = vec4(OKLAB_to_SRGB(vec3(brightness, ab_acc / i_acc)),1.0);
		}`);
	data.context.attachShader(program, vShader);
	data.context.attachShader(program, fShader);
	data.context.compileShader(vShader);
	data.context.compileShader(fShader);
	data.context.linkProgram(program);
	data.context.useProgram(program);
	data.context.enable(data.context.DITHER);
	data.rect = data.context.getUniformLocation(program, "rect");
	data.background = data.context.getUniformLocation(program, "background");
	data.scale = data.context.getUniformLocation(program, "global_scale");
	data.surfaceColor = data.context.getUniformLocation(program, "surfaceColor");
	data.light_length = data.context.getUniformLocation(program, "length");
	const vPosition = data.context.getAttribLocation(program, 'vPosition');
	data.context.bindBuffer(data.context.ARRAY_BUFFER, data.context.createBuffer());
	data.context.bufferData(data.context.ARRAY_BUFFER, new Float32Array([-1.0,1.0, -1.0,-1.0, 1.0,1.0, 1.0,-1.0]), data.context.STATIC_DRAW);
	data.context.enableVertexAttribArray(vPosition);
	data.context.vertexAttribPointer(vPosition, 2, data.context.FLOAT, false, 0, 0);
	data.context.canvas.className = 'light';
	data.context.bindBufferBase(data.context.UNIFORM_BUFFER, data.context.getUniformBlockIndex(program, "lighting"), data.context.createBuffer());
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