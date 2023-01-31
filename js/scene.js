import {monitor} from './js.js';
import {createThumbnail, srgb_linRGB, linRGB_OkLab, linRGB_sRGB, OKLab_linRGB} from './lerp.js';

export class Scene {
	constructor() {
		this.primaryColor = 0;
		this.lights = [];
		this.css = new CSSStyleSheet();
		this.wallpaper = new Image();

		document.adoptedStyleSheets = [this.css];
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { this.refresh();});
		this.set_background("img/wallpapers/RainDrops.jpg");
	}

	set_background(background) {
		const
			//analyst = new Worker('./js/octree.js'),
			analyst = new Worker('./js/median_cut.js'),
			control = new AbortController(),
			signal  = control.signal,
			scn     = this;

		this.wallpaper.src = background;
		this.wallpaper.addEventListener('load', () => {

			this.aspect = this.wallpaper.width / this.wallpaper.height;

			const
				thumb = createThumbnail(this.wallpaper),
				ctx   = thumb.getContext('2d');

			analyst.postMessage({
				width : thumb.width,
				height: thumb.height,
				image : ctx.getImageData(0, 0, thumb.width, thumb.height).data
			});

			monitor.update(this);
			control.abort();
		}, {signal});

		analyst.onmessage = (e) => {			
			scn.lights     = e.data.lights;
			this.refresh();
		};
	}

	refresh() {
		this.color_scheme = (window.matchMedia('(prefers-color-scheme: dark)').matches) ? "dark" : "light";
		this.drawLights(document.documentElement);
	}
	
	drawLights(element) {
		const
			cvs    = new OffscreenCanvas(75, 50),
			ctx    = cvs.getContext('2d'),
			input  = srgb_linRGB(Number(window.getComputedStyle(element).getPropertyValue("background-color").split(', ')[1]) / 255),
			lights = [];
		
		for (const light of this.lights) {
			const rgb = OKLab_linRGB([linRGB_OkLab([input,input,input])[0], light.a, light.b])
			lights.push({
				r : rgb[0],
				g : rgb[1],
				b : rgb[2],
				x : light.x,
				y : light.y
			});
		}
		console.log(lights);

		for(let y = 0; y < cvs.height; y++) {
			const fy = y / cvs.height;
			for(let x = 0; x < cvs.width; x++) {
				const fx = x / cvs.width;
				let	r = 0, g = 0, b = 0, w = 0;
				for (const light of lights) {
					const distance = Math.sqrt(((light.x - fx) /* * 0.33*/) ** 2 + ((light.y - fy) /* * 0.5*/) ** 2);
					r += distance * light.r;
					g += distance * light.g;
					b += distance * light.b;
					w += distance;
					//console.log(distance);
				}
				r = linRGB_sRGB(r / w);
				g = linRGB_sRGB(g / w);
				b = linRGB_sRGB(b / w);

				//console.log([r * 255,g * 255, b * 255]);

				ctx.fillStyle = `rgb(${r * 255} ${g * 255} ${b * 255})`;
				ctx.fillRect(x, y, 1, 1);
			}
		}

		cvs.convertToBlob().then((blob) => {
			if(this.url != undefined)
				URL.revokeObjectURL(this.url);
			this.url = URL.createObjectURL(blob);
			this.css.replaceSync(`:root {background-image: url(${this.url})`);
		});
	}
}