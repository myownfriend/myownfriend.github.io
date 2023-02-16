import {monitor} from './js.js';
import {createThumbnail} from './lerp.js';

export function refresh(scene) {
	for(const object of scene.paintObjects)
		drawLights(scene, object);
}

export function set_background(scene) {
	const
		analyst = new Worker('./js/median_cut.js'),
		control = new AbortController(),
		signal  = control.signal;

	scene.wallpaper.addEventListener('load', () => {

		scene.aspect = scene.wallpaper.width / scene.wallpaper.height;

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
		// As saturation goes down, move the top bar brightness towards white or black 
		// I have no idea if this code is right. I'm tired.
		scene.stage.dark  = Math.min(e.data.lum * e.data.sat, 0.25615);
		scene.stage.light = Math.max(e.data.lum * (1 - e.data.sat), 1 - 0.25615);
	
		refresh(scene);
	};
}

export function drawLights(scene, obj) {
	const
		cvs       = obj.firstChild,
		ctx       = cvs.getContext('2d'),
		L         = toOkLabBrightness(Number(window.getComputedStyle(obj).getPropertyValue("background-color").split(', ')[1]) / 255),
		dispRect  = obj.getBoundingClientRect(),
		scalew    = document.documentElement.clientWidth / dispRect.width,
		scaleh    = document.documentElement.clientHeight / dispRect.height,
		offsetx   = dispRect.x / document.documentElement.clientWidth,
		offsety   = dispRect.y / document.documentElement.clientHeight,
		lightSize = scene.lights.length,
		lights    = structuredClone(scene.lights);

	for (const light of lights) {
		light.x = (light.x - offsetx) * scalew;
		light.y = (light.y - offsety) * scaleh;
	}

	for(let y = 0; y < cvs.height; y++) {
		const fy = y / cvs.height;
		for(let x = 0; x < cvs.width; x++) {
			const fx = x / cvs.width;
			let	i = 0, a = 0, b = 0;
			for (let l = 0; l < lightSize; l++) {
				const
					distance  = Math.sqrt(((lights[l].x - fx)) ** 2 + ((lights[l].y - fy)) ** 2),
					intensity = distance == 0 ? lights[l].i : lights[l].i / distance ** 2;
				i += intensity;
				a += intensity * lights[l].a;
				b += intensity * lights[l].b;
			}
			const
				OKLAB = [L / 1, a / i, b / i],
				l = (1 * OKLAB[0] + 0.3963377774 * OKLAB[1] + 0.2158037573 * OKLAB[2]) ** 3,
				m = (1 * OKLAB[0] - 0.1055613458 * OKLAB[1] - 0.0638541728 * OKLAB[2]) ** 3,
				s = (1 * OKLAB[0] - 0.0894841775 * OKLAB[1] - 1.2914855480 * OKLAB[2]) ** 3,
				rgb = [
					+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
					-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
					-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
				];
			ctx.fillStyle = `rgb(${toSRGB(rgb[0]) * 255} ${toSRGB(rgb[1]) * 255} ${toSRGB(rgb[2]) * 255})`;
			ctx.fillRect(x, y, 1, 1);
		}
	}

	function toSRGB(i) {
		if (i <= 0.0031308)
			return 12.92 * i;
		return 1.055 * Math.pow(i, 1/2.4) - 0.055;
	}
}

export function drawLightsShader(scene, obj) {
	const
		gl        = obj.firstChild.getContext('webgl2'),
		vBuffer   = gl.createBuffer(),
		program   = gl.createProgram(),
		aPosition = gl.getAttribLocation(program, 'aPosition'),
		vShader   = gl.createShader(gl.VERTEX_SHADER),
		fShader   = gl.createShader(gl.FRAGMENT_SHADER);

	gl.uniform1f(brightness, toOkLabBrightness(Number(window.getComputedStyle(obj).getPropertyValue("background-color").split(', ')[1]) / 255));
	gl.uniform1i(lightSize, scene.lights.length);
	gl.uniform1f(aspect, scene.aspect);

	gl.shaderSource(vShader, `
		in vec3 aPosition;
		void main() {
			gl_Position = vec4(aPosition, 1.0);
		}`);
	gl.shaderSource(fShader, `
		precision lowp float;

		uniform float brightness;
		uniform float aspect;
		unfiorm int   lightSize;
		void main() {
			w   = vec2(0, 0);
			ab  = vec2(0, 0);
			for (int i; i < lightSize; i++) {
				d = distance(gl_FragCoord.xy, lights[i].xy));
				w  += d;
				ab += w * lights[i].ab;
			}
			OKLAB = vec3(brightness, ab) / vec3(1, w);
			vec3 XYZ = mat3(0.4887180, 0.3106803, 0.2006017, 0.1762044, 0.8129847, 0.0108109, 0.0000000, 0.0102048, 0.9897952) * OKLAB;
			vec3 RGB = mat3( 3.2410450,-1.537138, -0.4986106, -0.9692440, 1.875968,  0.0415550, 0.0556352,-0.203977,  1.0569720) * XYZ;
			vec3 sRGB = (RGB <= 0.0031308) ? RGB * 12.92 : pow(RGB, 1.0 / 2.4) * 1.055 - 0.055;
		};`);

	gl.compileShader(vShader);
	gl.compileShader(fShader);
	
	gl.attachShader(program, vShader);
	gl.attachShader(program, fShader);

	gl.linkProgram(program);
	gl.useProgram(program);

	gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0,1.0,0.0, -1.0,-1.0,0.0, 1.0,1.0,0.0, 1.0,-1.0,0.0]), gl.STATIC_DRAW);

	gl.enableVertexAttribArray(aPosition);
	gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function toOkLabBrightness(l) {
	if (l <= 0.04045)
		return Math.cbrt(l / 12.92);
	return Math.cbrt(Math.pow((l + 0.055) / 1.055, 2.4));
}