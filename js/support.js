export const support = {
	customCSSProperties: false,
	filetypes  : ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
};

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