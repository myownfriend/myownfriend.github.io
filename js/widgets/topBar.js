import {Popover, Toggle} from "./widgets";

export class TopBar {

    constructor() {
        const
            root   = document.createElement('ul'),
            left   = document.createElement('li'),
            center = document.createElement('li'),
            right  = document.createElement('li');
        
        root.setAttribute('id', 'panel');
        left.classList.add('left'); // Maybe try to get rid of this
        center.classList.add('center');
        right.classList.add('right');

        const quickSettings = new Popover();

        const colorScheme   = new Toggle();

        quickSettings.add(colorScheme);

    }
}