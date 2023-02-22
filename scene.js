import {monitor} from './js.js';

export class PaintObject {
	constructor(surface) {
		const canvas  = document.createElement('canvas');
		canvas.classList.add('paint');
		this.surface = surface;
		this.surface.prepend(canvas);
		this.context = canvas.getContext('webgl2', {
			depth     : false,
			alpha     : false,
			stencil   : false,
			antialias : false,
			preserveDrawingBuffer: true
		});
		this.program  = this.context.createProgram();
		const
			vShader   = this.context.createShader(this.context.VERTEX_SHADER),
			fShader   = this.context.createShader(this.context.FRAGMENT_SHADER);
		this.context.shaderSource(vShader, vs_drawLights);
		this.context.shaderSource(fShader, fs_drawLights);
		this.context.attachShader(this.program, vShader);
		this.context.attachShader(this.program, fShader);
		this.context.compileShader(vShader);
		this.context.compileShader(fShader);
		this.context.linkProgram(this.program);
		this.context.useProgram(this.program);

		this.surfaceColor = this.context.getUniformLocation(this.program, "surfaceColor");
		this.monitor = this.context.getUniformLocation(this.program, "monitor");
		this.rect = this.context.getUniformLocation(this.program, "rect");

		const aPosition = this.context.getAttribLocation(this.program, 'aPosition');
		this.context.bindBuffer(this.context.ARRAY_BUFFER, this.context.createBuffer());
		this.context.bufferData(this.context.ARRAY_BUFFER, new Float32Array([0.0,1.0, 0.0,0.0, 1.0,1.0, 1.0,0.0]), this.context.STATIC_DRAW);
	
		this.context.enableVertexAttribArray(aPosition);
		this.context.vertexAttribPointer(aPosition, 2, this.context.FLOAT, false, 0, 0);
	}
}

export function sendToAnalyze(scene) {
	const
		analyst = new Worker('./js/median_cut.js'),
		control = new AbortController(),
		signal  = control.signal;

	scene.wallpaper.addEventListener('load', () => {
		//scene.aspect = scene.wallpaper.width / scene.wallpaper.height;

		scene.aspect = [Math.max(1.0, scene.wallpaper.width / scene.wallpaper.height), Math.max(1.0, scene.wallpaper.height / scene.wallpaper.width)];
		const
			thumb = createThumbnail(scene.wallpaper),
			ctx   = thumb.getContext('2d');

		analyst.postMessage({
			width : thumb.width,
			height: thumb.height,
			image : ctx.getImageData(0, 0, thumb.width, thumb.height).data
		});
		control.abort();
	}, {signal});

	analyst.onmessage = (e) => {			
		scene.css.replaceSync(e.data.css);
		// This is done per-object because WebGL2 doesn't allow a program to be shared across contexts
		for(const object of scene.paintObjects) {
			const gl = object.context;
			gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, gl.createBuffer());
			gl.bufferData(gl.UNIFORM_BUFFER, new Float32Array(e.data.lights), gl.STATIC_DRAW);
			gl.uniformBlockBinding(object.program, gl.getUniformBlockIndex(object.program, 'lighting'), 0);
		}
		// This is only here because it contains the code that redraws the wallpaper
		// This should moved into the refresh function, but only after we stop redrawing every frame
		monitor.update(scene);
	};
}

export function refresh(scene) {
	for(const obj of scene.paintObjects) {
		const
			surface  = obj.context.canvas,
			gl = obj.context;
		surface.height = obj.surface.clientHeight;
		surface.width  = obj.surface.clientWidth;
		gl.viewport(0,0,surface.width,surface.height);
		// draws lights
		gl.uniform1f( obj.surfaceColor, Number(window.getComputedStyle(obj.surface).getPropertyValue("background-color").split(', ')[1]));
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
}

function full_refresh() {
	for(const obj of scene.paintObjects) {
		const gl = obj.context;
		// It's incorrect to compute the x and y offsets of the lights from screen's edge because the lights go off-screen
		// The wallpaper's aspect ratio needs to be taken into account.
		// Also since there's no resizable, movable surface's in the demom, position and rect never actually change in this unless the monitor is resized
		gl.uniform4fv(obj.rect, new Float32Array([obj.surface.offsetLeft, monitor.height - (obj.surface.offsetTop + gl.canvas.height), gl.canvas.width, gl.canvas.height]));
	}
	const 
		buf = new OffscreenCanvas(scene.wallpaper.width, scene.wallpaper.height),
		gl = buf.getContext('2d');
		// wallpaper = gl.createTexture();

		
	for(const workspace of monitor.workspaces) {
		workspace.canvas.width  = w;
		workspace.canvas.height = h;
		workspace.drawImage(scene.wallpaper, mx, my, mw, mh,
											0, 0, workspace.canvas.width, workspace.canvas.height);
	}
	refresh();
}

function createThumbnail2(image, limit = 64) {
    let scale = 1;
    if (image.width * image.height > limit * limit)
        scale = limit / (image.width / image.height > 1 ?  image.height : image.width);
    const
        // Dividing the dimensions by 2 and then multiplying the rounded result is intentional
        // It makes sure that the result is rounded to the nearest even number.
        // Someone smarter than me thought of this
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

// SHADER SECTION --------------------------------------------------------

const OKLAB_to_SRGB = `
    vec3 OKLAB_to_SRGB(vec3 OKLAB) {
        vec3 LMS = mat3(
            1.0000000000,  1.0000000000, 1.0000000000, 
            0.3963377774, -0.1055613458,-0.0894841775, 
            0.2158037573, -0.0638541728,-1.2914855480) * OKLAB;
        vec3 RGB = mat3(
             4.0767416621, -1.2684380046, -0.0041960863,
            -3.3077115913,  2.6097574011, -0.7034186147,
             0.2309699292, -0.3413193965,  1.7076147010) * pow(LMS, vec3(3.0));
        return mix(1.055 * pow(RGB, vec3(1.0/2.4)) - 0.055, RGB * 12.92, lessThanEqual(RGB, vec3(0.0031308)));
    }`;

const SRGB_to_OKLAB = `
    vec3 SRGB_to_OKLAB(vec3 sRGB) {
        vec3 RGB = mix(pow((sRGB + 0.055) / 1.055, vec3(2.4)), sRGB / 12.92, lessThanEqual(sRGB,vec3(0.04045)));
        vec3 LMS = mat3(
             0.4122214708,  0.2119034982, 0.0883024619, 
             0.5363325363,  0.6806995451, 0.2817188376, 
             0.0514459929,  0.1073969566, 0.6299787005) * RGB;
        return mat3(
             0.2104542553,  1.9779984951, 0.0259040371,
             0.7936177850, -2.4285922050, 0.7827717662,
            -0.0040720468,  0.4505937099,-0.8086757660) * (sign(LMS) * pow(abs(LMS), vec3(0.3333333333333)));
    }`;

const fs_drawLights = `#version 300 es
	precision mediump float;
	in float brightness;
	in vec2 uv;
	${OKLAB_to_SRGB}
	struct light {
		vec4 pos_color;
		vec4 intensity;
	};
	layout(std140) uniform lighting {
		light lights[6];
	};
	layout(location = 0) out vec4 Output;
	void main() {
		float i_acc  = 0.0;
		vec2  ab_acc = vec2(0.0, 0.0);
		for (int i = 0; i < 6; i++) {
			float intensity = lights[i].intensity.x / pow(distance(uv, lights[i].pos_color.xy), 2.0);
			i_acc  += intensity;
			ab_acc += intensity * lights[i].pos_color.ab;
		}
		Output = vec4(OKLAB_to_SRGB(vec3(brightness, ab_acc / i_acc)),1.0);
	}`

const vs_drawLights = `#version 300 es
	precision mediump float;
	in      vec2  aPosition;
	uniform float surfaceColor;
	uniform vec4  rect;
	uniform vec4  monitor;
	out     float brightness;
	out     vec2  uv;
	${SRGB_to_OKLAB}
	void main() {
		vec2 s = monitor.zw / rect.zw;
		vec2 t = rect.xy / monitor.zw;
		uv = aPosition;
		brightness  = SRGB_to_OKLAB(vec3(surfaceColor / 255.0)).r;
		gl_Position = vec4((uv - t) * s * 2.0 - 1.0, 0.0, 1.0);
	}`;

const vs_drawWallpaper = `#version 300 es
	precision mediump float;
	in      vec2  aPosition;
	uniform vec4  wallpaperArea;
	uniform vec4  monitor;
	out     vec2 uv;
	void main() {
		vec2 s = monitor.zw / rect.zw;
		vec2 t = rect.xy / monitor.zw;
		gl_Position = vec4((uv - t) * s * 2.0 - 1.0, 0.0, 1.0);
	}`;

const fs_drawWallpaper = `#version 300 es
	precision mediump float;
	in      vec2  aPosition;
	uniform float surfaceColor;
	uniform vec4  rect;
	uniform vec4  monitor;
	void main() {
		vec2 s = monitor.zw / rect.zw;
		vec2 t = rect.xy / monitor.zw;
		gl_Position = vec4((uv - t) * s * 2.0 - 1.0, 0.0, 1.0);
	}`;