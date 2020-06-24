var TilesetLoader = require('./tileset_loader.js')
var CommonUtils = require('../common_utils.js')
var GeoJsonLoader = require('../GeoJsonLoader.js')
var ImagePlot = require('../ImagePlot.js')
var async = require('async')
const fs = require('fs')


class SessionManager {
  constructor(authenticate_fn,allowed_users){
    this.session_by_id = {}
    this.session_by_user = {}
    this.allowed_users = allowed_users
  }
  authenticate(uid, callb) {
    if (! this.allowed_users.includes(uid)) {
      return callb("invalid user-id",null)
    }
    // delete previous user session if it exists
    if (uid in this.session_by_user) {
      let old_session = this.session_by_user[uid].session_id;
      delete this.session_by_id[old_session]
      delete this.session_by_user[uid]
    }

    // generate a new session for this user
    let session = {uid : uid, session_id : CommonUtils.get_random_id(20)}
    this.session_by_user[uid] = session
    this.session_by_id[session.session_id] = session
    return callb(null,session)
  }
  verify(session_id,callb){
    if (session_id in this.session_by_id) {
      return callb(null,this.session_by_id[session_id])
    }
    return callb("session not found",null)
  }
}

// This class is constructed with a GeoJson Object defined in GeoJsonLoader.js
// This class tries to balance work by user
class WorkGeneratorGeoJson {
  constructor(geojson, repeat_on_finish=false){
    this.geojson = geojson
    this.user_work_queue = {}
    this.repeat_on_finish = repeat_on_finish
  }
  generateWork(uid){
    let uwq = this.user_work_queue
    if ( (! (uid in uwq)) || uwq[uid].length == 0) {
      if ( uid in uwq && uwq[uid].length == 0){
        console.log("################################################")
        console.log("User " + uid + " finished the work!")
        console.log("################################################")
        if(!this.repeat_on_finish) return null;
      }
      uwq[uid] = this.geojson.get_annotated_polygons()
    }
    return uwq[uid].pop()
  }
  getImage(problem_id,callb){
    let feature = this.geojson.find(problem_id)
    TilesetLoader.getImageBuilder(false,(err,img_builder )=> {
      let tiles = feature.properties.jiggler.projection.tiles
      img_builder.build_image(tiles,feature.properties.jiggler.projection.url,feature.properties.jiggler.projection.zoomlevel,
        (err,img) => {
          img_builder.quit()
          if(err) return callb("error building image",null)
          else {
            ImagePlot.plot_polygon_to_image(img,feature.properties.jiggler.polygon)
            img.getBuffer('image/png',(err,imgdata) => callb(err,imgdata))
          }
        })
    })
  }
}


class SolutionAcceptorJsonFile {
  constructor(output_path,append = true){
    this.write_stream = fs.createWriteStream(output_path, {flags : append ? 'a' : 'w'})
  }

  storeSolution(session,work, solution, callb){
    let d = new Date()
    let work_store = {
      uid : session.uid,
      sid : session.session_id,
      work : work,
      res : solution,
      timestamp : d.toUTCString(),
      epoch : d.getTime()
    }
    let serialized = JSON.stringify(work_store)
    this.write_stream.write(serialized)
    this.write_stream.write("\n")
    return callb(null,true)
  }
}


// check function must check weather solution is an acceptable solution for work
class WorkManager {
  constructor(work_generator,solution_acceptor,check_fn = (work,solution) => true) {
    this.work_generator = work_generator
    this.solution_acceptor = solution_acceptor
    this.work_for_user = {}
    this.check_work_fn = check_fn
  }
  getWork(uid,callb){
    if (uid in this.work_for_user) {
      return callb(null,this.work_for_user[uid])
    }
    let work = this.work_generator.generateWork(uid)
    if(work == null){
      return callb("No work available",null)
    }
    this.work_for_user[uid] = work
    return callb(null,work)
  }
  submitWork(session,solution,callb){
    let uid = session.uid
    if (! (uid in this.work_for_user)) {
      return callb("no work user user found",null)
    }
    let work = this.work_for_user[uid]
    if (!this.check_work_fn(work,solution)){
      return callb("solution rejected",null)
    }
    delete this.work_for_user[uid]
    return this.solution_acceptor.storeSolution(session,work,solution,callb)
  }
  get generator(){
    return this.work_generator
  }
  get acceptor(){
    return this.solution_acceptor
  }
}


const polygon_voter_default_config = {
  "authenticate" : {
    "allowed_users" : ["tvd","nfi"]
  },
  "geojson_input" : "server-data/geo.json",
  "json_output" : "server-data/dump.sjson",
}

class PolygonVoter {
  constructor(configuration = polygon_voter_default_config){
    this.config = configuration
    this.sessions = new SessionManager(() => true, this.config.authenticate.allowed_users)
    let work_generator = new WorkGeneratorGeoJson(GeoJsonLoader.load_file(configuration.geojson_input),false)
    let solution_acceptor = new SolutionAcceptorJsonFile(configuration.json_output)
    this.work_manager = new WorkManager(work_generator,solution_acceptor, (work,solution) => {
      if (solution.id == work.properties.id) return true
      else return false
    })
  }
  // query {"uid"}
  apiAuthenticate(req,res){
    let query = req.query
    async.waterfall([
        (cb) => this.sessions.authenticate(query.uid,cb),
        (session,cb) => res.status(200).send(session)
      ],
      (err,ok) => {
        if(err) {res.status(501).send(err)}
      })
  }
  apiGetWork(req,res){
    let query = req.query
    let session = null
    async.waterfall([
      (cb) => this.sessions.verify(query.session_id,cb),
      (sess,cb) => {
        session = sess
        this.work_manager.getWork(session.uid,cb)
      },
    ],(err,work) => {
        if(err) {res.status(501).send(err)}
      else res.status(200).send({"pid" : work.properties.id})
    })
  }
  apiGetImage(req,res){ // TODO: implement authentication for this function, too!
    let query = req.query
    this.work_manager.generator.getImage(query.pid,(err,imgpng) => {
      if(err) {
        return res.status(501).send("error generating image")
      }
      else{
        res.writeHead(200, {'Content-Type': 'image/png','Content-Size' : imgpng.length})
        res.write(imgpng)
        res.end()
      }
    })
  }
  apiSubmitSolution(req,res){
    let query = req.body
    let session = null
    console.log(query)
    async.waterfall([
      (cb) => this.sessions.verify(query.session_id,cb),
      (sess,cb) => {
        this.work_manager.submitWork(sess,query.solution,cb)
      },
    ],(err,work) => {
        if(err) {res.status(501).send(err)}
        else res.status(200).send({"res":"ok"})
    })
  }
}

exports.PolygonVoter = PolygonVoter
