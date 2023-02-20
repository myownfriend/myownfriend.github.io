onmessage = (e) => {
    const
        slice_w_ = 3,
        slice_h_ = 2,
        scene = {
            avg    : 0,
            sat    : 0,
            lum    : 0,
            lights : []
        },
        bins   = [[]],
        data   = e.data.image,
        sliceh = 2 * Math.round(e.data.height / slice_h_ / 2),
        wline  = e.data.width * 4,
        line   = 2 * Math.round(wline / slice_w_ / 2);

	// convert image data to pixel array + slicing
    for(let y_slice = 0; y_slice < slice_h_; y_slice++) {
        const yso = y_slice * wline * sliceh;
        for(let x_slice = 0; x_slice < slice_w_; x_slice++) {
            const
                current_slice = x_slice + (slice_w_ * y_slice),
                xso = line * x_slice + yso;
            for(let y = 0; y < sliceh; y++) {
                const yo = (y * wline) + xso;
                for(let x = 0; x < line; x += 4) {
                    const
                        xo = yo + x,
                        r = data[xo + 0] / 255,
                    	g = data[xo + 1] / 255,
                        b = data[xo + 2] / 255,
						rgb = srgb_linRGB([r,g,b]),
						max = Math.max(rgb[0], rgb[1], rgb[2]),
						min = Math.min(rgb[0], rgb[1], rgb[2]);

						scene.lum += (rgb[0] + rgb[1] + rgb[2]) / 3;
						scene.sat += max - min;

                    bins[0].push([rgb[0], rgb[1], rgb[2], current_slice]);
                }
            }
        }
    }

	// Median Cut
	const champions = [];
	while(bins.length < 16){
		const colors = bins.length;
		var winner = 0;
		for(let i = 0; i < colors; i++) {
			let rgbMin = [0,0,0];
			let rgbMax = [0,0,0];
			for(let pixel of bins[i]) {
				rgbMin = [Math.min(rgbMin[0], pixel[0]), Math.min(rgbMin[1], pixel[1]), Math.min(rgbMin[2], pixel[2])];
				rgbMax = [Math.max(rgbMax[0], pixel[0]), Math.max(rgbMax[1], pixel[1]), Math.max(rgbMax[2], pixel[2])];
			}
			const diffs = [rgbMax[0] - rgbMin[0], rgbMax[1] - rgbMin[1], rgbMax[2] - rgbMin[2]],
				  maxDiff = Math.max(...diffs);
			if (maxDiff <= 16 || diffs[champions[i]] == maxDiff) {
				winner = champions[i];
			} else {
				winner = diffs.indexOf(maxDiff);
				champions[i] = winner;
				bins[i].sort((a,b) => a[winner] - b[winner]);
			}
			champions.push(winner);
			bins.push(bins[i].splice(bins[i].length / 2));
		}
	}

	// Averaging each of the color bins
	const palette = [];
	for(let slice of bins) {
		let color = [0,0,0];
		let slicing  = [];
		for (let pixel of slice) {
			color = [color[0] + pixel[0], color[1] + pixel[1], color[2] + pixel[2]];
			if(slicing[pixel[3]] == undefined)
				slicing[pixel[3]] = 0;
			slicing[pixel[3]]++;
		}
		palette.push({
			color: [color[0] / slice.length, color[1] / slice.length, color[2] / slice.length],
			slices: slicing
		});
	}

	// Sort into location bins
	const slices = [];
	for(let c of palette)
		for(let b in c.slices) {
			if(slices[b] == undefined)
				slices[b] = [];
			slices[b].push({
				color: [c.color[0], c.color[1], c.color[2]], // This is where the array indexes shift
				weight: c.slices[b]});
		}
  
	for(let i in slices) {
			let
				color = [0,0,0],
				amount = 0;
			for (const c of slices[i]) {
				color = [color[0] + (c.color[0] * c.weight), color[1] + (c.color[1] * c.weight), color[2] + (c.color[2] * c.weight)];
				amount += c.weight;
			}
			// Get average color in bin
			color = linRGB_OkLab([color[0] / amount, color[1] / amount, color[2] / amount]);

		scene.lights.push((i % slice_w_) / (slice_w_ - 1));
		scene.lights.push((1-Math.trunc(i / slice_w_) / (slice_h_ - 1)));// Subtract from 1.0 to flip vertically. This saves a bunch of subtractions later on
		scene.lights.push(color[2]);
		scene.lights.push(color[1]);

		scene.lights.push(Math.random() + 1);
		// padding for UBO
		scene.lights.push(0.0);
		scene.lights.push(0.0);
		scene.lights.push(0.0);
	}

	scene.sat /= (96 * 64);
	scene.lum /= (96 * 64);
	scene.sat = linRGB_OkLab([scene.sat, 0 , 0])[0];
	scene.lum = linRGB_OkLab([scene.lum, 0 , 0])[0];

	const
		dark  = okLtoR([Math.min(scene.sat, 0.25615), 0, 0]) * 255,
		light = okLtoR([Math.max(1.0 - (scene.lum), 1 - 0.25615), 0, 0]) * 255;

	scene.css = `
			#dark-mode body {
				background-color: rgb(${dark} ${dark} ${dark});
			}
			#light-mode body {
				background-color: rgb(${light} ${light} ${light});
			}`;

	postMessage(scene);
}

function okLtoR(okL) {
	const
    	l = (okL + 0.3963377774 * 0.0 + 0.2158037573 * 0.0) ** 3,
    	m = (okL - 0.1055613458 * 0.0 - 0.0638541728 * 0.0) ** 3,
    	s = (okL - 0.0894841775 * 0.0 - 1.2914855480 * 0.0) ** 3,
    rgb = [
		+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
	];
	if (rgb[0] <= 0.0031308)
		return rgb[0] ** 3;
	return 1.055 * Math.pow(rgb[0], 1/2.4) - 0.055;
}

function linRGB_OkLab(rgb) {
	const // https://www.w3.org/TR/css-color-4/#color-conversion-code
		l = Math.cbrt(0.4122214708 * rgb[0] + 0.5363325363 * rgb[1] + 0.0514459929 * rgb[2]),
		m = Math.cbrt(0.2119034982 * rgb[0] + 0.6806995451 * rgb[1] + 0.1073969566 * rgb[2]),
		s = Math.cbrt(0.0883024619 * rgb[0] + 0.2817188376 * rgb[1] + 0.6299787005 * rgb[2]);
	return [
		0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
	];
}

function srgb_linRGB(srgb) {
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