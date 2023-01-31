export function lerp(x , y, a) {
    return x * (1 - a) + y * a;
}

export function clamp(a, min , max) {
    return Math.max(Math.min(a, max), min);
}

export function createThumbnail2(image, limit = 64) {
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

export function OKLab_linRGB(OKLAB) {
	const
		l = (OKLAB[0] + 0.3963377774 * OKLAB[1] + 0.2158037573 * OKLAB[2]) ** 3,
		m = (OKLAB[0] - 0.1055613458 * OKLAB[1] - 0.0638541728 * OKLAB[2]) ** 3,
		s = (OKLAB[0] - 0.0894841775 * OKLAB[1] - 1.2914855480 * OKLAB[2]) ** 3;
    return [
		+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
	];
}

export function srgb_linRGB(c) {
	if (c <= 0.03928)
		return c / 12.92;
	return ((c + 0.055) / 1.055) ** 2.4;
	/*
	const sign = c < 0? -1 : 1;
	const abs  = Math.abs(c);
	if (abs > 0.0031308)
		return sign * (1.055 * Math.pow(abs, 1/2.4) - 0.055);
	return 12.92 * c;
	*/
	/*
    if (c >= 0.0031308)
        return (1.055) * c ** (1.0 / 2.4) - 0.055;
    return 12.92 * c;
	*/
}

export function linRGB_sRGB(c) {
	const sign = c < 0? -1 : 1;
	const abs  = Math.abs(c);

	if (abs < 0.04045)
		return c / 12.92;
	return sign * (Math.pow((abs + 0.055) / 1.055, 2.4));
	/*
	if (c >= 0.04045)
		return ((c + 0.055)/(1 + 0.055)) ** 2.4;
	return c / 12.92;
	*/
}