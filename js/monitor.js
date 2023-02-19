export class Monitor {
	constructor(workspaces=2) {
        this.workspaces = document.getElementById('workspaces').getElementsByTagName('canvas');
        this.refresh();
	}

    refresh() {
        this.width  = document.documentElement.clientWidth  * window.devicePixelRatio;
        this.height = document.documentElement.clientHeight * window.devicePixelRatio;
		this.aspect = this.width / this.height;;
    }

    crop(scene) {
        const
            scl = this.aspect > scene.aspect ? scene.wallpaper.width / this.width : scene.wallpaper.height / this.height,
            sx  = scene.wallpaper.width  - (this.width  * scl),
            sy  = scene.wallpaper.height - (this.height * scl),
            mx  = sx / 2,
            my  = sy / 2,
            mw  = scene.wallpaper.width  - sx,
            mh  = scene.wallpaper.height - sy;
        return {
            x : mx,
            y : my,
            w : mw,
            h : mh
        };
    }

	update(scene) {
		const rect = this.crop(scene);
        for(const workspace of this.workspaces) {
            workspace.width  = this.width;
            workspace.height = this.height;
			workspace.getContext('2d').drawImage(scene.wallpaper, rect.x, rect.y, rect.w, rect.h,
                                                0, 0, workspace.width, workspace.height);
		}
	}
}
