export function lerp(x , y, a) {
    return x * (1 - a) + y * a;
}

export function clamp(a, min , max) {
    return Math.max(Math.min(a, max), min);
}

export function createThumbnail2(image, limit = 64) {
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

export function createThumbnail(image, limit = 64) {
    // THIS IS A FAKE FUNCTION FOR TESTING MEDIAN CUT
    const
        buf = new OffscreenCanvas(192 / 2, 128 / 2),
        ctx = buf.getContext('2d');
        ctx.drawImage(image, 0, 0, buf.width, buf.height);
    return buf;
}

export function linRGB_OkLab(RGB) {
	const // https://www.w3.org/TR/css-color-4/#color-conversion-code
		l = Math.cbrt(0.4122214708 * RGB[0] + 0.5363325363 * RGB[1] + 0.0514459929 * RGB[2]),
		m = Math.cbrt(0.2119034982 * RGB[0] + 0.6806995451 * RGB[1] + 0.1073969566 * RGB[2]),
		s = Math.cbrt(0.0883024619 * RGB[0] + 0.2817188376 * RGB[1] + 0.6299787005 * RGB[2]);
	return [
		0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
	];
}

export function srgb_linRGB(srgb) {
	let
		r = srgb[0],
		g = srgb[1],
		b = srgb[2];
  
	if (r <= 0.04045)
		r = r / 12.92;
	else
		r = Math.pow((r + 0.055) / 1.055, 2.4);
  
	if (g <= 0.04045)
		g = g / 12.92;
	else
		g = Math.pow((g + 0.055) / 1.055, 2.4);
  
	if (b <= 0.04045)
		b = b / 12.92;
	else
		b = Math.pow((b + 0.055) / 1.055, 2.4);
  
	return [r, g, b];
}

export class PaintObject2D {
	constructor(surface) {
		this.surface = surface;
		this.canvas  = this.surface.firstChild,
		this.context = this.canvas.getContext('2d', {
			depth     : false,
			alpha     : false,
			stencil   : false,
			antialias : false,
			preserveDrawingBuffer: true
		});
	}
}

export function drawLights(scene, obj) {
	const
		ctx     = obj.context,
		rect    = obj.surface.getBoundingClientRect(),
		wScale  = document.documentElement.clientWidth  / rect.width,
		hScale  = document.documentElement.clientHeight / rect.height,
		xOffset = rect.x / document.documentElement.clientWidth,
		yOffset = 1 - ((rect.y + rect.height) / document.documentElement.clientHeight),
		lights  = structuredClone(scene.lights);

	console.log([rect.y, rect.height, document.documentElement.clientHeight]);

	for (const light of lights) {
		light.x = (light.x - xOffset) * wScale;
		light.y = (light.y - yOffset) * hScale;
	}
	
	const
		L = toOkLabBrightness(Number(window.getComputedStyle(obj.surface).getPropertyValue("background-color").split(', ')[1]) / 255);
	for(let y = 0; y < rect.height; y++) {
		const fy = 1 - (y / rect.height);
		for(let x = 0; x < rect.width; x++) {
			const fx = x / rect.width;
			let	i = 0, a = 0, b = 0;
			for (let l = 0; l < 6; l++) {
				const intensity  = lights[l].i / Math.sqrt(((lights[l].x - fx) ) ** 2 + ((lights[l].y - fy)) ** 2) ** 2;
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
	function toOkLabBrightness(l) {
		if (l <= 0.04045)
			return Math.cbrt(l / 12.92);
		return Math.cbrt(Math.pow((l + 0.055) / 1.055, 2.4));
	}
}

/*
			vec3 RGB  = mat3(
				3.2410450,-1.5371380,-0.4986106,
			   -0.9692440, 1.8759680, 0.0415550,
				0.0556352,-0.2039770, 1.0569720) * LMS;
					vec3 RGB  = mat3(
				 4.0767416621, -3.3077115913,  0.2309699292,
				-1.2684380046,  2.6097574011, -0.3413193965,
				-0.0041960863, -0.7034186147,  1.7076147010) * LMS;
				

				1.0,  0.3963377774, 0.2158037573, 
				1.0, -0.1055613458,-0.0638541728, 
				1.0, -0.0894841775,-1.2914855480
				*/