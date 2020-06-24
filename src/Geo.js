function wgs84_to_projection(lat,lon,zoomlevel){
  let siny = Math.sin(lat * Math.PI / 180.0)
  siny = Math.min(Math.max(siny,-0.9999999),0.9999999)
  const tile_size = Math.round(Math.pow(2,zoomlevel))
  return [
    tile_size * (0.5 + lon / 360.0),
    tile_size * (0.5 - Math.log((1.0+siny) / (1.0-siny)) / (4*Math.PI))
  ]
}

// This is the inversion, returns [lat,lon]
function projection_to_wgs84(x,y,zoomlevel){
  const tile_size = Math.round(Math.pow(2,zoomlevel))
  const lon = (x / tile_size - 0.5) * 360.0
  const repl = Math.pow(Math.E, Math.PI * (2 - 4 * (y / tile_size)))
  const siny = (repl - 1) / (repl + 1)
  const lat = Math.asin(siny) / (Math.PI / 180.0)
  return [lat, lon]
}

// this function converts a region to tile coordinates
// the border will increase the area a bit to leave room for jiggling
function region_to_tile_limiters(region,zoomlevel, border=0.4){
  let sw_c = wgs84_to_projection(region[0],region[1],zoomlevel)
  let ne_c = wgs84_to_projection(region[2],region[3],zoomlevel)
  // add 0.01 to the ceil in order to prevent pixel lookup with pixel coords
  // like 255.9998 (when rounding instead of flooring in the getPixel function)
  return [
    Math.floor(sw_c[0] - border),
    Math.floor(ne_c[1] - border),
    Math.ceil(ne_c[0] + 0.01 + border) - Math.floor(sw_c[0] - border),
    Math.ceil(sw_c[1]+0.01 + border) - Math.floor(ne_c[1] - border)]
}

function find_fitting_tile_limiters(coordinates,zoomlevel,border=0.4){
  let region = find_fitting_region(coordinates)
  return region_to_tile_limiters(region,zoomlevel,border)
}

function polypoint_to_wgs84(coords,tiles,zoomlevel){
  let [ul_x,ul_y,x_tiles,y_tiles] = tiles

  const tile_resolution = 256;
  // calculate the point coordinates in web mercator coordinates
  const wm_x = ul_x + coords[0] / tile_resolution
  const wm_y = ul_y + coords[1] / tile_resolution
  const wgs84 = projection_to_wgs84(wm_x,wm_y,zoomlevel)
  return wgs84
}

function wgs84_to_polypoint(lat,lon,tiles,zoomlevel){
  let [ul_x,ul_y,x_tiles,y_tiles] = tiles
  const projection = wgs84_to_projection(lat,lon,zoomlevel)
  let pixel_x = projection[0] - ul_x
  let pixel_y = projection[1] - ul_y
  pixel_x *= 256.0
  pixel_y *= 256.0
  return [pixel_x,pixel_y]
}

function find_fitting_region(coordinates){
  let lat_coords = coordinates.map((c) => c[1])
  let lon_coords = coordinates.map((c) => c[0])
  let lat_min = Math.min(...lat_coords)
  let lat_max = Math.max(...lat_coords)
  let lon_min = Math.min(...lon_coords)
  let lon_max = Math.max(...lon_coords)
  let region = [lat_min,lon_min,lat_max,lon_max]
  return region
}

function polygon_center(coordinates){
  let center_a = coordinates.map((c) => c[0]).reduce((x,y) => x + y ) /coordinates.length
  let center_b = coordinates.map((c) => c[1]).reduce((x,y) => x + y ) /coordinates.length
  return [center_a,center_b]

}

exports.wgs84_to_projection = wgs84_to_projection
exports.projection_to_wgs84 = projection_to_wgs84
exports.region_to_tile_limiters = region_to_tile_limiters
exports.polypoint_to_wgs84 = polypoint_to_wgs84
exports.wgs84_to_polypoint = wgs84_to_polypoint
exports.find_fitting_region = find_fitting_region
exports.find_fitting_tile_limiters = find_fitting_tile_limiters
exports.polygon_center = polygon_center
