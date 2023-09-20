"use strict";
onmessage = (e) => {
	const bitmap = new OffscreenCanvas(96, 64).getContext('2d');
	bitmap.drawImage(e.data, 0, 0, bitmap.canvas.width, bitmap.canvas.height);
	const pixels = bitmap.getImageData(0, 0, bitmap.canvas.width, bitmap.canvas.height).data;
	e.data.close();

	const buffer  = new ArrayBuffer(208);
	const float32 = new Float32Array(buffer);
	const int32   = new Int32Array(buffer);

    const slice_w_   = 3;
    const slice_h_   = 2;
	const average    = {l : 0, a : 0, b : 0, s : 0};
    const bins       = [[]];
    const sliceh     = 2 * Math.round(bitmap.canvas.height / slice_h_ / 2);
    const wline      = bitmap.canvas.width * 4;
    const line       = 2 * Math.round(wline / slice_w_ / 2);

	// convert image data to pixel array + slicing
    for(let y_slice = 0; y_slice < slice_h_; y_slice++) {
        const yso = y_slice * wline * sliceh;
        for(let x_slice = 0; x_slice < slice_w_; x_slice++) {
            const current_slice = x_slice + (slice_w_ * y_slice);
            const xso = line * x_slice + yso;
            for(let y = 0; y < sliceh; y++) {
                const yo = (y * wline) + xso;
                for(let x = 0; x < line; x += 4) {
					const xo = yo + x;

					const sR = pixels[xo]     / 255;
					const sG = pixels[xo + 1] / 255;
					const sB = pixels[xo + 2] / 255;

					const rsign = sR < 0 ? -1 : 1;
					const rabs = Math.abs(sR);
					const red   = (rabs < 0.04045) ? sR / 12.92 : rsign * (Math.pow((rabs + 0.055) / 1.055, 2.4));
					const gsign = sG < 0 ? -1 : 1;
					const gabs = Math.abs(sG);
					const green = (gabs < 0.04045) ? sG / 12.92 : gsign * (Math.pow((gabs + 0.055) / 1.055, 2.4));
					const bsign = sB < 0 ? -1 : 1;
					const babs = Math.abs(sB);
					const blue  = (babs < 0.04045) ? sB / 12.92 : bsign * (Math.pow((babs + 0.055) / 1.055, 2.4));

					const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
					const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
					const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

					const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
					const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
					const b = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;

					average.l += L;
					average.a += a;
					average.b += b;
                    bins[0].push([L, a, b, current_slice]);
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
			const diffs = [rgbMax[0] - rgbMin[0], rgbMax[1] - rgbMin[1], rgbMax[2] - rgbMin[2]];
			const maxDiff = Math.max(...diffs);
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
		let color    = [0,0,0];
		let slicing  = [];
		for (let pixel of slice) {
			color = [color[0] + pixel[0], color[1] + pixel[1], color[2] + pixel[2]];
			if(slicing[pixel[3]] === undefined)
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
			if(slices[b] === undefined)
				slices[b] = [];
			slices[b].push({
				color: [c.color[0], c.color[1], c.color[2]],
				weight: c.slices[b]});
		}

	let acc_intensity = 0;
	for(let i in slices) {
		// Get average color in bin
		const color = [0,0,0];
		let	  amount = 0;
		for (const c of slices[i]) {
			color[0] += c.color[0] * c.weight;
			color[1] += c.color[1] * c.weight;
			color[2] += c.color[2] * c.weight;
			amount += c.weight;
		}
		color[0] /= amount;
		color[1] /= amount;
		color[2] /= amount;
		const offset = i * 8;

		float32[offset + 0] = 2.0 * ((i % slice_w_) / (slice_w_ - 1)) - 1;              // x
		float32[offset + 1] = 2.0 * (1- Math.trunc(i / slice_w_) / (slice_h_ - 1)) - 1; // y
		float32[offset + 2] = 1 + Math.random(); // z
		float32[offset + 3] = 0.0;           // ______

		float32[offset + 4] = Math.random(); // intensity;
		float32[offset + 5] = 0.0;           // ______
		float32[offset + 6] = color[2];      // b
		float32[offset + 7] = color[1];      // a

		acc_intensity += float32[offset + 4];
	}

	for (let i = 0; i < float32.length; i += 8)
		float32[i + 4] /= acc_intensity;

	int32[48] = 6;

	const area = bitmap.canvas.width * bitmap.canvas.height;
	average.s /= area;
	average.l /= area;
	average.a /= area;
	average.b /= area;

	postMessage({
		lights : buffer,
	});
}