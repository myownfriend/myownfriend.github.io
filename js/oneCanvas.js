const canvas = Object.assign(document.createElement('canvas'), { depth : 1.0,
	rect  : new Float32Array([-1.0,  1.0, -1.0, -1.0, 1.0,  1.0, 1.0, -1.0])
});
document.body.prepend(canvas);
const gl = canvas.getContext('webgl2', {
	depth     : false,
	stencil   : false,
	antialias : false,
	desynchronized : true,
	colorSpace : 'display-p3',
	preserveDrawingBuffer: true,
	powerPreference : "low-power",
});
const program = gl.createProgram();
for (const s of [{type:gl.VERTEX_SHADER,
	sh: `#version 300 es
	precision mediump float;
	in   vec2 vPosition;
	out  vec2 lxy;
	void main() {
		lxy         = vPosition.xy;
		gl_Position = vec4(vPosition.xy, 1.0, 1.0);
	}`}, {type: gl.FRAGMENT_SHADER,
		sh:`#version 300 es
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
		}`}]) {
	const shader = gl.createShader(s.type);
	gl.shaderSource(shader, s.sh);
	gl.compileShader(shader);
	gl.attachShader(program, shader);
};
gl.linkProgram(program);
gl.useProgram(program);
gl.depthFunc(gl.NEVER);
const vPosition = gl.getAttribLocation(program, 'vPosition');
gl.enableVertexAttribArray(vPosition);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
gl.bindBufferBase(gl.UNIFORM_BUFFER, gl.getUniformBlockIndex(program, "lighting"), gl.createBuffer());
const bright_index = gl.getUniformLocation(program, "brightness");
const depth_index  = gl.getUniformLocation(program, "depth");

window.updateBrightness = () => {
	canvas.brightness = getBrightness(canvas);
	for (const surface of surfaces)
		surface.brightness = getBrightness(surface.canvas);
}

window.updateBackground = () => {
	gl.bufferData(gl.UNIFORM_BUFFER, background.current.lighting, gl.STATIC_READ);
	updateSurfaces();
}

window.updateSurfaces = () => {
/*  const diff_x = background.current.aspectWidth  / Math.max(1.0, innerWidth  / innerHeight);
	const diff_y = background.current.aspectHeight / Math.max(1.0, innerHeight / innerWidth );
	const min    = 1.0 / Math.min(diff_x, diff_y); */
	for(const surface of surfaces) {
		const clientRect = surface.canvas.getBoundingClientRect();
		surface.canvas.width  = clientRect.width;
		surface.canvas.height = clientRect.height;
		const rectfx = (clientRect.left   / innerWidth  *  2 - 1);
		const rectfy = (clientRect.top    / innerHeight * -2 + 1);
		const rectfw = (clientRect.right  / innerWidth  *  2 - 1);
		const rectfh = (clientRect.bottom / innerHeight * -2 + 1);
		surface.rect[0] = rectfx; surface.rect[1] = rectfy;
		surface.rect[2] = rectfx; surface.rect[3] = rectfh;
		surface.rect[4] = rectfw; surface.rect[5] = rectfy;
		surface.rect[6] = rectfw; surface.rect[7] = rectfh;
	}
	canvas.width  = innerWidth;
	canvas.height = innerHeight;
	gl.viewport(0, 0,  canvas.width, canvas.height);
}

window.draw = () => {
	for (const surface of surfaces) {
		drawSurface(surface);
		const rect = surface.canvas.getBoundingClientRect();
		surface.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
	}
	drawSurface(canvas);
	function drawSurface(obj) {
		gl.bufferData(gl.ARRAY_BUFFER, obj.rect, gl.STATIC_DRAW);
		gl.uniform1f(bright_index, obj.brightness);
		gl.uniform1f(depth_index,  obj.depth);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
}

window.getSurfaces = (element) => {
	for (const child of element.children)
		getSurfaces(child);
	if (element.hasOwnProperty('depth') && element.localName != 'canvas' && element.localName != 'body') {
		const gl = document.createElement('canvas').getContext('2d');
		element.prepend(gl.canvas);
		surfaces.push(Object.assign(gl, { rect: new Float32Array(8), depth: element.depth}));
	}
}