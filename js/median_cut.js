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

	scene.aspect = new Float32Array([
		Math.max(1.0, e.data.wWidth / e.data.wHeight),
		Math.max(1.0, e.data.wHeight / e.data.wWidth)
	]);

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
                        l = data[xo + 0],
                    	a = data[xo + 1],
                        b = data[xo + 2];
					scene.sat += data[xo + 3];
					scene.lum += l;
                    bins[0].push([l, a, b, current_slice]);
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
			let rgbMin = [ 1.0,  1.0, 1.0];
			let rgbMax = [-1.0, -1.0,-1.0];
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
				color: [c.color[0], c.color[1], c.color[2]],
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
			color = [color[0] / amount, color[1] / amount, color[2] / amount];

		scene.lights.push(2 * ((i % slice_w_) / (slice_w_ - 1) + 0.00000001 * scene.aspect[0]) - 1);  // x
		scene.lights.push(2 * ((1-Math.trunc(i / slice_w_) / (slice_h_ - 1)) + 0.00000001 * scene.aspect[1]) - 1); // y
		scene.lights.push(color[2]); // b
		scene.lights.push(color[1]); // a

		scene.lights.push(Math.random() + 1); // Intensity
		scene.lights.push(color[0]); // Lightness
		scene.lights.push(0.0); // padding for UBO
		scene.lights.push(0.0); // padding for UBO
	}

	scene.lights = new Float32Array(scene.lights);

	scene.sat /= (96 * 64);
	scene.lum /= (96 * 64);

	const
		dark  = okLtoR(Math.min(scene.sat, 0.25615)) * 255,
		light = okLtoR(Math.max(1.0 - (scene.lum), 1 - 0.25615)) * 255;

	scene.css = `#dark-mode  body.desktop {background-color: rgb(${dark} ${dark} ${dark})} #light-mode body.desktop {background-color: rgb(${light} ${light} ${light})}`;

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