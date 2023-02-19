export class Monitor {
	constructor(workspaces=2) {
        this.workspaces = document.getElementById('workspaces').getElementsByTagName('canvas');
        this.refresh();
	}

    refresh() {
        this.width  = document.documentElement.clientWidth  * window.devicePixelRatio;
        this.height = document.documentElement.clientHeight * window.devicePixelRatio;

		this.aspect = [1,1];
        const aspect = this.width / this.height;
		if(aspect > 1)
			this.aspect[0] *= aspect;
		else
			this.aspect[1] /= aspect;
    
    }

	update(scene) {
		const
            scl = this.aspect[0] > scene.aspect[0] ? scene.wallpaper.width / this.width : scene.wallpaper.height / this.height,
            sx  = scene.wallpaper.width  - (this.width  * scl),
            sy  = scene.wallpaper.height - (this.height * scl),
            mx  = sx / 2,
            my  = sy / 2,
            mw  = scene.wallpaper.width  - sx,
            mh  = scene.wallpaper.height - sy;
        for(const workspace of this.workspaces) {
            workspace.width  = this.width;
            workspace.height = this.height;
			workspace.getContext('2d').drawImage(scene.wallpaper, mx, my, mw, mh,
                                                0, 0, workspace.width, workspace.height);
		}
	}
}
