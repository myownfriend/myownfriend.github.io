export class WebGL2 {
     constructor(vertexShader, fragmentShader, offscreen = {
            enable:false,
            width : 0,
            height :0
        }) {
         const canvas  = offscreen.enable ? new OffscreenCanvas(offscreen.width, offscreen.height) : document.createElement('canvas') ;
         this.context = canvas.getContext('webgl2', {
             depth     : false,
             alpha     : false,
             stencil   : false,
             antialias : false,
             preserveDrawingBuffer: true
         });
         this.program = this.context.createProgram();
         const
             vShader = this.context.createShader(this.context.VERTEX_SHADER),
             fShader = this.context.createShader(this.context.FRAGMENT_SHADER);
         this.context.shaderSource(vShader, vertexShader);
         this.context.shaderSource(fShader, fragmentShader);
         this.context.attachShader(this.program, vShader);
         this.context.attachShader(this.program, fShader);
         this.context.compileShader(vShader);
         this.context.compileShader(fShader);
         this.context.linkProgram(this.program);
         this.context.useProgram(this.program);
     
         const aPosition = this.context.getAttribLocation(this.program, 'aPosition');
         this.context.bindBuffer(this.context.ARRAY_BUFFER, this.context.createBuffer());
         this.context.bufferData(this.context.ARRAY_BUFFER, new Float32Array([0.0,1.0, 0.0,0.0, 1.0,1.0, 1.0,0.0]), this.context.STATIC_DRAW);
     
         this.context.enableVertexAttribArray(aPosition);
         this.context.vertexAttribPointer(aPosition, 2, this.context.FLOAT, false, 0, 0);
    }
}

// SHADER SECTION --------------------------------------------------------

export const OKLAB_to_SRGB = `
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

export const SRGB_to_OKLAB = `
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

export const vs_drawLights = `#version 300 es
	precision mediump float;
	in      vec2  aPosition;
	uniform float surfaceColor;
	uniform vec4  rect;
	uniform vec4  monitor;
	uniform vec4  wallpaper;
	out     float brightness;
	out     vec2  uv;
	${SRGB_to_OKLAB}
	void main() {
		float scale = (monitor.x > wallpaper.x) ? wallpaper.x /  monitor.x : wallpaper.y /  monitor.y;
		vec2  scaled = monitor.xy * scale;
		vec2  crop   = scaled.xy / wallpaper.xy;
		vec2  offset = (1.0 - crop) / 2.0;

		vec2  s = monitor.zw / rect.zw;
		vec2  t = rect.xy / monitor.zw;

		uv = aPosition;

		brightness  = SRGB_to_OKLAB(vec3(surfaceColor / 255.0)).r;
		gl_Position = vec4((uv - t) * s * 2.0 - 1.0, 0.0, 1.0);
	}`;

export const fs_drawLights = `#version 300 es
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

// Hopefully we'll be able to use the other vertex shader entirely or almost entirely
export const vs_drawWallpaper = `#version 300 es
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

export const fs_drawWallpaper = `#version 300 es
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