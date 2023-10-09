window.surfaces = new Array();

window.getBrightness = (() => {
	if ('CSS' in window && 'registerProperty' in CSS) {
	   CSS.registerProperty({
		   name: '--brightness',
		   syntax: '<number>',
		   inherits: true,
		   initialValue: 0.5,
	   });
	   return (obj) => {
		   return Number(getComputedStyle(obj).getPropertyValue('--brightness'));
	   }
   }
   return (obj) => {
	   const val = (getComputedStyle(obj).getPropertyValue("background-color").split(', ')[1] | 0) / 255;
	   const abs = Math.abs(val);
	   return Math.cbrt((abs >= 0.04045) ? ((val >= 0) - (val < 0)) * Math.pow((abs + 0.055) / 1.055, 2.2) : val / 12.92);
   }
})();

import './separateCanvases.js';



window.background = document.body.appendChild(Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'symbol'), {
	id : 'background', old : null, current : null
}));

const background_set = (() => {
	const types = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
	const analyst = new Worker('./js/median_cut.js');
	return (file) => {
		if (!types.includes(file.type))
			return;
		const bg = document.createElementNS('http://www.w3.org/2000/svg', 'image')
		bg.image = new Image();
		bg.image.src = URL.createObjectURL(file);
		bg.image.addEventListener('load', () => {
			bg.aw = Math.max(1.0, bg.image.width  / bg.image.height);
			bg.ah = Math.max(1.0, bg.image.height / bg.image.width );
			bg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
			bg.setAttribute('href' , bg.image.src);
			bg.setAttribute('width', '100%');
			createImageBitmap(bg.image, {
				resizeWidth : bg.aw * 64,
				resizeHeight: bg.ah * 64,
			}).then((image) => {
				analyst.postMessage(image, [image]);
			});
		}, { once: true });
		analyst.onmessage = (e) => {
			bg.lighting = e.data.lights;
			background.old = background.current;
			background.current = bg;
			background.appendChild(bg);
			animation.add(300, updateBackground, ()=> {
				if (background.children.length > 1) {
					URL.revokeObjectURL(background.old.image.src);
					background.old.remove();
					background.old = null;
				}
			});
			animation.update();
		};
	}
})();

theme.set = () => {
	document.body.id = (theme.checked ? 'dark' : 'light') + "-mode";
	animation.add(300, updateBrightness);
	animation.update();
}


matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e)=> {
	theme.checked = e.target.matches;
	theme.set();
});



theme.addEventListener('change', theme.set);
background.upload.addEventListener('change', (e) => { setBackground(e.target.files[0]) });