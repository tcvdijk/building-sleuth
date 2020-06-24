var async = require("async");
var request = require('request').defaults({ encoding: null });
var Jimp = require('jimp')

var redis = require("redis")
var Geo = require("../Geo.js")
var JiggleAlgorithm = require("../JiggleAlgorithm.js")

function fill_tileset_url_placeholders(url,x,y,z){
  return url.replace("{x}",x)
            .replace("{y}",y)
            .replace("{z}",z)
}

function dl_file(url,callb){
  request.get(url, (err,res,body) => callb(err,body));
}

function full_lerp(sA,sB,tA,tB,val){
  let sG = sB - sA
  let valG = val - sA
  let sP = valG / sG
  let tG = tB - tA
  let res = tG * sP + tA
  return res
}

function getImageBuilder(use_redis, callb) {
  var redis_client = (() => {
    if(use_redis) return redis.createClient()
    else return null}) ();
  var redis_connected = false

  function dl_file_cached(url,callb){
    if(redis_connected == false){
      return dl_file(url,callb)
    }
    else{
      redis_client.get("polygon-jiggler:urls:"+url,(err,res) => {
        if(err || res == null || res === undefined){
          // console.error("not cached " + url)
          return dl_file(url,(err,file_buffer) => {
            if(err) callb(err,null)
            else{
              redis_client.set("polygon-jiggler:urls:"+url,file_buffer.toString('binary'),(err,_) => {
                if(err) console.error("error storing " + url + " to redis")
                else{
                  // console.error("stored " + url + " successfully")
                }
              })
              return callb(null,file_buffer)
            }
          })
        }
        else{
          //console.error("cached " + url)
          return callb(null,Buffer.from(res,'binary'))
        }
      } )
    }
  }
  function quit() {
    if(redis_client) redis_client.quit()
  }
  function build_image(tiles,url,zoomlevel,callback){
    let [ul_x,ul_y,x_tiles,y_tiles] = tiles
    if(!x_tiles || ! y_tiles){
      return callb("error fitting region",null);
    }
    // build url array
    let urls = []
    let stich = []
    // TODO: fix this for other places ( not only NY)
    for(let x = 0; x < x_tiles; x++){
      for(let y = 0; y < y_tiles; y++){
        urls.push(fill_tileset_url_placeholders(url,x + ul_x,y + ul_y,zoomlevel))
        stich.push([x,y])
      }
    }
    const tile_resolution = 256;
    async.waterfall([
      (callb) => {
        async.map(urls,dl_file_cached,callb)
      },
      (img_buffers,callb) => {
          async.map(img_buffers,Jimp.read,callb)
      },
      (imgs,callb) => {
        new Jimp(tile_resolution * x_tiles,tile_resolution * y_tiles, (err,img) => {
          callb(err,img,imgs)
        })
      },
      (img,imgs,callb) => {
        for(let i = 0; i < imgs.length; i++){
          img.blit(imgs[i],stich[i][0] * tile_resolution,stich[i][1]*tile_resolution)
        }
        callb(null,img)
      }
    ],callback)
  }

  function build_image_pngdata(tiles, url,zoomlevel, callb){
    build_image(tiles,url,zoomlevel,(err,img) => {
        if(err) return callb(err,null)
        else return img.getBuffer('image/png',callb)
      })
  }


  function processed_image(tiles,url,zoomlevel, options,callb){
    if (options == null) {
      options = JiggleAlgorithm.default_processing_options()
    }
    return async.waterfall([
      (callb) => {
        build_image(tiles,url,zoomlevel, callb)
      },
      (img,callb) => {
        let bm = img.bitmap
        let processed_img = JiggleAlgorithm.process_rgba_image(bm.data,bm.width,bm.height, options)
        return callb(null,processed_img)
      }
    ],callb)
  }
  var ImageBuilder = {
    quit : quit,
    build_image : build_image,
    build_image_pngdata : build_image_pngdata,
    processed_image : processed_image
  }
  if(use_redis){
    redis_client.on("connect",() => {redis_connected = true; callb(null,ImageBuilder)})
    redis_client.on("error", (err) => {
      console.error("Should use redis but couldn't connect :(")
      console.error("Downloaded tiles will not be cached!")
      redis_client.quit(); // quit the client so that we do not receive any more events
      callb(null,ImageBuilder)})
  }
  else{
    return callb(null,ImageBuilder)
  }
}


exports.dl_file = dl_file
exports.getImageBuilder = getImageBuilder
