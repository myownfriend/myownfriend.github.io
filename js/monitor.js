export class Monitor {

    // Maybe use this class to create the workspaces, too.
    // One thing I just noticed is that only the primary display even has workspaces
    // All additional monitors are their own workspace
	constructor(workspaces=2) {
        this.colorSpace = "sRGB";
        this.workspaces = document.getElementById('workspaces').getElementsByTagName('canvas');
        this.refresh();
	}

    refresh() {
        this.width  = document.documentElement.clientWidth  * window.devicePixelRatio;
        this.height = document.documentElement.clientHeight * window.devicePixelRatio;
        this.aspect = this.width / this.height;
    }

	update(scene) {
		const
            scl = this.aspect > scene.aspect ? scene.wallpaper.width / this.width : scene.wallpaper.height / this.height,
            cws = this.width  * scl,
            cwh = this.height * scl,
            sx  = scene.wallpaper.width  - cws,
            sy  = scene.wallpaper.height - cwh;
        for(const workspace of this.workspaces) {
            workspace.width  = this.width;
            workspace.height = this.height;
			workspace.getContext('2d').drawImage(scene.wallpaper,
                                                sx / 2,
                                                sy / 2,
                                                scene.wallpaper.width  - sx,
                                                scene.wallpaper.height - sy,
                                                0, 0, workspace.width, workspace.height);
		}
	}
}