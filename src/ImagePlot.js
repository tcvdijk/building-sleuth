function get_plotter_greyscale_image(arr,w,h){

}

function get_plotter_fn_rgba(arr,w,h){

  return function(x,y,color,alpha){
    if(x < 0 || x >= w || y < 0 || y >= h) return;
    const ptr = (w*y + x) * 4
    arr[ptr     ] = color[0] * alpha + arr[ptr]   * (1 - alpha)
    arr[ptr + 1 ] = color[1] * alpha + arr[ptr+1] * (1 - alpha)
    arr[ptr + 2 ] = color[2] * alpha + arr[ptr+2] * (1 - alpha)
  }

}

function bresenham_line(x0, y0, x1, y1, plot_fn, color = [255,0,0], alpha = 1){
   var dx = Math.abs(x1-x0);
   var dy = Math.abs(y1-y0);
   var sx = (x0 < x1) ? 1 : -1;
   var sy = (y0 < y1) ? 1 : -1;
   var err = dx-dy;

   while(true){
     plot_fn(x0,y0,color,alpha);  // Do what you need to for this
     if ((x0==x1) && (y0==y1)) break;
     var e2 = 2*err;
     if (e2 >-dy){ err -= dy; x0  += sx; }
     if (e2 < dx){ err += dx; y0  += sy; }
   }
}

function bresenham_line_dashed(x0, y0, x1, y1, plot_fn, color = [255,0,0], alpha = 1,dashlen = 2,spacing = dashlen * 6){
   var dx = Math.abs(x1-x0);
   var dy = Math.abs(y1-y0);
   var sx = (x0 < x1) ? 1 : -1;
   var sy = (y0 < y1) ? 1 : -1;
   var err = dx-dy;
   let cur_dash = 0
   while(true){
     if(cur_dash++ < dashlen) plot_fn(x0,y0,color,alpha);  // Do what you need to for this
     if(cur_dash == spacing)cur_dash =0;
     if ((x0==x1) && (y0==y1)) break;
     var e2 = 2*err;
     if (e2 >-dy){ err -= dy; x0  += sx; }
     if (e2 < dx){ err += dx; y0  += sy; }
   }
}

function plot_polygon_to_image(img,polygon,thick = true){
  let bm = img.bitmap
  let [arr,w,h] = [bm.data,bm.width,bm.height]
  let plot_fn = get_plotter_fn_rgba(arr,w,h)
  color = [255,0,0]
  alpha = 1
  for(let cur_edge = 0; cur_edge < polygon.length; cur_edge++){
      let [x0,y0] = polygon[cur_edge].map(Math.round)
      let [x1,y1] = polygon[(cur_edge + 1) % polygon.length].map(Math.round)
      bresenham_line_dashed(x0,y0,x1,y1,plot_fn,color,alpha)
      if(thick){ // plot extra lines to create the illusion of a thicker line
        bresenham_line_dashed(x0+1,y0+1,x1+1,y1+1,plot_fn,color,alpha)
        bresenham_line_dashed(x0+1,y0,x1+1,y1,plot_fn,color,alpha)
        bresenham_line_dashed(x0,y0+1,x1,y1+1,plot_fn,color,alpha)
      }
    }
    return img
}



exports.get_plotter_fn_rgba = get_plotter_fn_rgba
exports.bresenham_line = bresenham_line
exports.plot_polygon_to_image = plot_polygon_to_image
