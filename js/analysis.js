const
	oct_max_depth  = 4,
	oct_max_range  = [1, 2], // The color channels have the same range so don't store it twice
	quad_max_depth = 3;
onmessage = (e) => {
	const
		thumb  = e.data,
    	octree = {
			count : 0,
			depth : 1,
			center: [0.5, 0, 0]
		},
		scene = {
			aspect : new Float32Array([
				Math.max(1.0, thumb.wallpaper[0] / thumb.wallpaper[1]),
				Math.max(1.0, thumb.wallpaper[1] / thumb.wallpaper[0])
			]),	
			lights : new Array(8)
		};

	const
		quad_max_range = scene.aspect[0] * scene.aspect[1], // we want to treat the wallpaper like it's always a square so that there's square splits
		inc   = [scene.aspect[0] / thumb.canvas[0] * 2, scene.aspect[1] / thumb.canvas[1] * 2],
		range = [scene.aspect[0] * -1, scene.aspect[1] * -1];

    for (let y = scene.aspect[1], ox = 0; y > range[1]; y -= inc[1]) {
        const line_end = ox + (thumb.canvas[0] * 4);
        for(let x = range[0]; ox < line_end; ox += 4, x += inc[0])
            octree_insert({
				color : [thumb.image[ox + 0], thumb.image[ox + 1], thumb.image[ox + 2] ],
				coords: [x , y]
			}, octree);
    }

	const colors = gather_colors(octree, octree.count * 0.01);

	const lights = [];
}

function gather_colors(node, threshold) {
	const colors = [];
	for(const child of node.children) {
		if(child.count > threshold) {
			if (child.depth >= oct_max_depth)
				colors.push(child);
			else
				colors.push(...gather_colors(child, threshold));
		}
	}
	return colors;
}

function octree_insert(pixel, node) {
	node.count++;
	// If this node is a leaf, store the coords of the pixel in an array
	if(node.depth >= oct_max_depth) 
		return node.pixels.push(pixel.coords);
	// If it's a branch and it doesn't have children...
	if(node.children == undefined) {
		// Create children for this node
		node.children = [];
		const depth = node.depth + 1;
		// If the children's depth equals max depth, make them a leaf
		if(depth >= oct_max_depth)
			for(let i = 0; i < 8; i++)
				node.children.push({
					count  : 0,
					depth  : depth,
					pixels : []
				});
		else { // Otherwise make them a branch
			const
				div    = 2 ** depth,
				diffs  = [oct_max_range[0] / div, oct_max_range[1] / div],
				diffs2 = [diffs[0] * 2, diffs[1] * 2]
			for(let i = 0; i < 8; i++)
				node.children.push({
					count  : 0,
					depth  : depth,
					center : [
						node.center[0] - diffs[0] + ((i & 0x4) >> 2) * diffs2[0],
						node.center[1] - diffs[1] + ((i & 0x2) >> 1) * diffs2[1],
						node.center[2] - diffs[1] + ((i & 0x1)     ) * diffs2[1]
					]
				});
		}
	} // Now that we know the pixel is going further, compute which child it belongs to and pass the pixel to it.
	octree_insert(pixel, node.children[((pixel.color[0] > node.center[0]) << 2) |
                                       ((pixel.color[1] > node.center[1]) << 1) |
                                       ((pixel.color[2] > node.center[2])     ) ]
	);
}

function quadtree_insert(pixel, node) {
	node.count++;
	// If this node is a leaf..
	if(node.depth >= quad_max_depth) {
		// Accumalate the x and y values
		node.position[0] += pixel[0];
		node.position[1] += pixel[1];
		return 
	}
	// If it's not a leaf and it doesn't have children...
	if(node.children == undefined) {
		// Create children for this node
		node.children = [];
		const depth = node.depth + 1;
		// If the children's depth equals max depth, make them a leaf
		if(depth >= quad_max_depth)
			for(let i = 0; i < 4; i++)
				node.children.push({
					count     : 0,
					depth     : depth,
					position  : [0,0,0],
				});
		else { // Otherwise make them a branch
			const
				div    = 2 ** depth,
				diff  = quad_max_range / div,
				diff2 = diff[0] * 2
			for(let i = 0; i < 4; i++)
				node.children.push({
					count  : 0,
					depth  : depth,
					center : [
						node.center[0] + diff - ((i & 0x2) >> 2) * diff2,
						node.center[1] + diff - ((i & 0x1)     ) * diff2,
					]
				});
		}
	} // Now that we know the pixel is going further, compute which child it belongs to and pass the pixel to it.
	quadtree_insert(pixel, node.children[((pixel[0] > node.center[0]) << 2) |
                                         ((pixel[1] > node.center[1]) << 1) ]
	);
}