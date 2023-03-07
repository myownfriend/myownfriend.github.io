import {WebGL2, vs_clip, vs_no_clip, fs_drawLights, fs_drawWallpaper} from './shaders.js';

export const scene = {
	paintObjects : [
				createWorkSpaces(document.getElementById('workspaces')),
				createWorkSpaces(document.getElementById('workspaces')),
				createLights(document.body),
				createLights(document.getElementById('quick-settings')),
				createLights(document.getElementById('dash'))
	            ],
	wallpaper : new Image(),
	analyst   : new Worker('./js/median_cut.js'),
	theme     : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
	css       : new CSSStyleSheet()
};

function createPaint(surface,vs,fs,type) {
	const
		setup = new WebGL2(vs, fs),
		data = {
			context : setup.context,
			program : setup.program
		};
	data.surface = surface;
	data.context.canvas.classList.add(type);
	data.surface.prepend(data.context.canvas);
	data.rect = data.context.getUniformLocation(data.program, "rect");
	data.monitor = data.context.getUniformLocation(data.program, "monitor");
	data.background = data.context.getUniformLocation(data.program, "background");
	const vPosition = data.context.getAttribLocation(data.program, 'vPosition');
	data.context.bindBuffer(data.context.ARRAY_BUFFER, data.context.createBuffer());
	data.context.bufferData(data.context.ARRAY_BUFFER, new Float32Array([-1.0,1.0, -1.0,-1.0, 1.0,1.0, 1.0,-1.0]), data.context.STATIC_DRAW);
	data.context.enableVertexAttribArray(vPosition);
	data.context.vertexAttribPointer(vPosition, 2, data.context.FLOAT, false, 0, 0);
	return data;
}

function createLights(surface) {
	const data = createPaint(surface, vs_clip, fs_drawLights, 'light');
	data.lights = data.context.getUniformBlockIndex(data.program, 'lighting');
	data.surfaceColor = data.context.getUniformLocation(data.program, "surfaceColor");
	data.context.bindBufferBase(data.context.UNIFORM_BUFFER, 0, data.context.createBuffer());
	return data;
}

function createWorkSpaces(surface) {
	const
		data = createPaint(surface, vs_clip, fs_drawWallpaper, 'workspace'),
		uv   = data.context.getAttribLocation(data.program, 'tuv');
	data.context.bindBuffer(data.context.ARRAY_BUFFER, data.context.createBuffer());
	data.context.bufferData(data.context.ARRAY_BUFFER, new Float32Array([0.0,1.0, 0.0,0.0, 1.0,1.0, 1.0,0.0]), data.context.STATIC_DRAW);
	data.context.enableVertexAttribArray(uv);
	data.context.vertexAttribPointer(uv, 2, data.context.FLOAT, false, 0, 0);
	data.context.uniform1i(data.context.getUniformLocation(data.program, 'wallpaper'), 0);
	data.context.pixelStorei(data.context.UNPACK_FLIP_Y_WEBGL, true);
	data.context.bindTexture(data.context.TEXTURE_2D, data.context.createTexture());
	data.context.activeTexture(data.context.TEXTURE0);
	data.context.texParameteri(data.context.TEXTURE_2D, data.context.TEXTURE_MIN_FILTER, data.context.LINEAR);
	data.context.texParameteri(data.context.TEXTURE_2D, data.context.TEXTURE_MAG_FILTER, data.context.LINEAR);
	return data;
}

export function sendToAnalyze() {
	const
		thumb = new WebGL2(vs_no_clip, fs_drawWallpaper, {
			enable : true,
			width  : 192 / 2,
			height : 128 / 2
		}),
		gl = thumb.context,
		program = thumb.program,
		uv   = gl.getAttribLocation(program, 'tuv'),
		pixels = new Float32Array(gl.canvas.width * gl.canvas.height * 4),
		vPosition = gl.getAttribLocation(program, 'vPosition'),
		thumbnail  = gl.createTexture(),
		rgbaBuffer = gl.createFramebuffer();

	gl.getExtension("EXT_color_buffer_float");

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1.0,1.0, -1.0,-1.0, 1.0,1.0, 1.0,-1.0]), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(vPosition);
	gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0.0,1.0, 0.0,0.0, 1.0,1.0, 1.0,0.0]), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(uv);
	gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, scene.wallpaper.width, scene.wallpaper.height, 0, gl.RGB, gl.UNSIGNED_BYTE, scene.wallpaper);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, thumbnail);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.FLOAT, null);

	gl.bindFramebuffer(gl.FRAMEBUFFER, rgbaBuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, thumbnail, 0);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.FLOAT, pixels);

	scene.analyst.postMessage({
		wWidth : scene.wallpaper.width,
		wHeight: scene.wallpaper.height,
		width  : gl.canvas.width,
		height : gl.canvas.height,
		image  : pixels
	});
	URL.revokeObjectURL(scene.wallpaper.src);
}

scene.analyst.onmessage = (e) => {
	scene.css.replaceSync(e.data.css);
	for(const obj of scene.paintObjects) {
		obj.context.uniform2fv(obj.background, e.data.aspect);
		if (obj.context.canvas.classList.contains('light'))
			obj.context.bufferData(obj.context.UNIFORM_BUFFER, e.data.lights, obj.context.STATIC_DRAW);
		else
			obj.context.texImage2D(obj.context.TEXTURE_2D, 0, obj.context.RGB, scene.wallpaper.width, scene.wallpaper.height, 0, obj.context.RGB, obj.context.UNSIGNED_BYTE, scene.wallpaper);
	}
	update(250);
};

export function update(length = 1) {
	const end = window.performance.now() + length;
	function refresh(timestamp) {
		for(const obj of scene.paintObjects) {
			if(obj.context.canvas.classList.contains('light'))
				obj.context.uniform1f(obj.surfaceColor, Number(window.getComputedStyle(obj.surface).getPropertyValue("background-color").split(', ')[1]));
			obj.context.drawArrays(obj.context.TRIANGLE_STRIP, 0, 4);
		}
		if(timestamp < end)
			window.requestAnimationFrame(refresh);
	}; window.requestAnimationFrame(refresh);
}