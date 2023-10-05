"use strict";
window.updateBrightness = () => {
	for (let i = surfaces.length - 1; i >= 0; i--)
		surfaces[i].uniform1f(surfaces[i].brightness, getBrightness(surfaces[i].canvas));
}

window.updateBackground = () => {
	for (let i = surfaces.length - 1; i >= 0; i--)
		surfaces[i].bufferData(surfaces[i].UNIFORM_BUFFER, background.current.lighting, surfaces[i].STATIC_READ);
	updateSurfaces();
}

window.updateSurfaces = () => {
	const monitor = {
		width  : innerWidth,
		height : innerHeight,
	}
	monitor.aw    = Math.max(1.0, monitor.width     / monitor.height);
	monitor.ah    = Math.max(1.0, monitor.height    / monitor.width);
	const diff_x  = background.current.aspectWidth  / monitor.aw;
	const diff_y  = background.current.aspectHeight / monitor.ah;
	const min     = 1.0 / Math.min(diff_x, diff_y);
	const ratio   = {
		x  : 1.0 / (monitor.width  * -1.0),
		y  : 1.0 / (monitor.height *  1.0),
		w  : monitor.width  * diff_x * min,
		h  : monitor.height * diff_y * min,
	}
	for(let i = 0; i < surfaces.length; i++) {
		const clientRect = surfaces[i].canvas.getBoundingClientRect();
		surfaces[i].canvas.height = clientRect.height * devicePixelRatio;
		surfaces[i].canvas.width  = clientRect.width  * devicePixelRatio;
		surfaces[i].viewport(0, 0,  surfaces[i].canvas.width, surfaces[i].canvas.height);
		const rect = {
			x : ratio.x * (((clientRect.width  >> 1) + clientRect.x) / monitor.width  * -1.0 + 0.5),
			y : ratio.y * (((clientRect.height >> 1) + clientRect.y) / monitor.height *  1.0 - 0.5),
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

window.draw = () => {
	for (let i = 0; i < surfaces.length; i++)
		surfaces[i].drawArrays(surfaces[i].TRIANGLE_STRIP, 0, 4);
}

window.getSurfaces = (element) => {
	for (let i = element.children.length - 1; i > -1; i--)
		getSurfaces(element.children[i]);

	if (element.hasOwnProperty('depth')) {
		const gl = document.createElement('canvas').getContext('webgl2', {
				depth     : false,
				stencil   : false,
				antialias : false,
				desynchronized : true,
				colorSpace : 'display-p3',
				preserveDrawingBuffer: true,
				powerPreference : "low-power",
		});
		element.prepend(gl.canvas);
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
		gl.uniform1f(gl.getUniformLocation(program, "depth"), element.depth);
		gl.bindBufferBase(gl.UNIFORM_BUFFER, gl.getUniformBlockIndex(program, "lighting"), gl.createBuffer());

		surfaces.push(gl);
	}
}