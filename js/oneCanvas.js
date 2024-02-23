const namespace = "http://www.w3.org/2000/svg";
const svg = Object.assign(document.createElementNS(namespace, 'svg'), {id:"masks"});
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

				gl.canvas.appendChild(svg);

				window.background = gl.canvas.appendChild(Object.assign(document.createElementNS(namespace, 'symbol'), {
					id : 'background', old : null, current : null,
					set: (() => {
						const analyst = new Worker('./js/median_cut.js');
						return (file) => {
							const bg = document.createElementNS(namespace, 'image');
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

window.draw = (element) => {
	if (element.hasOwnProperty('depth')) {
		const rect = element.getBoundingClientRect();
		const w_center = rect.width  / 2;
		const h_center = rect.height / 2;
		rect.bot  = innerHeight - rect.bottom;
		rect.top2 = innerHeight - rect.top;

		const rectv = new Float32Array(8);
		rectv[0] = rectv[2] = rect.left  / innerWidth  *  2 - 1;
		rectv[4] = rectv[6] = rect.right / innerWidth  *  2 - 1;
		rectv[3] = rectv[7] = rect.bot   / innerHeight *  2 - 1;
		rectv[1] = rectv[5] = rect.top2  / innerHeight *  2 - 1;

		if (element.hasOwnProperty('mask')) {
			element.mask.setAttribute('x', rect.left);
			element.mask.setAttribute('y', rect.top - 32);
			element.mask.setAttribute('height', rect.height);
			element.mask.setAttribute('width' , rect.width );
		}
		gl.bufferData(gl.ARRAY_BUFFER, rectv, gl.STATIC_DRAW);
		gl.uniform4fv(size, [
			(rect.left + w_center) * devicePixelRatio,
			(rect.bot  + h_center) * devicePixelRatio,
			w_center * devicePixelRatio,
			h_center * devicePixelRatio
		]);
		const val = (getComputedStyle(element).getPropertyValue("background-color").split(', ')[1] | 0) / 255;
		const abs = Math.abs(val);
		gl.uniform1f(radius, Number(getComputedStyle(element).getPropertyValue('border-radius').split('px')[0] * devicePixelRatio));
		gl.uniform1f(bright, Math.cbrt((abs >= 0.04045) ? ((val >= 0) - (val < 0)) * Math.pow((abs + 0.055) / 1.055, 2.2) : val / 12.92));
		gl.uniform1f(depth , element.depth);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
	for (const child of element.children) {
		draw(child);
	}
}

window.update = (graph) => {
	gl.canvas.width  = innerWidth  * devicePixelRatio;
	gl.canvas.height = innerHeight * devicePixelRatio;
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	draw(graph);
}

window.updateBackground = () => {
	gl.bufferData(gl.UNIFORM_BUFFER, background.current.lighting, gl.STATIC_READ);
}

window.createMask = (element) => {
	const mask = svg.appendChild(Object.assign(document.createElementNS(namespace,'mask'), {id:`${element.id}-mask`}));
	mask.appendChild(document.createElementNS(namespace, 'rect'));
	return mask.appendChild(document.createElementNS(namespace, 'rect'));
}