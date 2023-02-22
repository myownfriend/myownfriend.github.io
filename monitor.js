export class Monitor {
	constructor() {
        this.workspaces = []
        for(let i = 0; i < 2; i++) {
            const canvas = document.createElement('canvas');
            document.getElementById('workspaces').appendChild(canvas);
            this.workspaces.push(canvas.getContext('2d'));
        }
        this.refresh();
	}

    constructor2() {
        this.workspaces = []
        for(let i = 0; i < 2; i++) {
            const canvas = document.createElement('canvas');
            document.getElementById('workspaces').appendChild(canvas);
            this.workspaces.push(canvas.getContext('webgl2'));
        }
        this.refresh();
	}

    refresh() {
        this.width  = document.documentElement.clientWidth;
        this.height = document.documentElement.clientHeight;
        this.aspect = [Math.max(1.0, this.width / this.height), Math.max(1.0, this.height / this.width)];

    }

	update(scene) {
        for(const obj of scene.paintObjects) {
            const gl = obj.context;
            gl.uniform4fv(obj.monitor, new Float32Array([this.aspect[0], this.aspect[1], this.width, this.height]));
            // It's incorrect to compute the x and y offsets of the lights from screen's edge because the lights go off-screen
	        // The wallpaper's aspect ratio needs to be taken into account.
	        // Also since there's no resizable, movable surface's in the demom, position and rect never actually change in this unless the monitor is resized
            // If we 
	        gl.uniform4fv(obj.rect, new Float32Array([obj.surface.offsetLeft, this.height - (obj.surface.offsetTop + gl.canvas.height), gl.canvas.width, gl.canvas.height]));
        }

        // We only scale monitor coordinates to background texture coordinates. Both in floats
        const
            scale = this.aspect[0] > scene.aspect[0] ? scene.aspect[0] / this.aspect[0] : scene.aspect[1] / this.aspect[1],
            monitor_scaled  = [this.aspect[0] * scale, this.aspect[1] * scale],
            float_w  = monitor_scaled[0] / scene.aspect[0],
            float_h  = monitor_scaled[1] / scene.aspect[1],
            float_x  = (1 - float_w) / 2,
            float_y  = (1 - float_h) / 2;
        const
            pixel_x = float_x * scene.wallpaper.width ,
            pixel_y = float_y * scene.wallpaper.height,
            pixel_w = float_w * scene.wallpaper.width ,
            pixel_h = float_h * scene.wallpaper.height;

        for(const workspace of this.workspaces) {
            workspace.canvas.width  = this.width  * window.devicePixelRatio;
            workspace.canvas.height = this.height * window.devicePixelRatio;
            workspace.drawImage(scene.wallpaper, pixel_x, pixel_y, pixel_w, pixel_h,
                                                0, 0, workspace.canvas.width, workspace.canvas.height);
		}
	}
}