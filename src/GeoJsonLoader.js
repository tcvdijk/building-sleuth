const fs = require('fs')

function split(arr,condition){
  let coll_true = []
  let coll_false = []
  arr.forEach((x) =>
    {
      if(condition(x)){
        coll_true.push(x)
      }
      else{
        coll_false.push(x)
      }
    }
  )
  return [coll_true,coll_false]
}

class GeoJson{
  constructor(features){
    this.features = features
  }
  is_annotated(feature){
    return "jiggler" in feature.properties
  }
  has_tileset(feature){
    return "jiggler_projection" in feature.properties
  }
  find(id){
    // get the feature with id == id or crash the program
    let filtered = this.features.filter((feature) => feature.properties.id == id)
    if (filtered.length == 0) {
      throw "Feature with id " + id + " not found!"
    }
    if (filtered.length > 1) {
      throw "Multiple features with id " + id + " found!"
    }
    return filtered[0]
  }
  get_features(){
    return this.features
  }
  split_annoated_polygons(){
    return split(this.features,(x) => x.type == "Feature" && x.geometry.type == "Polygon" && "jiggler" in x.properties)
  }
  split_polygons(){
    return split(this.features,(x) => x.type == "Feature" && x.geometry.type == "Polygon")
  }
  get_polygon_features(){
    return this.features.filter((feature) => feature.type == "Feature" && feature.geometry.type == "Polygon")
  }
  get_other_features(){
    return this.features.filter((feature) => feature.type != "Feature" || feature.geometry.type != "Polygon")
  }
  get_annotated_polygons() {
    return this.features.filter((feature) => feature.type == "Feature" && feature.geometry.type == "Polygon" && "jiggler" in feature.properties)
  }
  is_annotated_polygon(feature){
    return feature.type == "Feature" && feature.geometry.type == "Polygon" && "jiggler" in feature.properties
  }
  is_polygon(feature){
    return feature.type == "Feature" && feature.geometry.type == "Polygon"
  }
}

function build_geojson(features){
  return JSON.stringify(
    {
      "type": "FeatureCollection",
      "features": features
    },
    null,
    1
  )
}
function load_file(file){
  let geojson = JSON.parse(fs.readFileSync(file));
  return new GeoJson(geojson.features)
}

exports.GeoJson = GeoJson
exports.build_geojson = build_geojson
exports.load_file = load_file
