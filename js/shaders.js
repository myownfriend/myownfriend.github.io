export class WebGL2 {
     constructor(vertexShader, fragmentShader, offscreen = {
            enable:false,
            width : 0,
            height :0
        }) {
         const canvas  = offscreen.enable ? new OffscreenCanvas(offscreen.width, offscreen.height) : document.createElement('canvas');
         this.context = canvas.getContext('webgl2', {
            depth     : false,
            alpha     : false,
            stencil   : false,
            antialias : false,
            preserveDrawingBuffer: true,
        });
        this.program = this.context.createProgram();
        const vShader = this.context.createShader(this.context.VERTEX_SHADER);
        const fShader = this.context.createShader(this.context.FRAGMENT_SHADER);
        this.context.shaderSource(vShader, vertexShader);
        this.context.shaderSource(fShader, fragmentShader);
        this.context.attachShader(this.program, vShader);
        this.context.attachShader(this.program, fShader);
        this.context.compileShader(vShader);
        this.context.compileShader(fShader);
        this.context.linkProgram(this.program);
        this.context.useProgram(this.program);
    }
}

export const vs_clip = `#version 300 es
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
	}`;

export const fs_drawLights = `#version 300 es
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
	}`