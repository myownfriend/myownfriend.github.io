const MAX_OCTREE_DEPTH = 3;

//// STOP OPTIMIZING! JUST GET IT WORKING FIRST!

// If the child's index is higher, it's more likely to be brighter.
// but that becomes less true the deeper into the tree.
// The more it lays within the first and last child, the more likely
// it is to be less saturated. That's more true the deeper into the tree.

// Since we don't use the lightness of the image for the light,
// We could use a quadtree and only slice along the hue and chroma axes
// We can still tally the brightness of the overall image

class Octree {
	constructor(shift, depth, bit) {
		this.count  = 0;
		this.depth  = depth;
		this.bit    = bit;
		this.shift0 = shift - 2;
		this.shift1 = shift - 1;
		this.shift2 = shift;
	}
	insert(pixel) {
		this.count++;
		if(this.depth < 1) {
			if(this.pixel == undefined)
				this.pixel = [];
			this.pixel.push(pixel);
			return;
		}
		if(this.children == undefined) {
			const
				s = this.shift1,
				d = this.depth - 1,
				b = this.bit >>  1;
			this.children = [
				new Octree(s, d, b),
				new Octree(s, d, b),
				new Octree(s, d, b),
				new Octree(s, d, b),
				new Octree(s, d, b),
				new Octree(s, d, b),
				new Octree(s, d, b),
				new Octree(s, d, b)
			];
		}
		this.children[
			((pixel.r & this.bit) >> this.shift0) +
			((pixel.g & this.bit) >> this.shift1) +
			((pixel.b & this.bit) >> this.shift2)
		].insert(pixel);
	}

	getLights(lighting) {
		if(this.count > 0) {
			for(const child of this.children) {
				child.getLights(lighting);
			}
		}
	}
}

onmessage = (e) => {
    const
        thumb  = e.data,
        data   = thumb.image,
        line   = thumb.width * 4,
        octree = new Octree(7, 3, 0x80);

    for (let y = 0, ox = 0; y < thumb.height; y++) {
        const oy = ox, le = ox + line
        for (; ox < le; ox += 4) {
            const
                pixel = {
                    r : data[ox],
                    g : data[ox + 1],
                    b : data[ox + 2],
                    x : ox,
                    y : y
                },
                max = Math.max(pixel.r, pixel.b, pixel.g),
                min = Math.min(pixel.r, pixel.b, pixel.g);
            this.average_luminance += max + min;
            if (max - min < 16) 
                continue;
            pixel.x = (pixel.x - oy) / 4;
            octree.insert(pixel);
        }
    }
    this.average_luminance /= thumb.width * thumb.height * 2;
    console.log(octree);
}

class Quadree {
	constructor(depth) {
		this.count = 0;
		this.depth = depth;
	}
	insert(pixel) {
		this.count++;
		if(this.depth <= 0)
			return;
		if(this.children == undefined) {
			const
				d = this.depth - 1;
			this.children[
				new Quadtree(d),
				new Quadtree(d),
				new Quadtree(d),
				new Quadtree(d)
			];
		}

		
		this.children[child].insert(pixel);
	}
}