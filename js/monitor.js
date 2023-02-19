export class Monitor {
	constructor() {
        this.workspaces = []//document.getElementById('workspaces').getElementsByTagName('canvas');
        for(let i = 0; i < 2; i++) {
            const canvas = document.createElement('canvas');
            document.getElementById('workspaces').appendChild(canvas);
            this.workspaces.push(canvas.getContext('2d'));
        }
        this.refresh();
	}

    refresh() {
        this.width  = document.documentElement.clientWidth;
        this.height = document.documentElement.clientHeight;
		this.aspect = this.width / this.height;;
    }

	update(scene) {
        const
            w = this.width  * window.devicePixelRatio,
            h = this.height * window.devicePixelRatio,
            scl = this.aspect > scene.aspect ? scene.wallpaper.width / w : scene.wallpaper.height / h,
            sx  = scene.wallpaper.width  - (w * scl),
            sy  = scene.wallpaper.height - (h * scl),
            mx  = sx / 2,
            my  = sy / 2,
            mw  = scene.wallpaper.width  - sx,
            mh  = scene.wallpaper.height - sy;
        for(const workspace of this.workspaces) {
            workspace.canvas.width  = w;
            workspace.canvas.height = h;
			workspace.drawImage(scene.wallpaper, mx, my, mw, mh,
                                                0, 0, workspace.canvas.width, workspace.canvas.height);
		}
	}
}
