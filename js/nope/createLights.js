/*
 * This takes an image, creates a color palette out of it, cuts it into pieces
 * and then determines the dominant color, darkness, and saturation for each piece.
*/
const 
	// Bitdepth settings
	maxVal      = 255,
	// The threshold for dark and light pixels being removed
	wDiscard    = 255 - 5,
	kDiscard    = 0   + 5,
	// Amount of colors created from the image
	maxColors = 16;

onmessage = function(e) {

  const pixels   = e.data.pixels,
        lights = [];

  // Convert image data to a pixel array + count discarded black and white pixels for each light
  for(let y = 0; y < e.data.height; y++) {
    //let light = Math.trunc(pixel / line) * slicehorz;
    while(0 >= data.length / e.data.chunk) {
      lights[Math.trunc(pixel / e.data.chunk  / e.data.new) % e.data.new] = e.data.pixels.splice(e.data.length - e.data.chunk);
    }
  } 

  // Find color palletes for each region of the image
  for(let light in scene.lights) {
    const worker = new Worker('./median-cut.js');
    worker.postMessage({
      pixels : lights[light].pixels
    });
    worker.onmessage = function(colors) {
        lights[light].palette = colors;
        //postMessage(scene);
    };
  }

// New we need to combine colors between lights
//	for(light of scene.lights) {
	  
	
//	}
/*
	// Sort into location palette
	for(let light in scene.lights) {
		let	r = 0,
			g = 0,
			b = 0,
			d = 0;
		for(let bin of palette) {
			d += bin.lights[light];

			r = bin.color[0] * bin.lights[light];
			g = bin.color[1] * bin.lights[light];
			b = bin.color[2] * bin.lights[light];
		}
		const hsl = rgbToHsl(r / d, g / d, b / d);
		scene.lights[light].h = hsl[0];
		scene.lights[light].s = hsl[1];
		scene.lights[light].l = hsl[2];
	}
*/
	//console.log(scene);
	
}

function rgbToHsl(r, g, b){
	r /= 255, g /= 255, b /= 255;
	const max = Math.max(r, g, b),
		  min = Math.min(r, g, b);
	var h, s, l = (max + min) / 2;
  
	if(max == min){
		h = s = 0; // achromatic
	}else{
		var d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch(max){
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}
		h /= 6;
	}
	return [h, s, l];
  }
