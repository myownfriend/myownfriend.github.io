window.updateBrightness = () => {
	for (const surface of surfaces)
		surface.uniform1f(surface.brightness, getBrightness(surface.canvas));
}

window.updateBackground = () => {
	for (const surface of surfaces)
		surface.bufferData(surface.UNIFORM_BUFFER, background.current.lighting, surface.STATIC_READ);
	updateSurfaces();
}

window.updateSurfaces = () => {
	const aw      = Math.max(1.0, innerWidth  / innerHeight);
	const ah      = Math.max(1.0, innerHeight / innerWidth );
	const diff_x  = background.current.aw / aw;
	const diff_y  = background.current.ah / ah;
	const min     = 1.0 / Math.min(diff_x, diff_y);
	const ratio   = {
		x  : 1.0 / (innerWidth  * -1.0),
		y  : 1.0 / (innerHeight *  1.0),
		w  : innerWidth  * diff_x * min,
		h  : innerHeight * diff_y * min,
	};
	for (const surface of surfaces) {
		const clientRect = surface.canvas.getBoundingClientRect();
		surface.canvas.height = clientRect.height * devicePixelRatio;
		surface.canvas.width  = clientRect.width  * devicePixelRatio;
		surface.viewport(0, 0,  surface.canvas.width, surface.canvas.height);
		const rectx = ratio.x * (((clientRect.width  >> 1) + clientRect.x) / innerWidth  * -1.0 + 0.5);
		const recty = ratio.y * (((clientRect.height >> 1) + clientRect.y) / innerHeight *  1.0 - 0.5);
		const rectw = innerWidth  / clientRect.width  * diff_x * min; // scaled.w / clientRect.width ,
		const recth = innerHeight / clientRect.height * diff_y * min; // scaled.h / clientRect.height,
		const px = ( 1.0 + rectx) * rectw;
		const py = ( 1.0 + recty) * recth;
		const nx = (-1.0 + rectx) * rectw;
		const ny = (-1.0 + recty) * recth;
		surface.bufferData(surface.ARRAY_BUFFER, new Float32Array([
			nx, py, nx, ny,
			px, py, px, ny
		]), surface.STATIC_DRAW);
	}
}

window.draw = () => {
	for (const surface of surfaces)
		surface.drawArrays(surface.TRIANGLE_STRIP, 0, 4);
}

window.getSurfaces = (element) => {
	for (const child of element.children)
		getSurfaces(child);

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
		const clientRect = gl.canvas.getBoundingClientRect();
		gl.canvas.height = clientRect.height * devicePixelRatio;
		gl.canvas.width  = clientRect.width  * devicePixelRatio;
		gl.viewport(0, 0,  gl.canvas.width, gl.canvas.height);
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