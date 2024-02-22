const gl = document.createElement('canvas').getContext('webgl2', {
	depth     : false,
	stencil   : false,
	antialias : false,
	desynchronized : true,
	colorSpace : 'display-p3',
	preserveDrawingBuffer: true,
	powerPreference : "low-power",
});
document.body.prepend(gl.canvas);
const program = gl.createProgram();
for (const s of [{type:gl.VERTEX_SHADER,
	sh: `#version 300 es
	precision mediump float;
	in   vec4 vPosition;
	out  vec2 lxy;
	out  vec2 q; //
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
		uniform vec4  size;
		uniform float radius;
		uniform float brightness;
		uniform float depth;
		out vec4 color;
		void main() {
			vec2 q = abs(gl_FragCoord.xy - size.xy) - size.zw + radius;
			float alpha = 1.0 - (min(max(q.x, q.y), 0.0) + distance(max(q, vec2(0.0)), vec2(0.0)) - radius);
			if (alpha > 0.0) {
				float in_acc = 0.0;
				vec2  ab = vec2(0.0, 0.0);
				for (int i = length - 1; i >= 0; i--) {
					float distance  = distance(vec3(lxy, depth), lights[i].pos.xyz);
					float intensity = lights[i].color.x / (distance * distance);
					ab += intensity * lights[i].color.ab;
					in_acc += intensity;
				}
				ab /= in_acc;
				vec3 LMS = mat3(
					1.0000000000,  1.0000000000, 1.0000000000,
					0.3963377774, -0.1055613458,-0.0894841775,
					0.2158037573, -0.0638541728,-1.2914855480) * vec3(brightness, ab);
				vec3 RGB = mat3(
					4.0767245293, -1.2681437731, -0.0041119885,
					-3.3072168827, 2.6093323231, -0.7034763098,
					0.2307590544, -0.3411344290,  1.7068625689) * pow(LMS, vec3(3.0));
				vec3 sRGB = mix(1.055 * pow(RGB, vec3(1.0/2.2)) - 0.055, RGB * 12.92, lessThanEqual(RGB, vec3(0.0031308)));
				color = vec4(sRGB, alpha);
			}
		}`}]) {
	const shader = gl.createShader(s.type);
	gl.shaderSource(shader, s.sh);
	gl.compileShader(shader);
	gl.attachShader(program, shader);
};
gl.linkProgram(program);
gl.useProgram(program);
gl.depthFunc(gl.NEVER);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
const vPosition = gl.getAttribLocation(program, 'vPosition');
gl.enableVertexAttribArray(vPosition);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
gl.bindBufferBase(gl.UNIFORM_BUFFER, gl.getUniformBlockIndex(program, "lighting"), gl.createBuffer());
const size   = gl.getUniformLocation(program, "size");
const radius = gl.getUniformLocation(program, "radius");
const bright = gl.getUniformLocation(program, "brightness");
const depth  = gl.getUniformLocation(program, "depth");

const svg = gl.canvas.appendChild(Object.assign(document.createElementNS("http://www.w3.org/2000/svg", 'svg'), {id:"masks"}));

window.background = gl.canvas.appendChild(Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'symbol'), {
	id : 'background', old : null, current : null,
	set: (() => {
		const analyst = new Worker('./js/median_cut.js');
		return (file) => {
			const bg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
			bg.image = new Image();
			bg.image.src = URL.createObjectURL(file);
			bg.image.addEventListener('load', () => {
				bg.aw = Math.max(1.0, bg.image.width  / bg.image.height);
				bg.ah = Math.max(1.0, bg.image.height / bg.image.width );
				bg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
				bg.setAttribute('href' , bg.image.src);
				bg.setAttribute('width', '100%');
				createImageBitmap(bg.image, {
					resizeWidth : bg.aw * 64,
					resizeHeight: bg.ah * 64,
				}).then((image) => {
					analyst.postMessage(image, [image]);
				});
			}, { once: true });
			analyst.onmessage = (e) => {
				bg.lighting = e.data.lights;
				background.old = background.current;
				background.current = bg;
				background.appendChild(bg);
				addAnimation(300, updateBackground, ()=> {
					if (background.children.length > 1) {
						URL.revokeObjectURL(background.old.image.src);
						background.old.remove();
						background.old = null;
					}
				});
			};
		}
	})()
}));

window.draw = () => {
	for (const surface of surfaces) {
		gl.bufferData(gl.ARRAY_BUFFER, surface.rect, gl.STATIC_DRAW);
		gl.uniform4f(size  , surface.size[0], surface.size[1], surface.size[2], surface.size[3]);
		gl.uniform1f(radius, surface.radius);
		gl.uniform1f(bright, surface.brightness);
		gl.uniform1f(depth , surface.depth);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
}

window.getSurfaces = (element) => {
	for (const child of element.children)
		getSurfaces(child);
	if (element.hasOwnProperty('depth')) {
		if (element.hasOwnProperty('mask')) {
			const mask = svg.appendChild(Object.assign(document.createElementNS("http://www.w3.org/2000/svg",'mask'), {id:`${element.id}-mask`}));
			mask.appendChild(document.createElementNS("http://www.w3.org/2000/svg", 'rect'));
			element.mask = mask.appendChild(document.createElementNS("http://www.w3.org/2000/svg", 'rect'));
		}
		surfaces.push(Object.assign(element, {rect: new Float32Array(8), depth: element.depth}));
	}
}

window.updateSurfaces = () => {
	for(const surface of surfaces) {
		const rect = surface.getBoundingClientRect();
		const w_center = rect.width  / 2;
		const h_center = rect.height / 2;
		rect.bot  = innerHeight - rect.bottom;
		rect.top2 = innerHeight - rect.top;
		surface.radius = Number(getComputedStyle(surface).getPropertyValue('border-radius').split('px')[0] * devicePixelRatio);
		surface.size   = [(rect.left + w_center) * devicePixelRatio, (rect.bot  + h_center) * devicePixelRatio, w_center * devicePixelRatio, h_center * devicePixelRatio];
		surface.rect[0] = surface.rect[2] = rect.left  / innerWidth  *  2 - 1;
		surface.rect[4] = surface.rect[6] = rect.right / innerWidth  *  2 - 1;
		surface.rect[3] = surface.rect[7] = rect.bot   / innerHeight *  2 - 1;
		surface.rect[1] = surface.rect[5] = rect.top2  / innerHeight *  2 - 1;

		if (surface.hasOwnProperty('mask')) {
			surface.mask.setAttribute('x', rect.left);
			surface.mask.setAttribute('y', rect.top - 32);
			surface.mask.setAttribute('height', surface.clientHeight);
			surface.mask.setAttribute('width' , surface.clientWidth );
		}
	}
	gl.canvas.width  = innerWidth  * devicePixelRatio;
	gl.canvas.height = innerHeight * devicePixelRatio;
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}

window.updateBackground = () => {
	const diff_x = background.current.aw / Math.max(1.0, background.current.ah);
	const diff_y = background.current.ah / Math.max(1.0, background.current.aw);
	const min    = 1.0 / Math.min(diff_x, diff_y);
	gl.bufferData(gl.UNIFORM_BUFFER, background.current.lighting, gl.STATIC_READ);
}

window.changeLighting = () => {
	/*
		Might be better to store the new light list
		in the list_old and old light list in the list_new
		then slowly transition list_new into the new list.
	*/
 	const newL = background.current.lighting;
	const oldL = background.old.lighting;
	const size = 6 * 8;

	for (let i = 0; i < size; i += 8) {
		oldL[i + 0] += newL[i + 0];
		oldL[i + 1] += newL[i + 1];
		oldL[i + 2] += newL[i + 2];
		oldL[i + 4] += newL[i + 4];
		oldL[i + 6] += newL[i + 6];
		oldL[i + 7] += newL[i + 7];
	}
}
window.updateBrightness = () => {
	for (const surface of surfaces)
		surface.brightness = getBrightness(surface);
}