const express = require('express')
const fs = require('fs')
const path = require('path');
const process = require('process')
const CommonUtils = require('../common_utils.js')

const hostname="localhost"
const port=3000
const image_folder="./server-data/images"
const database_file="./server-data/db/res.db"
const polygons_directory = "./server-data/polygons/"
const async = require('async')
const ImageVote = require('./ImageVote.js')
var TilesetLoader = require('./tileset_loader.js')
const Geo = require("../Geo.js")


function store_polygon(req,res){
  let polygon_data = req.body

  const id = polygon_data.features[0].properties.id
  const filename = id + ".json"
  const file_path = path.join(polygons_directory,filename)
  fs.writeFile(file_path,JSON.stringify(polygon_data,null,2),(err) => {
    if(err){
      console.log("error writing file: " + filename)
      console.log(err)
    }
    res.status(200).send("")
  })
}

function handle_jiggler_image_request(req,res){
  TilesetLoader.getImageBuilder(false,(err,img_builder )=> {
    if(err){
      console.error(err)
      res.writeHead(501)
      res.end()
      return null;
    }
    let rb = req.query
    let tiles = Geo.region_to_tile_limiters([rb.swlat,rb.swlon,rb.nelat,rb.nelon],rb.zoomlevel)
    img_builder.build_image_pngdata(tiles,rb.url,rb.zoomlevel,
      (err,img) => {
        img_builder.quit()
        if(err) res.status(500).send("")
        else{
          res.writeHead(200, {'Content-Type': 'image/png','Content-Size' : img.length})
          res.write(img)
          res.end()
        }
      })
  })
}

let image_vote = new ImageVote.PolygonVoter()

const app = express()

app.use(express.json());
//app.use("/api/images",express.static(image_folder)) // to be removed
app.get('/api/buildimage',handle_jiggler_image_request)
app.post('/api/polygon',store_polygon)

// Image Voter
app.get('/api/vote/authenticate', (req,res) => image_vote.apiAuthenticate(req,res))
app.get('/api/vote/work', (req,res) => image_vote.apiGetWork(req,res))
app.get('/api/vote/image',(req,res) => image_vote.apiGetImage(req,res))
app.post('/api/vote/submit', (req,res) => image_vote.apiSubmitSolution(req,res))

app.listen(port, () => console.log('Example app listening on port 3000!'))
