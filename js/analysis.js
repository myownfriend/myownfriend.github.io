"use strict";
const COLOR_MAX_DEPTH = 3;
const SPACE_MAX_DEPTH = 3;
const MAX_DEPTH       = COLOR_MAX_DEPTH + SPACE_MAX_DEPTH;
const LAST_PARENT     = MAX_DEPTH - 1;
const LEAF            = MAX_DEPTH | 0x80;
const MAX_LIGHTS      = 6;
const MAX_RANGES      = {
    color : 0.2, // cuts off saturation
    space : 1.0
};
const gl = new OffscreenCanvas(64, 64).getContext('webgl2', {
     depth     : false,
     alpha     : false,
     stencil   : false,
     antialias : false,
     preserveDrawingBuffer: true,
});
const program    = gl.createProgram();
const vShader    = gl.createShader(gl.VERTEX_SHADER);
const fShader    = gl.createShader(gl.FRAGMENT_SHADER);
const thumbnail  = gl.createTexture();
const rgbaBuffer = gl.createFramebuffer();

let THRESHOLD = 1;

gl.shaderSource(vShader, `#version 300 es
	precision mediump float;
	in      vec2  vPosition;
	in      vec2  tuv;
	out     vec2  uv;
	void main() {
		uv  = tuv;
		gl_Position = vec4(vPosition, 0.0, 1.0);
	}`);
gl.shaderSource(fShader, `#version 300 es
	precision mediump float;
	in vec2 uv;
	uniform sampler2D wallpaper;
	out vec4 color;
	void main() {
		vec3 tex = texture(wallpaper, uv).rgb;
		vec3 RGB = mix(pow((tex + 0.055) / 1.055, vec3(2.4)), tex / 12.92, lessThanEqual(tex,vec3(0.04045)));	
		vec3 LMS = mat3(0.4121656120, 0.2118591070, 0.0883097947,
						0.5362752080, 0.6807189584, 0.2818474174,
						0.0514575653, 0.1074065790, 0.6302613616) * RGB;
		vec3 LAB = mat3(
				0.2104542553,  1.9779984951, 0.0259040371,
				0.7936177850, -2.4285922050, 0.7827717662,
			   -0.0040720468,  0.4505937099,-0.8086757660) * pow(LMS, vec3( 1.0 / 3.0));
		color = vec4(LAB, 1.0);
	}`);
gl.attachShader(program, vShader);
gl.attachShader(program, fShader);
gl.compileShader(vShader);
gl.compileShader(fShader);
gl.linkProgram(program);
gl.useProgram(program);

gl.getExtension("EXT_color_buffer_float");

const uv         = gl.getAttribLocation(program, 'tuv');
const vPosition  = gl.getAttribLocation(program, 'vPosition');

gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0,1.0, -1.0,-1.0, 1.0,1.0, 1.0,-1.0]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(vPosition);
gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.0,1.0, 0.0,0.0, 1.0,1.0, 1.0,0.0]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(uv);
gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);

gl.activeTexture(gl.TEXTURE1);
gl.bindTexture(gl.TEXTURE_2D, thumbnail);

gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.FLOAT, null);

gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

gl.bindFramebuffer(gl.FRAMEBUFFER, rgbaBuffer);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, thumbnail, 0);

onmessage = (e) => {
	const scene = {
		lights       : new Float32Array(8 * MAX_LIGHTS),
		aspect       : new Float32Array([Math.max(1.0, e.data.width  / e.data.height), Math.max(1.0, e.data.height / e.data.width)]),
	};

	const scale = Math.min(1, 32 / Math.min(e.data.width, e.data.height));
	const start = performance.now();

	gl.canvas.width  = e.data.width  * scale;
	gl.canvas.height = e.data.height * scale;

	gl.activeTexture(gl.TEXTURE1);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.FLOAT, null);
	gl.activeTexture(gl.TEXTURE0);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, e.data.width, e.data.height, 0, gl.RGB, gl.UNSIGNED_BYTE, e.data);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	const pixels = new Float32Array(gl.canvas.width * gl.canvas.height * 4);
	gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.FLOAT, pixels);

	const tree_start = performance.now();

	const brightness = {
      min : 1,
      max : 0,
      top : 0.5,
      contrast: 0,
      quad: [
        { count:0, amount: 0},
        { count:0, amount: 0},
        { count:0, amount: 0},
        { count:0, amount: 0}
	]}; // How many dark pixels, how many bright, and average brightness
    const inc   = { x : scene.aspect[0] / gl.canvas.width * 2, y : scene.aspect[1] / gl.canvas.height * 2 };
    const range = { x_start : scene.aspect[0] * -1, y_start : scene.aspect[1] };
	const root  = { meta  : 0x0, a : 0.0, b : 0.0, x : 0.0, y : 0.0 };

	// we want to treat the wallpaper like it's always a square so that there's square splits
	MAX_RANGES.space = scene.aspect[0] * scene.aspect[1];

	//console.clear();

    for (let ox = 0, y = range.y_start, len = pixels.length; ox < len; y -= inc.y)
        for(let x = range.x_start, line_end = gl.canvas.width * 4 + ox; ox < line_end; ox += 4, x += inc.x) {
			space_insert({ a : pixels[ox + 1] , b : pixels[ox + 2] , x : x , y : y }, root);
			const bxy = (x > 0.5) << 1 | y > 0.5;
			brightness.quad[bxy].amount += pixels[ox];
			brightness.quad[bxy].count++;
			if (pixels[ox] > brightness.max)
				brightness.max = pixels[ox];
			else if (pixels[ox] < brightness.min)
				brightness.min = pixels[ox];
		}

	const gather_start = performance.now();

	console.log(root);
	
	const lights = gather_lights(root, gl.canvas.width * gl.canvas.height / MAX_LIGHTS);

/* 	console.log(root);
    console.log(`It took ${tree_start - start}ms to create the thumbnail,
	${gather_start - tree_start}ms to create the quadtrees,
	${performance.now() - gather_start}ms to gather lights.`); */
	
	//color_to_console(lights);

	scene.css = get_top_bar_brightness(brightness);
	scene.light_length = Math.min(8, lights.length);
	for (let i = 0, c = 0; c < scene.light_length; i += 8, c++) {
		scene.lights[i + 0] = lights[c].x; // x
		scene.lights[i + 1]	= lights[c].y; // y
		scene.lights[i + 2]	= lights[c].b; // b
		scene.lights[i + 3]	= lights[c].a; // a
		scene.lights[i + 4]	= lights[c].i; // intensity
		scene.lights[i + 5]	= 0; // padding
		scene.lights[i + 6]	= 0; // padding
		scene.lights[i + 7]	= 0; // padding
	}
	postMessage(scene);
}

function color_to_console(colors) {
	for (const color of colors)
        console.log(`%cx : ${color.x}, y : ${color.y}
	a : ${color.a}, b : ${color.b}
	intensity :  ${color.i}`, `display:block; text-align:center; width: ${100}%; background-color: oklab(50% ${color.a}  ${color.b})`);
}

function color_insert(pixel, node) {
	if (node.meta < 0x80) {
		const next_depth = 1 + node.meta;
		const diff       = MAX_RANGES.color / (1 << next_depth);
		const diff2      = diff * 2.0;
		const offset     = {
				a : node.a - diff,
				b : node.b - diff
			};
		node.children = new Array(4);
		node.meta |= 0x80;
		for (let i = 0; i < 4; i++)
			node.children[i] = {
				meta : next_depth,
				a    : offset.a + (i >>  1) * diff2,
				b    : offset.b + (i & 0x1) * diff2,
				x    : 0.0,
				y    : 0.0
			};
	}
	const next_child = node.children[((pixel.a > node.a) << 1) | (pixel.b > node.b)];
	if ((next_child.meta & 0x7F) === COLOR_MAX_DEPTH)
		return hex_insert(pixel, next_child);
	color_insert(pixel, next_child);
}

function space_insert(pixel, node) {
	if (node.meta < 0x80) {
		const next_depth = 1 + node.meta;
		const diff       = MAX_RANGES.space / (1 << next_depth);
		const diff2      = diff * 2.0;
		const offset     = {
				x : node.x - diff,
				y : node.y - diff
			};
		node.children = new Array(4);
		node.meta    |= 0x80;
		for(let i = 0; i < 4; i++)
			node.children[i] = {
				meta : next_depth,
				a    : 0.0,
				b    : 0.0,
				x    : offset.x + (i >>  1) * diff2,
				y    : offset.y + (i & 0x1) * diff2
			};
	}
	const next_child = node.children[((pixel.x > node.x) << 1) | (pixel.y > node.y)];
	if ((next_child.meta & 0x7F) !== MAX_DEPTH)
		return space_insert(pixel, next_child);
	next_child.a += pixel.a;
	next_child.b += pixel.b;
	next_child.meta += 0x80;
}

function gather_lights(node, threshold) {
	const parents = [node];
	const lights  = [];
	const states  = new Int8Array(MAX_DEPTH);
	let depth = 0;
	let	light = {
			a : 0,
			b : 0,
			x : 0,
			y : 0
		};
	let accumulator = 0;
	do {
		const parent   = parents[depth];
		const children = parent.children;
		const child    = children[states[depth]];
		if (states[depth] >= children.length - 1) {
			states[depth] = 0;
			depth--;
			continue;
		}
		states[depth]++;
		if (child.meta < 0x80)
			continue;
		if (depth < LAST_PARENT) {
			depth++;
			parents[depth] = child;
			continue;
		}		
		light.a     += child.a;
		light.b     += child.b;
		light.x     += child.x;
		light.y     += child.y;
		accumulator += child.meta >> 7;
		if (accumulator >= threshold) {
			light.a /= accumulator;
			light.b /= accumulator;
			light.x /= accumulator;
			light.y /= accumulator;
			//if (Math.sqrt(light.a ** 2 + light.b ** 2) > 0.025)
				lights.push({
					a : light.a,
					b : light.b,
					x : light.x,
					y : light.y,
					i : accumulator / threshold
				});
			light.a = 0;
			light.b = 0;
			light.x = 0;
			light.y = 0;
			accumulator = 0;	
		}
	} while (depth >= 0)
	return lights;
}

function get_top_bar_brightness(brightness) {
	for(const quad of brightness.quad)
		quad.amount /= quad.count;

	brightness.top      = (brightness.quad[1].amount + brightness.quad[3].amount) / 2;
	brightness.contrast = 1- (brightness.max - brightness.min);

	const dark  = okLtoR(Math.min(brightness.top, 0.25615)) * 255;
	const light = okLtoR(Math.max(1.0 - brightness.top, 1 - 0.25615)) * 255;
	
	//console.log(`The background brightness at the top is is ${brightness.top} and the background's contrast is ${brightness.contrast}.`);
	function okLtoR(okL) {
		const l = okL ** 3;
		if (l  <= 0.0031308)
			return l ** 3;
		return 1.055 * Math.pow(l, 1/2.4) - 0.055;
	}

	//return {light: 1 - brightness.top, dark: brightness.top}

	return `#dark-mode  body.desktop {background-color: rgb(${dark} ${dark} ${dark})} #light-mode body.desktop {background-color: rgb(${light} ${light} ${light})}`;
}