/*
IDEA: Unless there's realy no color to be had, have greyer area inherit color from neighboring colors and maybe even turn into darker, more saturated versions of that color.
The blue galaxy wallpaper is a good example where this might look good. Ony a diagonal of the wallpaper realy has color and the rest is black. Filling the greyer areas with
darker blue might more pleasing.

If a color surprasses the brightness of the original grey, it should start to desaturate. As it goes below it should become more saturated.
*/

const
    lights  = [
      [[0 / 255, 51 / 255, 65 / 255], [0 / 255, 40 / 255, 65 / 255], [0  / 255, 40 / 255, 65 / 255]],
      [[0 / 255, 45 / 255, 65 / 255], [0 / 255, 46 / 255, 65 / 255], [0  / 255, 31 / 255, 65 / 255]],
      [[0 / 255, 44 / 255, 65 / 255], [0 / 255, 28 / 255, 65 / 255], [29 / 255, 10 / 255, 65 / 255]] 
    ],
    lightsHorz = 3,
    lightsVert = 3,
    gradx = lightsHorz - 1,
    grady = lightsVert - 1;

registerPaint('paintlet', class {

    static get contextOptions()  { return { alpha: false };}
    static get inputProperties() { return [
      '--x',
      '--y',
      '--clientWidth',
      '--clientHeight',
      '--brightness',
    ]; }

    paint(ctx, area, prop) {

        const
          w  = prop.get('--clientWidth' ) / gradx,
          h  = prop.get('--clientHeight') / grady,
          xo = prop.get('--x'),
          yo = prop.get('--y'),
          b = prop.get('--brightness') / 255;

        // I think it's repeating the last line and making the whole area
        // twice the size
        for(let y = 0; y < grady; y++) {
          const slicey = y * h;

          for(let x = 0; x < gradx; x++) {
              const topLeft  = normalize_color( lights[y][x],         b),
                    topRight = normalize_color( lights[y][x + 1],     b),
                    botLeft  = normalize_color( lights[y + 1][x],     b),
                    botRight = normalize_color( lights[y + 1][x + 1], b);

              const slicex = x * w;

              for(let i = 0; i <= h; i++) {

                const
                    gradient = ctx.createLinearGradient(slicex - xo, i + slicey - yo, slicex + w, i + slicey),
                    fac = i / h,
                    startColor = arrayToRGB(lerp(topLeft , botLeft , fac)),
                    endColor   = arrayToRGB(lerp(topRight, botRight, fac));
                gradient.addColorStop(0, startColor);
                gradient.addColorStop(1, endColor);
                ctx.fillStyle = gradient;
                ctx.fillRect(slicex - xo, i + slicey - yo, slicex + w, i + slicey);
              }
          }
        }
    }
});

function arrayToRGB(arr) {
  var ret = arr.map(function(v) {
      return Math.max(Math.min(Math.round(v * 255), 255), 0);
  });
  return 'rgb(' + ret.join(',') + ')';
}

function lerp(a, b, fac) {
    return a.map(function(v, i) {
        return v * (1 - fac) + b[i] * fac;
    });
}


function rgbToHsl(r, g, b){
  r /= 255, g /= 255, b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
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


function normalize_color(color, brightness) {
	const clip  = 95 / 255;
	const delta = Math.min(brightness - ((color[0] + color[1] + color[2]) / 3), 20 / 255);

	let new_color = [0, 0, 0];
	new_color[0] = Math.min(delta + color[0], clip);
	new_color[1] = Math.min(delta + color[1], clip);
	new_color[2] = Math.min(delta + color[2], clip);

	return new_color;
}
