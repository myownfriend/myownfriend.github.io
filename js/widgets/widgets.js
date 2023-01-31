export class Popover {
    constructor(name) {
        this.name = name;
        this.root = document.createElement('div');
        this.root.classList.add('popover');
    }

    add(widget) {
        this.root.appendChild(widget);
    }

    remove(name) {
        for (const child of this.root.childNodes) {
            if(child.name == name) {
                this.root.removeChild(name);
                return;
            }
        }
    }
}

export class Toggle {
    constructor(name) {
        this.name = name;
    }
}