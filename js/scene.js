import {monitor} from './js.js';
import {createThumbnail, srgb_linRGB, linRGB_OkLab, linRGB_sRGB, OKLab_linRGB} from './lerp.js';

export class Scene {
	constructor() {
		this.paintObjects = [
			{
				cvs  : new OffscreenCanvas(75, 75),
				node : document.documentElement
			}
		];
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
			scn.lights = e.data.lights;
			//scn.brightness = e.data.lum;

			//let darkModeOverview = 
			/*
			stageBrightness  = scn.getSurfaceBrightness(document.documentElement);
			let
				targetBrightness = stageBrightness;
		
			
			if (scene.brightness < stageBrightness || scene.saturation < stageBrightness) 
				targetBrightness = scn.brightness;
			*/
			this.refresh();
		};
	}

	refresh() {
		this.color_scheme = (window.matchMedia('(prefers-color-scheme: dark)').matches) ? "dark" : "light";
		for(const object of this.paintObjects)
			this.drawLights(object);
	}

	drawLights(obj) {
		const
			cvs = obj.cvs,
			ctx = cvs.getContext('2d'),
			L   = this.getSurfaceBrightness(obj.node);

		for(let y = 0; y < cvs.height; y++) {
			const fy = y / cvs.height;
			for(let x = 0; x < cvs.width; x++) {
				const fx = x / cvs.width;
				let	a = 0, b = 0, w = 0;
				for (const light of this.lights) {
					const distance = Math.sqrt(((light.x - fx) /* * 0.33*/) ** 2 + ((light.y - fy) /* * 0.5*/) ** 2);
					a += distance * light.a;
					b += distance * light.b;
					w += distance;
				}

				const rgb = linRGB_sRGB(OKLab_linRGB([L , a / w, b / w]));
				ctx.fillStyle = `rgb(${rgb[0] * 255} ${rgb[1] * 255} ${rgb[2] * 255})`;
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

	getSurfaceBrightness(element){
		let input = Number(window.getComputedStyle(element).getPropertyValue("background-color").split(', ')[1]) / 255;

		return linRGB_OkLab(srgb_linRGB([input,input,input]))[0];
	}
}