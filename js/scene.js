import {workspaces} from './js.js';
import {WebGL2, vs_drawLights, fs_drawLights} from './shaders.js';

export const scene = {
	lightSurfaces : [
				createLightSurface(document.body),
				createLightSurface(document.getElementById('quick-settings')),
				createLightSurface(document.getElementById('dash'))
	            ],
	wallpaper : new Image(),
	analyst   : new Worker('./js/median_cut.js'),
	theme : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
	css : new CSSStyleSheet()
};

function createLightSurface(surface) {
	const
		setup = new WebGL2(vs_drawLights,fs_drawLights),
		data = {
			context : setup.context,
			program : setup.program
		};
	data.surface = surface;
	data.context.canvas.classList.add('paint');
	data.surface.prepend(data.context.canvas);

	data.surfaceColor = data.context.getUniformLocation(data.program, "surfaceColor");
	data.monitor = data.context.getUniformLocation(data.program, "monitor");
	data.wallpaper = data.context.getUniformLocation(data.program, "wallpaper");
	data.rect = data.context.getUniformLocation(data.program, "rect");
	data.lights = data.context.getUniformBlockIndex(data.program, 'lighting');
	data.context.bindBufferBase(data.context.UNIFORM_BUFFER, 0, data.context.createBuffer());

	const aPosition = data.context.getAttribLocation(data.program, 'aPosition');
	data.context.bindBuffer(data.context.ARRAY_BUFFER, data.context.createBuffer());
	data.context.bufferData(data.context.ARRAY_BUFFER, new Float32Array([0.0,1.0, 0.0,0.0, 1.0,1.0, 1.0,0.0]), data.context.STATIC_DRAW);

	data.context.enableVertexAttribArray(aPosition);
	data.context.vertexAttribPointer(aPosition, 2, data.context.FLOAT, false, 0, 0);

	return data;
}

function createThumbnail2(image, limit = 64) {
    let scale = 1;
    if (image.width * image.height > limit * limit)
        scale = limit / (image.width / image.height > 1 ?  image.height : image.width);
    const buf = new WebGL2('','', {enable : true, width : 2 * Math.round(image.width * scale / 2), height : 2 * Math.round(image.height * scale / 2)})
    return buf;
}

export function sendToAnalyze() {
	const thumb = new OffscreenCanvas(192 / 2, 128 / 2).getContext('2d');
	thumb.drawImage(scene.wallpaper, 0, 0, thumb.canvas.width, thumb.canvas.height);
	// It's minor but the aspect ratio calculation should be 
	// part of the worker since it's technically a kind of analysis
	scene.aspect = [Math.max(1.0, scene.wallpaper.width / scene.wallpaper.height), Math.max(1.0, scene.wallpaper.height / scene.wallpaper.width)];
	scene.analyst.postMessage({
		width : thumb.canvas.width,
		height: thumb.canvas.height,
		image : thumb.getImageData(0, 0, thumb.canvas.width, thumb.canvas.height).data
	});
}

scene.analyst.onmessage = (e) => {			
	scene.css.replaceSync(e.data.css);
	for(const obj of scene.lightSurfaces) {
		const gl = obj.context;
		gl.uniform4fv(obj.wallpaper, new Float32Array([scene.aspect[0], scene.aspect[1], scene.wallpaper.width, scene.wallpaper.height]));
		gl.bufferData(gl.UNIFORM_BUFFER, new Float32Array(e.data.lights), gl.STATIC_DRAW);
		gl.uniformBlockBinding(obj.program, obj.lights, 0);
	}
	fullRedraw();
};

export function drawLights() {
	for(const obj of scene.lightSurfaces) {
		const gl = obj.context;
		gl.uniform1f(obj.surfaceColor, Number(window.getComputedStyle(obj.surface).getPropertyValue("background-color").split(', ')[1]));
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
}

export function fullRedraw() {
	const
		mAspect = [Math.max(1.0, document.documentElement.clientWidth / document.documentElement.clientHeight), Math.max(1.0, document.documentElement.clientHeight / document.documentElement.clientWidth)],
		scale = Math.min(scene.aspect[0] / mAspect[0], scene.aspect[1] / mAspect[1]),
		monitor_scaled  = [mAspect[0] * scale, mAspect[1] * scale],
		float_w  = monitor_scaled[0] / scene.aspect[0],
		float_h  = monitor_scaled[1] / scene.aspect[1],
		float_x  = (1 - float_w) / 2,
		float_y  = (1 - float_h) / 2;
	const
		pixel_x = float_x * scene.wallpaper.width ,
		pixel_y = float_y * scene.wallpaper.height,
		pixel_w = float_w * scene.wallpaper.width ,
		pixel_h = float_h * scene.wallpaper.height;

	for(const workspace of workspaces) 
		workspace.drawImage(scene.wallpaper, pixel_x, pixel_y, pixel_w, pixel_h, 0, 0, workspace.canvas.width, workspace.canvas.height);

	drawLights();
}