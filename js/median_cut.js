onmessage = (e) => {
	const
		scene = {
			lights : new Float32Array(8 * 8),
			light_length : 6,
			css    : '',
			aspect : new Float32Array([
				Math.max(1.0, e.data.width / e.data.height),
				Math.max(1.0, e.data.height / e.data.width)
			])
		},
		canvas  = new OffscreenCanvas(192 / 2, 128 / 2),
		gl = canvas.getContext('webgl2', {
			depth     : false,
			alpha     : false,
			stencil   : false,
			antialias : false,
			preserveDrawingBuffer: true,
		}),
  		program    = gl.createProgram(),
   		vShader    = gl.createShader(gl.VERTEX_SHADER),
   		fShader    = gl.createShader(gl.FRAGMENT_SHADER),
		thumbnail  = gl.createTexture(),
		rgbaBuffer = gl.createFramebuffer(),
		pixels     = new Float32Array(gl.canvas.width * gl.canvas.height * 4);
	gl.shaderSource(vShader, `#version 300 es
		precision mediump float;
		in      vec2  vPosition;
		in      vec2  tuv;
		out     vec2  uv;
		void main() {
			uv  = tuv;
			gl_Position = vec4(vPosition, 0.0, 1.0);
		}`);
	gl.shaderSource(fShader, `#version 300 es
		precision mediump float;
		in vec2 uv;
		uniform sampler2D wallpaper;
		out vec4 color;
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
			vec3 tex  = texture(wallpaper, uv).rgb;
			color = vec4(
				SRGB_to_OKLAB(tex),
				(abs(tex.g) + abs(tex.b)) / 2.0
			);
		}`);
	gl.attachShader(program, vShader);
	gl.attachShader(program, fShader);
	gl.compileShader(vShader);
	gl.compileShader(fShader);
	gl.linkProgram(program);
	gl.useProgram(program);

	const 
		uv         = gl.getAttribLocation(program, 'tuv'),
		vPosition  = gl.getAttribLocation(program, 'vPosition');

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
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, e.data.width, e.data.height, 0, gl.RGB, gl.UNSIGNED_BYTE, e.data);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, thumbnail);

	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gl.canvas.width, gl.canvas.height, 0, gl.RGBA, gl.FLOAT, null);

	gl.bindFramebuffer(gl.FRAMEBUFFER, rgbaBuffer);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, thumbnail, 0);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.FLOAT, pixels);

	const start = performance.now();
    const
        slice_w_ = 3,
        slice_h_ = 2,
		average    = new Float32Array(4), // average l,a,b, and saturation
        bins   = [[]],
        sliceh = 2 * Math.round(gl.canvas.height / slice_h_ / 2),
        wline  = gl.canvas.width * 4,
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
                        l = pixels[xo + 0],
                    	a = pixels[xo + 1],
                        b = pixels[xo + 2];
					average[3] += pixels[xo + 3];
					average[0] += l;
					average[1] += a;
					average[2] += b;
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
  
	const lights = [];
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
		lights.push(
			2 * ((i % slice_w_) / (slice_w_ - 1) + 0.00000001 * scene.aspect[0]) - 1,  // x
			2 * ((1-Math.trunc(i / slice_w_) / (slice_h_ - 1)) + 0.00000001 * scene.aspect[1]) - 1, // y
			color[2], // b
			color[1], // a
			Math.random() + 1, // intensity
			0.0, // lightness
			0.0, 0.0 // padding
		);
	}

	for (let i = 0; i < lights.length; i++) 
		scene.lights[i] = lights[i];
	
	const
		area  = gl.canvas.width * gl.canvas.height,
		dark  = okLtoR(Math.min(average[3], 0.25615)) * 255,
		light = okLtoR(Math.max(1.0 - (average[0]), 1 - 0.25615)) * 255;
	average[3] /= area;
	average[0] /= area;
	average[1] /= area;
	average[2] /= area;
	scene.css = `#dark-mode  body.desktop {background-color: rgb(${dark} ${dark} ${dark})} #light-mode body.desktop {background-color: rgb(${light} ${light} ${light})}`;

	console.log(`Scene took ${performance.now() - start}ms to build.`);

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
