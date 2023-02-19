import {monitor} from './js.js';
import {OKLAB_to_SRGB, SRGB_to_OKLAB} from './shaders.js';

export class PaintObject {
	constructor(surface) {
		this.surface = surface;

		this.canvas  = document.createElement('canvas');
		this.canvas.classList.add('paint');
		this.surface.prepend(this.canvas);

		this.context = this.canvas.getContext('webgl2', {
			depth     : false,
			alpha     : false,
			stencil   : false,
			antialias : false,
			preserveDrawingBuffer: true
		});
		this.program  = this.context.createProgram();
		const
			vShader  = this.context.createShader(this.context.VERTEX_SHADER),
			fShader  = this.context.createShader(this.context.FRAGMENT_SHADER);

		// wScale  = document.documentElement.clientWidth  / rect.width,
		// hScale  = document.documentElement.clientHeight / rect.height,
		// xOffset = rect.x / document.documentElement.clientWidth,
		// yOffset = 1 - ((rect.y + rect.height) / document.documentElement.clientHeight),


		this.context.shaderSource(vShader, `#version 300 es
			precision mediump float;
			in      vec2  aPosition;
			uniform float surfaceColor;
			// uniform vec4  rect;
			uniform vec4  extra;
			out     float brightness;
			out     vec2  uv;
			${SRGB_to_OKLAB}
			void main() {
				uv = aPosition;// * extra.xy;
				brightness  = SRGB_to_OKLAB(vec3(surfaceColor / 255.0)).r;
				gl_Position = mat4(
					 2.0,  0.0,  0.0, 0.0,
					 0.0,  2.0,  0.0, 0.0,
					 0.0,  0.0,  1.0, 0.0,
					-1.0, -1.0,  0.0, 1.0) * vec4(uv, 0.0, 1.0);
			}`);
		this.context.shaderSource(fShader, `#version 300 es
			precision mediump float;
			in float brightness;
			in vec2 uv;
			${OKLAB_to_SRGB}
			struct light {
				vec4  pos_color; // x, y, b, a
				vec4 intensity;
			};
			layout(std140) uniform lighting {
				light lights[6];
			};
			layout(location = 0) out vec4 Output;
			void main() {
				float i_acc   = 0.0;
				vec2  ab_acc  = vec2(0.0, 0.0);
				for (int i = 0; i < 6; i++) {
					float intensity = lights[i].intensity.x / pow(distance(uv, lights[i].pos_color.xy), 2.0);
					i_acc  += intensity;
					ab_acc += intensity * lights[i].pos_color.ab;
				}
				vec3 OKLAB = vec3(brightness, ab_acc / i_acc);
				Output = vec4(OKLAB_to_SRGB(OKLAB),1.0);
			}`);
		this.context.attachShader(this.program, vShader);
		this.context.attachShader(this.program, fShader);
		this.context.compileShader(vShader);
		this.context.compileShader(fShader);
		this.context.linkProgram(this.program);
		this.context.useProgram(this.program);
	}
}

export function refresh(scene) {
	for(const object of scene.paintObjects) {
		const
			surface    = object.canvas,
			container  = object.surface.getBoundingClientRect();
		surface.height = container.height;
		surface.width  = container.width;
		object.context.viewport(0,0,surface.width,surface.height);
		drawLights(scene, object);
	}
}

function drawLights(scene, obj) {
	const
		gl      = obj.context,
		rect    = obj.surface.getBoundingClientRect(),
		wScale  = document.documentElement.clientWidth  / rect.width,
		hScale  = document.documentElement.clientHeight / rect.height,
		xOffset = rect.x / document.documentElement.clientWidth,
		yOffset = 1 - ((rect.y + rect.height) / document.documentElement.clientHeight),
		ubObj   = [];

	for (const light of scene.lights)
		ubObj.push(
			(light.x - xOffset) * wScale,
			(light.y - yOffset) * hScale,
			// light.x, light.y,
			light.b, light.a,
			light.i,     0.0,     0.0,    0.0);

	gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, gl.createBuffer());
	gl.bufferData(gl.UNIFORM_BUFFER, new Float32Array(ubObj), gl.STATIC_DRAW);
	gl.uniformBlockBinding(obj.program, gl.getUniformBlockIndex(obj.program, 'lighting'), 0);

	// If an alternative method of transforming the light position to the viewport is found,
	// the any code after this may be the only data that needs be resent every frame
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, 0.0]), gl.STATIC_DRAW);

	const aPosition = gl.getAttribLocation(obj.program, 'aPosition');
	gl.enableVertexAttribArray(aPosition);
	gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
	// If we don't need to send a new mesh every frame then THI
	// is the only stuff that needs to be redone each frame
	// gl.uniform4fv(gl.getUniformLocation(obj.program, "rect" ), new Float32Array([rect.x, rect.y, rect.width, rect.height]));
	gl.uniform4fv(gl.getUniformLocation(obj.program, "extra"), new Float32Array([scene.aspect[0], scene.aspect[1],document.documentElement.clientWidth,document.documentElement.clientHeight]));
	gl.uniform1f( gl.getUniformLocation(obj.program, "surfaceColor"), Number(window.getComputedStyle(obj.surface).getPropertyValue("background-color").split(', ')[1]));
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

export function set_background(scene) {
	const
		analyst = new Worker('./js/median_cut.js'),
		control = new AbortController(),
		signal  = control.signal;

	scene.wallpaper.addEventListener('load', () => {

		const aspect = scene.wallpaper.width / scene.wallpaper.height;
		scene.aspect = [1,1];
		if(aspect > 1)
			scene.aspect[0] *= aspect;
		else
			scene.aspect[1] /= aspect;

		const
			thumb = createThumbnail(scene.wallpaper),
			ctx   = thumb.getContext('2d');

		analyst.postMessage({
			width : thumb.width,
			height: thumb.height,
			image : ctx.getImageData(0, 0, thumb.width, thumb.height).data
		});

		monitor.update(scene);
		control.abort();
	}, {signal});

	analyst.onmessage = (e) => {			
		scene.lights = e.data.lights;

		scene.stage.dark  = Math.min(e.data.lum * e.data.sat, 0.25615);
		scene.stage.light = Math.max(e.data.lum * (1 - e.data.sat), 1 - 0.25615);

		refresh(scene);
	};
}


function createThumbnail2(image, limit = 64) {
	/*
	 There might be a way to do the conversion from sRGB to OKLAB on the GPU
	 then pass the render target to JS as an array. This should be quicker
	 than converting pixels one at a time with JS.
	 */
    let scale = 1;
    if (image.width * image.height > limit * limit)
        scale = limit / (image.width / image.height > 1 ?  image.height : image.width);

    const
        // Dividing the dimensions by 2 and then multiplying the rounded result is intentional
        // It makes sure that the result is rounded to the nearest even number.
        // Someone smarter than me thought of this
		// I'm not sure if this is strictly needed but made the media cut code fail less often
        buf = new OffscreenCanvas(2 * Math.round(image.width * scale / 2), 2 * Math.round(image.height * scale / 2)),
        ctx = buf.getContext('2d');
        ctx.drawImage(image, 0, 0, buf.width, buf.height);
    return buf;
}

function createThumbnail(image, limit = 64) {
    // THIS IS A FAKE FUNCTION FOR TESTING MEDIAN CUT
    const
        buf = new OffscreenCanvas(192 / 2, 128 / 2),
        ctx = buf.getContext('2d');
        ctx.drawImage(image, 0, 0, buf.width, buf.height);
    return buf;
}