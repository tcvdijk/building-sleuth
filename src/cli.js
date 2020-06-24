#! /usr/bin/node

const docopt = require('docopt')
const fs = require('fs')
const process = require('process')
const TL = require('./server/tileset_loader.js')
const JiggleAlgorithm = require('./JiggleAlgorithm.js')
var Jimp = require('jimp')
var async = require('async')
const CommonUtils = require('./common_utils.js')
const Geo = require('./Geo.js')
const GeoJsonLoader = require("./GeoJsonLoader.js")
const LRUCache = require('./LRUCache.js')
const ImagePlot = require('./ImagePlot.js')
const _cliProgress = require('cli-progress');


function exit_error(msg,code){
  console.error(msg)
  process.exit(code)
}

function handle_err(err){
  if(err){
    console.error(err)
    process.exit(1)
  }
}

function array_equal(arr1,arr2){
  if(arr1 == null || arr2 == null) return false;
  if (arr1.length != arr2.length){ return false;}
  for (let i = 0; i < arr1.length; i++){
    if(arr1[i] != arr2[i]){ return false;};
  }
  return true
}

function parse_image_processing_options(opts){
  let default_opts = JiggleAlgorithm.default_processing_options()
  let changed_option = false
  if(opts["--blur"]){
    default_opts.blur_radius = parseInt(opts["--blur"])
    if(default_opts.blur_radius > 0) changed_option = true
  }
  if(opts["--mix5050"]){
    default_opts.mix5050 = true
    changed_option = true
  }
  if(opts["--edge-detect"]){
    default_opts.edge_detect = true
    changed_option = true
  }
  console.warn("Using Processing options:", default_opts)
  if(!changed_option){
    console.warn("Image used for brightness will not be processed.")
  }
  return default_opts
}

function write_to_file_or_stdout(str,opts){
  if(opts["-o"]) fs.writeFileSync(opts["-o"],str)
  else process.stdout.write(str)
}

function cmd_project(opts){
  const lat = parseFloat(opts["<lat>"])
  const lon = parseFloat(opts["<lon>"])
  const zoomlevel = parseInt(opts["<zoomlevel>"])
  let res = Geo.wgs84_to_projection(lat,lon,zoomlevel)
  if(opts["--floored"]){
    res = res.map(Math.floor)
  }
  console.log(`${res[0]} ${res[1]}`)
}

function cmd_unproject(opts){
  const x = parseFloat(opts["<x>"])
  const y = parseFloat(opts["<y>"])
  const zoomevel = opts["<zoomlevel>"]

  const res = Geo.projection_to_wgs84(x,y,zoomlevel)
  console.log(`${res[0]} ${res[1]}`)
}
/*
function cmd_get_map(opts){
  const ca = JSON.parse("{\"coords\" : " + opts["<coords-array>"] + "}").coords
  const url = opts["<url>"]
  const zoomlevel = parseInt(opts["<zoomlevel>"])
  TL.getImageBuilder(!opts["--disable-redis"],(err,image_builder) => {
    image_builder.build_image_pngdata(ca,zoomlevel,url,(err,pngdata) => {
      image_builder.quit()
      handle_err(err)
      if(opts["-o"]){
        const filename = opts["-o"]
        console.error("filename: ", filename)
        fs.writeFile(filename,pngdata,(err) => {
          handle_err(err)
        })
      }
      else{
        process.stdout.write(pngdata)
      }
    })
  })
}*/

function cmd_jiggle(opts){
  const gj = GeoJsonLoader.load_file(opts["<ageojson>"])
  const [annotated_polys,other_features] = gj.split_annoated_polygons()

  const max_tries = parseInt(opts["--tries"])
  TL.getImageBuilder(!opts["--disable-redis"],(err,image_builder) => {
    handle_err(err)
    const greyscale_lru_cache = new LRUCache.LRUCache(array_equal,10)
    const processing_options = parse_image_processing_options(opts)

    let progress = new _cliProgress.Bar({}, _cliProgress.Presets.shades_classic);
    progress.start(annotated_polys.length,0)

    async.mapSeries(annotated_polys,(feature,callb) => {
      let polygon = new JiggleAlgorithm.JigglePolygon(feature.properties.jiggler.polygon)
      const projection = feature.properties.jiggler.projection
      async.waterfall([
        (callb) => {
          let img = greyscale_lru_cache.get(projection.tiles)
          if(img != null){
            callb(null,img)
          }
          else {
            image_builder.processed_image(projection.tiles,projection.url,projection.zoomlevel,processing_options,callb)
          }
        },
        (blurred_img,callb) => {
          greyscale_lru_cache.set(projection.tiles,blurred_img)
          new_polygon = polygon.jiggle(blurred_img,max_tries)
          callb(null,new_polygon)
        }
      ],
      (err,new_polygon) => {
        progress.increment()
        handle_err(err)
        let new_feature = feature
        let jiggled_distance = new_polygon.distance_to(polygon)
        feature.properties["jiggler"] = new_polygon.get_jiggler_annotation(projection)
        new_feature.properties.jiggler.jiggled_distance = jiggled_distance
        new_feature.properties.jiggler.jiggled_distance_norm = jiggled_distance / Math.max(new_polygon.points.length,1)
        new_feature.geometry.coordinates = [new_polygon.points.map((p) => Geo.polypoint_to_wgs84(p,projection.tiles,projection.zoomlevel).reverse())]
        callb(null,new_feature)
      })
    },
    (err,features) => {
      image_builder.quit()
      progress.stop()
      handle_err(err)
      write_to_file_or_stdout(GeoJsonLoader.build_geojson(features.concat(other_features)),opts)
    })
  })
}

function cmd_dl_sheetspec(opts){
  let url = "http://buildinginspector.nypl.org/api/sheets"
  TL.dl_file(url,(err,data) => {
    handle_err(err)
    if(opts["--list"]){
      let json = JSON.parse(data)
      data = ""
      json.features.forEach((feature)=> {
        data += feature.properties.id + "\n"
      })
    }
    write_to_file_or_stdout(data,opts)
  })
}

function cmd_dl_sheethistory(opts){
  let sheet_id = opts["<id>"]
  let url = "http://buildinginspector.nypl.org/api/sheets/" + sheet_id + "/history"
  TL.dl_file(url,(err,data) => {
    handle_err(err)
    if(opts["--only-polygons"]){
      let geojson = new GeoJsonLoader.GeoJson(JSON.parse(data)["features"])
      write_to_file_or_stdout(GeoJsonLoader.build_geojson(geojson.get_polygon_features()), opts)
    }
    else{
      write_to_file_or_stdout(data,opts)
    }
  })
}

function cmd_dl_tileinfo(opts){
  const sheet_id = parseInt(opts["<sheet-id>"])
  let url =
  async.waterfall([
    (callb) => {
      TL.dl_file("http://buildinginspector.nypl.org/api/sheets",callb)
    },
    (data,callb) => {
      const sheetspec = JSON.parse(data)
      let feature =  sheetspec.features.filter((feature) => {
        if(feature.type == "Feature" && feature.properties.id == sheet_id) return true
        else return false
      })
      if(feature.length == 0) {console.error("sheet not found"); callb(true,null)}
      else if(feature.length > 1) {console.error("multiple sheet with id " + sheet_id + " found"); callb(true,null)}
      callb(null,feature[0])
    },
    (feature,callb) => {
      console.log("Name: " + feature.properties.layer.name)
      console.log("BBox: " + JSON.stringify(feature.properties.layer.bbox))
      console.log("Description: " + feature.properties.layer.description)
      TL.dl_file(feature.properties.layer.tilejson,callb)
    },
    (data,callb) => {
      const tilejson = JSON.parse(data)
      console.log("")
      console.log("Tile Name: " + tilejson.name)
      console.log("Tiles: " + tilejson.tiles)
      console.log("Tile Scheme: " + tilejson.scheme)
      console.log("Min Zoom: " + tilejson.minzoom)
      console.log("Max Zoom: " + tilejson.maxzoom)
      console.log("Bounds: " + tilejson.bounds)
      console.log("Center: " + tilejson.center)
      console.log("Attribution: " + tilejson.attribution)
      callb(null,null)
    }
  ],
  (err,_) => {
    if(err) handle_err(err)
  })
}

function cmd_annotate(opts){
  const gj = GeoJsonLoader.load_file(opts["<geojson>"])
  const [polygon_features, other_features] = gj.split_polygons()

  const zoomlevel = parseInt(opts["<zoomlevel>"])
  const url = opts["<url>"]

  polygon_features.forEach((feature) => {
    let region = Geo.find_fitting_region(feature.geometry.coordinates[0])
    let tile_limiters = Geo.region_to_tile_limiters(region,zoomlevel)
    if(! ("properties" in feature)) feature.properties = {}
    if(! ("jiggler" in feature.properties)) feature.properties.jiggler = {}
    feature.properties.jiggler.projection = {
      "region" : region,
      "tiles" : tile_limiters,
      "url" : url,
      "zoomlevel" : zoomlevel
    }
    feature.properties.jiggler.polygon =
      feature.geometry.coordinates[0].map((coord) => Geo.wgs84_to_polypoint(coord[1],coord[0],tile_limiters,zoomlevel))
  })

  write_to_file_or_stdout(
    GeoJsonLoader.build_geojson(opts["--only-polygons"] ?  polygon_features : polygon_features.concat(other_features)),
    opts)
}

function cmd_evaluate(opts){
  TL.getImageBuilder(!opts["--disable-redis"],(err,image_builder) => {
    handle_err(err)
    const gj = GeoJsonLoader.load_file(opts["<ageojson>"])
    const [polygon_features, other_features] = gj.split_polygons()

    var greyscale_lru_cache = new LRUCache.LRUCache(array_equal, 10)
    const processing_options = parse_image_processing_options(opts)

    let progress = new _cliProgress.Bar({}, _cliProgress.Presets.shades_classic);
    progress.start(polygon_features.length,0)

    async.mapSeries(polygon_features,(feature,callb) => {
      if(!gj.is_annotated(feature)){
        return callb("Polygon not annotated. Annotate polygons first",null)
      }
      // else annotate the feature
      const projection = feature.properties.jiggler.projection
      let polygon = feature.properties.jiggler.polygon
      polygon = new JiggleAlgorithm.JigglePolygon(polygon)

      // load the image
      async.waterfall([
        (callb) => {
          let img = greyscale_lru_cache.get(projection.tiles)
          if(img != null){
            callb(null,img)
          }
          else {
            image_builder.processed_image(projection.tiles,projection.url,projection.zoomlevel,processing_options,callb)
          }
        },
        (img,callb) => {
          greyscale_lru_cache.set(projection.tiles,img)
          const getPixel = img.get_getPixelFn()
          polygon.update_edge_scores(getPixel)
          feature.properties["jiggler"] = polygon.get_jiggler_annotation(projection)
          return callb(null,feature)
        }
      ],
      (err,feature) => {
        progress.increment()
        callb(err,feature)
      })
    },
    (err,new_features) => {
      progress.stop()
      image_builder.quit()
      handle_err(err)
      const filtered_features = new_features.filter((f) => f != null)
      write_to_file_or_stdout(
        GeoJsonLoader.build_geojson(opts["--only-polygons"] ?  filtered_features : filtered_features.concat(other_features)),
        opts)
      })
    })
}

function cmd_get_ids(opts){
  const geojson = JSON.parse(fs.readFileSync(opts["<geojson>"]));
  const features = geojson.features
  let filtered_features = features.filter((feature) => {
    if (opts["--annotated"] && !("jiggler" in feature.properties)) return false
    if (feature.type != "Feature" || feature.geometry.type != "Polygon") return false
    return true
  })
  // print the ids of the filtered features
  filtered_features.forEach((feature) => {
    if (!("id" in feature.properties)) console.error("feature without ID detected")
    else console.log(feature.properties.id)
  })
}

function cmd_get_generic(opts){
  const gj = GeoJsonLoader.load_file(opts["<geojson>"])
  let feature = gj.find(opts["<id>"])
  if(opts["all"]){
    console.log("Coordinates:\n", feature.geometry.coordinates[0])
    console.log("Polygon:\n", feature.properties.jiggler.polygon)
    console.log("Brightness:\n", feature.properties.jiggler.brightness)
    console.log("Region:\n", feature.properties.jiggler.projection.region)
    console.log("Tiles:\n" , feature.properties.jiggler.projection.tiles)
    console.log("Tileset:\n", feature.properties.jiggler.projection.url.replace("{z}", feature.properties.jiggler.projection.zoomlevel))
  }
  else if(opts["coordinates"]) console.log(feature.geometry.coordinates[0])
  else if(opts["polygon"]) console.log(feature.properties.jiggler.polygon)
  else if(opts["edge-brightnesses"]) console.log(feature.properties.jiggler.edge_brightnesses)
  else if(opts["region"]) console.log(feature.properties.jiggler.region)
  else if(opts["tileset"]) console.log(feature.properties.jiggler.projection.url, feature.properties.jiggler.projection.zoomlevel)
  else if(opts["brightness"]) console.log(feature.properties.jiggler.brightness)
  else console.error("invalid cmd")
}

function cmd_filter(opts){
  const gj = GeoJsonLoader.load_file(opts["<geojson>"])
  const has_target_id = opts["<id>"]
  const target_ids = (()=> {
    if(has_target_id) return opts["<id>"]
    else return []
  })();
  const features = gj.features;
  let filtered_features = features.filter((feature) => {
    if(opts["--annotated"] && !("jiggler" in feature.properties)) return false
    if(has_target_id){
      target_ids.filter((id) => id == feature.properties.id) // this is O(n^2 in the worst case, fix)
      if(target_ids == 0) return false
    }
    return true
  })
  write_to_file_or_stdout(GeoJsonLoader.build_geojson(filtered_features), opts)
}

function cmd_brightness(opts){
  const gj = GeoJsonLoader.load_file(opts["<ageojson>"])
  const features = gj.get_polygon_features()
  const brightnesses = features.map((feature) => {
    if(!("jiggler" in feature.properties)){
      console.error("Feature " + feature.properties.id + " is not annotated, cannot calculate brightness!")
      process.exit(1)
    }
    return [feature.properties.id, feature.properties.jiggler.brightness]
  })
  if(opts["--average"]){
    let avg = brightnesses.reduce((x,y) => x + y[1],0) / brightnesses.length
    console.log(avg)
  }
  else{
    brightnesses.forEach((b) => console.log(b[0],b[1]))
  }
}

function cmd_jiggle_polygon(opts){
  console.error("not implemented")
  process.exit(2)
}

function cmd_get_map(opts){
  TL.getImageBuilder(!opts["--disable-redis"],(err,image_builder) => {
    handle_err(err)
    const gj = GeoJsonLoader.load_file(opts["<ageojson>"])
    // find the features
    const id = parseInt(opts["<id>"])
    const feature = gj.find(id)
    // get that region
    let tiles = opts["--fitting"] ?
      Geo.find_fitting_tile_limiters(feature.geometry.coordinates[0]) :
      features.properties.jiggler.projection.tiles

    let url = feature.properties.jiggler.projection.url
    let zoomlevel = feature.properties.jiggler.projection.zoomlevel
    const processing_options = parse_image_processing_options(opts)
    async.waterfall([
      (callb) => image_builder.build_image(tiles,url,zoomlevel,callb),
      (img,callb) => {
        ImagePlot.plot_polygon_to_image(img,feature.properties.jiggler.polygon)
        img.getBuffer('image/png',(err,imgdata) => callb(err,imgdata))
      }
    ],
      (err,img) => {
        handle_err(err);
        image_builder.quit()
        return write_to_file_or_stdout(img,opts)
      })
    });
}

function cmd_get_processed_map(opts){
  TL.getImageBuilder(!opts["--disable-redis"],(err,image_builder) => {
    handle_err(err);
    const gj = GeoJsonLoader.load_file(opts["<ageojson>"])
    // find the features
    const id = parseInt(opts["<id>"])
    const feature = gj.find(id)
    // this feature must be a polygon
    if (! gj.is_annotated_polygon(feature)) {
      exit_error("Feature with id " + id + " is not a polygon!",1)
    }
    // get that region
    let tiles = opts["--fitting"] ?
      Geo.find_fitting_tile_limiters(feature.geometry.coordinates[0]) :
      features.properties.jiggler.projection.tiles

    let url = feature.properties.jiggler.projection.url
    let zoomlevel = feature.properties.jiggler.projection.zoomlevel
    const processing_options = parse_image_processing_options(opts)
    if (opts["--zoomlevel"]) {
      zoomlevel = parseInt(opts["--zoomlevel"])
    }
    async.waterfall([
      (callb) => image_builder.processed_image(tiles,url,zoomlevel,processing_options,callb),
      (processed_img,callb) => new Jimp(processed_img.width,processed_img.height,
        (err,new_img) => callb(err,processed_img,new_img)),
      (processed_img,new_img,callb) => {
        let [w,h] = [processed_img.width,processed_img.height]
        for (let y = 0; y < h; y++){
          for (let x = 0; x < w; x++){
            const pix = Math.floor(processed_img.pixel(x,y) * 256)
            new_img.setPixelColor(Jimp.rgbaToInt(pix,pix,pix,255),x,y)
          }
        }
        console.error("Width: "+  new_img.bitmap.width + "\nHeight: " + new_img.bitmap.height)
        new_img.getBuffer('image/png',(err,img) => callb(err,img))
      }
    ],
      (err,img) => {
        handle_err(err);
        image_builder.quit()
        return write_to_file_or_stdout(img,opts)
      })
    });
}

function cmd_merge(opts){
  let all_features = new Array()
  opts["<geojsons>"].forEach((filename) => {
    const gj = GeoJsonLoader.load_file(filename)
    if (opts["--only-polygons"]){
      gj.get_polygon_features().forEach((f) => all_features.push(f))
    }
    else{
      gj.get_features().forEach((f) => all_features.push(f))
    }
  })
  write_to_file_or_stdout(GeoJsonLoader.build_geojson(all_features), opts)
}

const doc =  `
Usage:
  ./cli.js project <lat> <lon> <zoomlevel> [--floored]
  ./cli.js unproject <x> <y> <zoomlevel>
  ./cli.js annotate [-o=FILE] [--only-polygons] <geojson> <url> <zoomlevel>
  ./cli.js evaluate [--override] [--disable-redis] [--blur=RADIUS --edge-detect --mix5050] <ageojson>
  ./cli.js jiggle [-o=FILE] [--disable-redis] [--tries=NUM] [--blur=RADIUS --edge-detect --mix5050] <ageojson>
  ./cli.js brightness [--average] <ageojson>
  ./cli.js jiggle-polygon <image> <polygon-array>
  ./cli.js get (all | coordinates | polygon | edge-scores | region | tileset | brightness) [--disable-redis] <geojson> <id>
  ./cli.js get ids [--annotated] <geojson>
  ./cli.js get map [-o=FILE] [--disable-redis] [--draw-polygon] [--fitting] <ageojson> <id>
  ./cli.js get processed-map [-o=FILE ] [--disable-redis] [--zoomlevel=ZOOM] [--fitting] [--blur=RADIUS --edge-detect --mix5050] <ageojson> <id>
  ./cli.js dl sheetspec [--list] [-o=FILE]
  ./cli.js dl sheethistory [--only-polygons -o=FILE] <id>
  ./cli.js dl tileinfo <sheet-id>
  ./cli.js filter [--annotated -o=FILE] <geojson> [<id>...]
  ./cli.js merge [--only-polygons -o=FILE] <geojsons>...

Options:
  --tries=NUM       Try at most NUM times. [default: 1000]
  -o=FILE           Output to FILE instead of stdout.
  --image=FILE      Use this image file instead of downloading the tileset
  --floored         Round the returned tile positions to the next lower integer
  --override        Override existing annotations
  --only-polygons   Remove GeoJSON elements that are no polygons in the output
  --annotated       Only process Polygons with Jiggler Annotations
  --blur=RADIUS     Set the radius for the box blur (off by default)
  --mix5050         Mix the blurred image with the original (off by default)
  --edge-detect     Use edge detection (not implemented)
  --fitting         Use the fitting region instead of the annotated one
  --zoomlevel=ZOOM  Overwrite Zoom Level to use
  --list            List ids instead of json output

Further information:
<coords-array> must be valid JSON in with the values: [swlat,swlon,nelat,nelon]
`

const opts = docopt.docopt(doc)
if(opts["project"]) cmd_project(opts)
else if (opts["unproject"]) cmd_unproject(opts)
else if(opts["annotate"]) cmd_annotate(opts)
else if(opts["evaluate"]) cmd_evaluate(opts)
else if (opts["get"] && opts["ids"]) cmd_get_ids(opts)
else if (opts["get"] && opts["processed-map"]) cmd_get_processed_map(opts)
else if (opts["get"] && opts["map"]) cmd_get_map(opts)
else if (opts["get"]) cmd_get_generic(opts)
else if (opts["jiggle"]) cmd_jiggle(opts)
else if (opts["brightness"]) cmd_brightness(opts)
else if (opts["jiggle-polygon"]) cmd_jiggle_polygon(opts)
//else if(opts["jiggle"] || opts["brightness"]) cmd_jiggle_brightness(opts)
//else if (opts["merge"]) cmd_merge(opts)
else if(opts["dl"] && opts["sheetspec"]) cmd_dl_sheetspec(opts)
else if(opts["dl"] && opts["sheethistory"]) cmd_dl_sheethistory(opts)
else if(opts["dl"] && opts["tileinfo"]) cmd_dl_tileinfo(opts)
else if(opts["filter"]) cmd_filter(opts)
else if(opts["merge"]) cmd_merge(opts)

else {
  console.error("Invalid Command line")
  console.error(doc)
}
