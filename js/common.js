window.background = document.body.appendChild(Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'symbol'), {
	id      : 'background',
	old     : null,
	current : null,
}));

window.surfaces = new Array();

window.support = {
	customCSSProperties: false,
	filetypes  : ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
};

window.getBrightness = (()=> {
	if (support.customCSSProperties)
		return (obj) => {
			return obj.computedStyleMap().get('--brightness');
			return window.getComputedStyle(obj).getPropertyValue("--brightness");
		}
	return (obj) => {
		const val = (window.getComputedStyle(obj).getPropertyValue("background-color").split(', ')[1] | 0) / 255;
		const abs = Math.abs(val);
		return Math.cbrt((abs >= 0.04045) ? (val < 0 ? -1 : 1) * Math.pow((abs + 0.055) / 1.055, 2.2) : val / 12.92);
	}
})();

const image = new Image();
image.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TCEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
if (image.complete && image.width > 0 && image.height > 0)
	filetypes.push("image/jxl");

if ('CSS' in window && 'registerProperty' in CSS) {
	support.customCSSProperties = true;
	window.CSS.registerProperty({
		name: '--brightness',
		syntax: '<number>',
		inherits: false,
		initialValue: 0.5,
	});
}