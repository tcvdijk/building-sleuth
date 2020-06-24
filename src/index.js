// # Constant Definitions

const maxFailCount = 300
const maxSteps = 1000
const framerate = 30

import swal from 'sweetalert';

const api_host = "localhost:8080"
const JiggleAlgorithm = require('./JiggleAlgorithm.js')
import L from 'leaflet'
import m from 'mithril'
import mat from 'materialize'
import buildUrl from 'build-url'
const CommonUtils = require('./common_utils.js')
const Geo = require('./Geo.js')


require('./leaflet-areaselect.js')
// # Helper functions
function get_pixel_array_from_image(img){
  let canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  let context = canvas.getContext('2d')
  context.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
  return context.getImageData(0,0,img.naturalWidth,img.naturalHeight).data
}

function get_data_url_from_greyscale(greyscale){
  let canvas = document.createElement("canvas")
  canvas.width = greyscale.width
  canvas.height = greyscale.height
  let ctx = canvas.getContext("2d")
  let img_data = ctx.createImageData(greyscale.width, greyscale.height)
  for(let i = 0; i < greyscale.pixel_count(); i++){
    img_data.data[4 * i + 0] = Math.floor(greyscale.data[i] * 256)
    img_data.data[4 * i + 1] = Math.floor(greyscale.data[i] * 256)
    img_data.data[4 * i + 2] = Math.floor(greyscale.data[i] * 256)
    img_data.data[4 * i + 3] = 255
  }
  ctx.putImageData(img_data,0,0)
  let data_url = canvas.toDataURL("image/png")
  // TODO: delete the context !?!
  return data_url
}

const FileInputComponent = {
  // Attributes :
  // file_input_id, submit, button_text
  view: (vn) =>
    m('form',[
      m('input',{type:'file',id:vn.attrs.file_input_id}),
        m('a.waves-effect.waves-light.btn',{
          onclick: (e)=> {
            'submit' in vn.attrs ? vn.attrs.submit(e) : null
          }
        },vn.attrs.button_text)
    ])
}

class MapDisplay{
  // Attributes for MapDisplay:
  // attrs = {
  // image_src : src for the image to display
  // polygon : polygon object to display
  //}
  constructor(){
    this.draggingIndex = -1
    this.draggingMoved = false
    this.dimensions = {width: 0, height: 0}
    this.natural_dimensions = {width: 0, height: 0}
  }
  view(vn){
    return [
      m('div', {id: 'canvas-container',class : 'noselect'}, [
        m('img', {
          id: 'image',
          class: 'center',
          src: vn.attrs.image_src,
          //max_width : "100%",
          //max_height : "100%",
          onload: (event) => {
            document.getElementById('canvas-container').className = 'noselect';

            const img = event.target
            this.dimensions = {
              width: img.width,
              height: img.height
            }

            this.natural_dimensions = {
              width: img.naturalWidth,
              height: img.naturalHeight
            }
          },
          onresize: (event) => {
            // change the dimensions
            const img = event.target;
            const scaling_factor =  img.width / vnode.state.data.dimensions.width
            this.dimensions = {
              width: img.width,
              height: img.height
            }
            /* TODO: find a way to scale all points and edges */
            /*console.log(scaling_factor)
            vn.attrs.polygon = vnode.state.data.polygon.map(
              (p) => {
                [p[0] * scaling_factor, p[1] * scaling_factor]
              }
            )*/

          }
        }),
        m('svg', {
          id: 'polygon',
          class: 'center',
          width: this.dimensions.width,
          height: this.dimensions.height,
          onmousemove: (event) => {
            if (vn.state.draggingIndex === -1) {
              event.redraw = false
              return
            }
            vn.state.draggingMoved = true
            let svg_pos = document.getElementById('polygon').getBoundingClientRect();
            const point = [
              event.pageX - svg_pos.left - window.scrollX,
              event.pageY - svg_pos.top - window.scrollY
            ]

            vn.attrs.polygon.points[this.draggingIndex] = point

            /*if (vnode.attrs.edge_update_fn){
              vn.attrs.polygon.update_edge_score()
              vnode.attrs.edge_update_fn(vnode,vnode.state.data.draggingIndex - 1);
              vnode.attrs.edge_update_fn(vnode,vnode.state.data.draggingIndex);
            }*/ // just update edge scores before drawing anything
          },
          onmousedown: (event) => {
            if(vn.attrs.polygon.count() >= 3) return;
            if(this.draggingIndex === -1){
              const point = [
                event.offsetX,
                event.offsetY
              ]

              vn.attrs.polygon.points.push(point)
              vn.attrs.polygon.update_edge_scores(vn.attrs.get_pixel_fn)

              /*if (vnode.attrs.edge_update_fn){
                vnode.attrs.edge_update_fn(vnode,vnode.state.data.polygon.length - 1);
                vnode.attrs.edge_update_fn(vnode,vnode.state.data.polygon.length - 2);
              }*/
            }
          }
        }, [
          m('g', {
            id: 'polygon-edges'
          }, vn.attrs.polygon.points
            .map((point, index) => m('line', {
              x1: vn.attrs.polygon.points[(index - 1 + vn.attrs.polygon.count()) % vn.attrs.polygon.count()][0],
              y1: vn.attrs.polygon.points[(index - 1 + vn.attrs.polygon.count()) % vn.attrs.polygon.count()][1],
              x2: point[0],
              y2: point[1],
              stroke: vn.attrs.polygon.edge_rgba(index),
              onmousedown: (event) => {
                if(this.draggingIndex === -1){
                  let svg_pos = document.getElementById('polygon').getBoundingClientRect();
                  const point = [
                    event.pageX - svg_pos.left - window.scrollX,
                    event.pageY - svg_pos.top - window.scrollY
                  ]
                  vn.attrs.polygon.points.splice(index, 0, point)

                  vn.attrs.polygon.edge_scores.splice(index - 1, 0, 0)
                  vn.attrs.polygon.update_edge_scores(vn.attrs.get_pixel_fn)

                  /*if (vnode.attrs.edge_update_fn){
                    vnode.attrs.edge_update_fn(vnode,index - 1);
                    vnode.attrs.edge_update_fn(vnode,index);
                  }*/

                  this.draggingIndex = index
                  vn.attrs.on_start_drag()
                  event.stopPropagation()
                }
              },
              onmouseenter: (event) => {
                event.target.setAttribute("stroke","#0000FF");
              },
              onmouseleave: (event) => {
                event.target.setAttribute("stroke",vn.attrs.polygon.edge_rgba(index));
              }
            })
          )),
          m('g', {
            id: 'polygon-vertices'
          }, vn.attrs.polygon.points
            .map((point, index) => m('circle', {
              cx: point[0],
              cy: point[1],
              r: 6,
              onmousedown: (event) => {
                if(this.draggingIndex === -1 ){
                  this.draggingIndex = index
                  vn.attrs.on_start_drag()
                  event.stopPropagation()
                }
              },
              onmouseup: (event) => {
                if (!vn.state.draggingMoved && vn.state.draggingIndex === index) {
                  vn.attrs.polygon.points.splice(index, 1)
                  vn.attrs.polygon.update_edge_score(index - 1,vn.attrs.get_pixel_fn)
                }
                this.draggingIndex = -1
                this.draggingMoved = false
                vn.attrs.on_end_drag()
                event.stopPropagation()
              },
              onmouseenter: (event) => {
                event.target.setAttribute("fill","#0000FF");
              },
              onmouseleave: (event) => {
                event.target.setAttribute("fill","#000000");
              }
            }))
          )
        ])
      ])
    ]
  }

}

const JiggleControls = {
  data: {
    jiggles_fps: 0.0,
    last_update: null,
    fps_counter : 0,
    is_jiggling: false
  },

  view: (vnode) => [
    m('div.row',[
      m(FileInputComponent,{button_text: 'Load Image', submit : (e) => vnode.attrs.from_file(e), file_input_id : vnode.attrs.file_input_id}),
      m(ImageInfoComponent,{info : vnode.attrs.image_info}),
      m('div.col.s6',[
        m('label',[
          m('input',{type:'checkbox',checked : vnode.attrs.show_greyscale, onclick: vnode.attrs.onclick_show_greyscale}),
          m('span','Show Processed Image')
        ]),

        //m('p','Average brightness: ' + brightness in vnode.attrs ? vnode.attrs.brightness : "n/a"), // TODO: this would be great!
        m('a.waves-effect.waves-light.btn', {
          onclick : (event) => {
              if(vnode.attrs.onSubmit) vnode.attrs.onSubmit(event)
          }
        },'Submit Polygon')]
      )
    ]),
    m('div.row',[
    m('div.switch.col.s6',m('label',[
      m('input',{type:"checkbox",checked: vnode.attrs.is_jiggling,
      oninput: (event) => {
        if(vnode.attrs.onToggle) vnode.attrs.onToggle(event)
      }}),
      m('span.lever'),
      'Jiggling'
    ])),
    m('div.col.s6',{},vnode.state.data.jiggles_fps + " jiggles / s"),
    m(ProcessingOptsComponent,{
      processing_options : vnode.attrs.processing_options,
      onclick_mix5050 : vnode.attrs.onclick_mix5050,
      onchange_blur_radius : vnode.attrs.onchange_blur_radius,
      onchange_search_size: vnode.attrs.onchange_search_size
    })
  ])
  ]
}

class JigglerImageInfo{
  constructor(inf){
    this.tileset_source = inf.tileset_source
    this.file_source = inf.file_source
  }
  is_from_tileset(){
    return this.tileset_source != null
  }
  is_from_file(){
    return this.file_source != null
  }
}

function image_info_from_tileset(region,zoomlevel,tiles_url,image_url){
  return new JigglerImageInfo({
    tileset_source : {
      region : region,
      tiles_url : tiles_url,
      zoomlevel : zoomlevel,
      image_url : image_url
    },
    file_source : null,
  })
}

function image_info_from_file(filename){
  return new JigglerImageInfo({
    tileset_source : null,
    file_source : {
      filename : filename
    }
  })
}

function image_info_empty(){
  return new JigglerImageInfo({
    tileset_source : null,
    file_source : null
  })
}

class JigglerAppState {
  reset(){
    this.polygon = new JiggleAlgorithm.JigglePolygon()
    this.image_info = image_info_empty()

    this.image_element = null
    this.image_src = null
    this.greyscale_img = null
    this.processed_img = null
    this.processing_options = JiggleAlgorithm.default_processing_options()

    // View State
    this.show_map = false
    this.show_greyscale = false // show the greyscale image

    // Jiggling state
    this.stopJiggling()
    this.is_jiggling = false
    this.jiggle_interval_id= null
    this.consecutive_failed =  0
    this.jiggle_search_size = 20

    // Human Interaction state
    this.is_dragging = false
  }
  constructor(){
    this.jiggle_interval_id = null
    this.reset()
  }
  get_pixel_fn(){
    return (x,y) => {
      // TODO: scaling factor
      return this.processed_img.pixel(Math.round(x),Math.round(y))
    }
  }
  showGreyscale(show){
    this.show_greyscale = show
    if(show){
      this.image_src = get_data_url_from_greyscale(this.processed_img)
    //  this.image_element.src = this.image_src
    }
    else{
      this.image_src = this.original_source
    }
    m.redraw()
  }
  regenerateGreyscale(){
    this.stopJiggling()
    this.processed_img = JiggleAlgorithm.process_greyscale_image(this.greyscale_img,this.processing_options)
    if(this.polygon) this.polygon.update_edge_scores(this.get_pixel_fn())
    this.showGreyscale(this.show_greyscale)
  }
  setProcessingOptions(new_options){
    this.processing_options = new_options
    if(this.greyscale_img) this.regenerateGreyscale()
    // reprocess the image
  }
  // get a random image from the api
  nextImageFromFile(filename,data_url){
    this.reset()
    let img = new Image()
    this.image_element = img
    this.image_info = image_info_from_file(filename)
    this.original_source = data_url
    img.onload = (e) => {
      let pix_array = get_pixel_array_from_image(img)
      const w = img.naturalWidth
      const h = img.naturalHeight
      let greyscale_img = JiggleAlgorithm.rgba_to_greyscale(pix_array,w,h)
      this.greyscale_img = greyscale_img
      this.show_map = true
      this.regenerateGreyscale()
      m.redraw()
    }
    this.image_src = data_url
    img.src = data_url
    m.redraw()
  }
  nextImageTileset(url,tileset_url,zoomlevel, region){
    this.reset()
    let img = new Image()
    this.image_element = img
    this.image_info = image_info_from_tileset(region,zoomlevel,tileset_url,url)
    this.original_source = url
    img.onload = (e) => {
      let pix_array = get_pixel_array_from_image(img)
      const w = img.naturalWidth
      const h = img.naturalHeight
      let greyscale_img = JiggleAlgorithm.rgba_to_greyscale(pix_array,w,h)
      this.greyscale_img = greyscale_img
      this.show_map = true
      this.regenerateGreyscale()
      m.redraw()
    }
    this.image_src = url
    img.src = url
    m.redraw()
  }
  startJiggling(){
    this.is_jiggling = true
    this.jiggle_interval_id = setInterval(() => this.jiggle(),1)
  }
  stopJiggling(){
    this.is_jiggling = false
    if(this.jiggle_interval_id != null){
      clearInterval(this.jiggle_interval_id)
    }
    this.jiggle_interval_id = null
  }
  jiggle(){
    /* do not jiggle when currently dragging */
    let should_redraw = false;
    if(this.is_dragging) return;

    const getPixel = this.get_pixel_fn()
    this.polygon.update_edge_scores(getPixel)
    const results = this.polygon.search_step(
      {width: this.processed_img.width,height: this.processed_img.height}, // TODO: scaling !
      getPixel )

    if(results){
      this.polygon.points = results.points
      this.polygon.edge_scores = results.edge_scores
      should_redraw = true;
    }
    else{JiggleControls
      /* nothing here yet */
    }
    // TODO: implement FPS counter
    //let jig_state = vnode.state.subs.jiggle_controls.state;
    // update the jiggles / seconds counter
    //var seconds = Math.round(new Date().getTime() / 1000);
    /*if (jig_state.data.last_update != seconds){
      jig_state.data.last_update = seconds;
      jig_state.data.jiggles_fps = jig_state.data.fps_counter;
      jig_state.data.fps_counter = 1;
      should_redraw = true;
    }
    else{
      jig_state.data.fps_counter++;
    }*/
    if(should_redraw) m.redraw()
  }
  submit_polygon(){
    if(!this.is_from_tileset){
      swal(JSON.stringify({
        image_file : this.image_filename,
        polygon_data: this.polygon.points,
        edge_scores : this.polygon.edge_score
      }))
      return 0;
    }
    const url = "http://" + api_host+"/api/polygon";
    console.log(url)
    const ageojson = {
      "type": "FeatureCollection",
      "features": [
        {
          type:"Feature",
          geometry: {
            type:"Polygon",
            coordinates: [this.polygon.points.map((p) => Geo.polypoint_to_wgs84(p,this.tileset_region,this.tileset_zoomlevel).reverse())]
          },
          properties : {
            id : CommonUtils.get_random_id(),
            timestamp : Date.now(),
            jiggler: {
              polygon : this.polygon.points,
              edge_scores : this.polygon.edge_scores,
              tileset : {
                url : this.tileset_url,
                zoomlevel : this.tileset_zoomlevel,
                exact : false
              },
              region : this.tileset_region
            }
          }
        }
      ]
    }
    m.request({
      method: "POST",
      url: url,
      data: ageojson
    })
    .then((data) => {
      swal("submitted")
      this.nextImageRandApi()
    }).catch((e) => {
      console.log(e)
      swal('error sending data to server!')
    })
  }
}
const jiggler_app_state = new JigglerAppState();
//jiggler_app_state.nextImageRandApi()


const ImageInfoComponent = {
  view: (vn) => {
    let info = vn.attrs.info
    let disp = []
    if (info.is_from_tileset()) {
      disp = [
        m('p',"Region: " + JSON.stringify(vn.attrs.info.tileset_source.region)),
        m('p', "Url: " + vn.attrs.info.tileset_source.tiles_url),
        m('p', "Zoom: " + vn.attrs.info.tileset_source.zoomlevel)
      ]
      // build tileset image info
    }
    else if(info.is_from_file()) {
      disp = [
        m('p','File name: ' + info.image_info)
      ]
    }
    return m('div.row.card-panel.darken-2',[
      m('b','Image Info'),
      disp
    ])
  }
}

const ProcessingOptsComponent = {
  view: (vn) => {
    let opts = vn.attrs.processing_options
    return m('div.row.card-panel.darken-2',[
        m('br'),m('br'),
        m('b','Processing Options',[
          m('br'),
          m('label',[
            m('input',{type:'checkbox',checked : opts.mix5050, onclick: vn.attrs.onclick_mix5050}),
            m('span','Mix 50/50')
          ]),
          m('p.range-field','Blur Radius',[
            m('input',{type: 'range',value : opts.blur_radius, min : 0, max: 20,onchange : vn.attrs.onchange_blur_radius}),
            m('span',' (' + opts.blur_radius + ')')
          ])
        ],
        m('p.range-field','Search Size',[
          m('input',{type: 'range',value : jiggler_app_state.jiggle_search_size, min : 1, max: 100,onchange : vn.attrs.onchange_search_size}),
          m('span',' (' + jiggler_app_state.jiggle_search_size + ')')
        ]),
      )
    ])
  }
}

const JiggleComponent = {
  subs : {
    map_display: null,
    jiggle_controls: null
  },
  view: (vnode) => m('div.row',{style: "padding-top: 30px"},[
    m('div.col.s3.leafletview-leftbar',[
      m(JiggleControls,{
        file_input_id : 'loadimagefromfile',
        is_jiggling: jiggler_app_state.is_jiggling,
        image_info : jiggler_app_state.image_info,
        from_file : (e) => {
          let file = document.getElementById('loadimagefromfile').files[0]
          let reader = new FileReader()
          reader.onload = (e) => jiggler_app_state.nextImageFromFile('filename',reader.result)
          reader.readAsDataURL(file)
        },
        onToggle: (event) => {
          if(event.target.checked){
            jiggler_app_state.startJiggling()
          }
          else{
            jiggler_app_state.stopJiggling()
          }
          /*if(vnode.state.data.jiggleIntervalID)
            vnode.state.stopJiggling(vnode)
          else
            vnode.state.startJiggling(vnode)*/
        },
        onSubmit : (event) => {
          jiggler_app_state.submit_polygon()
        },
        show_greyscale : jiggler_app_state.show_greyscale,
        onclick_show_greyscale : (e) => {
          jiggler_app_state.showGreyscale(e.target.checked)
        },
        processing_options : jiggler_app_state.processing_options,
        onclick_mix5050 : (e) => {
          jiggler_app_state.processing_options.mix5050 = e.target.checked,
          jiggler_app_state.setProcessingOptions(jiggler_app_state.processing_options)
        },
      onchange_blur_radius : (e) => {
        jiggler_app_state.processing_options.blur_radius = e.target.value
        jiggler_app_state.setProcessingOptions(jiggler_app_state.processing_options)
      },
      onchange_search_size : (e) => {
        debugger;
        jiggler_app_state.jiggle_search_size = e.target.value
        m.redraw()
      }
    })
    ]),
    m('div.col.s9',[m('div.container',[
      jiggler_app_state.show_map
          ? m(MapDisplay,{
            on_start_drag : () => {jiggler_app_state.is_dragging = true},
            on_end_drag : () => {jiggler_app_state.is_dragging = false},
            image_src : jiggler_app_state.image_src,
            polygon : jiggler_app_state.polygon,
            get_pixel_fn: jiggler_app_state.get_pixel_fn()})
          : m('div.progress',m('div.indeterminate'))
      ])
    ])
  ])
}

const Predefined_Layers = [
  { id : 1,
    nypl_layer_id : 859,
    name : "Unknown",
    attribution: "From: <a href='http://digitalcollections.nypl.org/search/index?filters[title_uuid_s][]=Maps%20of%20the%20city%20of%20New%20York.||06fd4630-c603-012f-17f8-58d385a7bc34&keywords=&layout=false%22%3E'>NYPL Digital Collections</a> | <a href='http://maps.nypl.org/warper/layers/859/'>Warper</a>",
    url : "http://maptiles.nypl.org/859/{z}/{x}/{y}.png",
    center: [ 40.752995172027674, -73.9825451374054],
    center_zoom : 18,
    max_zoom : 21
  }
]

class ImageExtractState{
  reset(){
    this.leaflet_map = null
    this.tile_layer = null
    this.areaselect = null
    this.current_tileset_url = null
    this.current_tileset_id = null
  }
  constructor(){
    this.reset()
  }
  load_predefined_layer(id){
    let selected = Predefined_Layers.filter((layer) => layer.id == id)
    if(selected.length != 1){
      console.log("Too many results for id " + id + " in Predefined_Layers")
      return
    }
    selected = selected[0]
    let mymap = L.map('leafletmap').setView(selected.center,selected.center_zoom)
    let mylayer = L.tileLayer(selected.url, {
        attribution: selected.attribution,
        maxZoom: selected.max_zoom,
      }).addTo(mymap)

    var areaSelect = L.areaSelect({width:200, height:300});
    areaSelect.addTo(mymap);
    areaSelect.on("change",m.redraw)
    this.leaflet_map = mymap
    this.tile_layer = mylayer
    this.areaselect = areaSelect
    this.current_tileset_url = selected.url
    this.current_tileset_id = id
  }
  jiggle_selected_area(){
    let current_zoom = this.leaflet_map.getZoom()
    let area_bounds = this.areaselect.getBounds()
    let url = buildUrl("/api/buildimage",
      {
        queryParams: {
          nelat : area_bounds._northEast.lat,
          nelon : area_bounds._northEast.lng,
          swlat : area_bounds._southWest.lat,
          swlon : area_bounds._southWest.lng,
          zoomlevel : current_zoom,
          url : this.current_tileset_url
        }
      })
    jiggler_app_state.nextImageTileset(url,this.current_tileset_url,current_zoom, [
      area_bounds._southWest.lat,
      area_bounds._southWest.lng,
      area_bounds._northEast.lat,
      area_bounds._northEast.lng
      ])
    window.location.href="/#!/jiggler"
  }
}
const image_extract_state = new ImageExtractState()

const LeafletView = {
  initialized_map : false,
  location_filter : null,
  oncreate: (vn) => {
    image_extract_state.load_predefined_layer(1)
  },
  view : (vn) => m('div.row',[
    m('div.col.s3.leafletview-leftbar',[
      m('form',[
        m('div.input-field',{id: 'ne_lat',type:'text'},image_extract_state.areaselect ? image_extract_state.areaselect.getBounds()._northEast.lat : ""),
        m('label',{for: 'ne_lat'},'ne_lat'),
        m('div.input-field',{id: 'ne_lon',type:'text'},image_extract_state.areaselect ? image_extract_state.areaselect.getBounds()._northEast.lng : ""),
        m('label',{for: 'ne_lon'},'ne_lon'),
        m('div.input-field',{id: 'sw_lat',type:'text'},image_extract_state.areaselect ? image_extract_state.areaselect.getBounds()._southWest.lat : ""),
        m('label',{for: 'sw_lat'},'sw_lat'),
        m('div.input-field',{id: 'sw_lon',type:'text'},image_extract_state.areaselect ? image_extract_state.areaselect.getBounds()._southWest.lng : ""),
        m('label',{for: 'sw_lon'},'sw_lon'),
        m('div.input-field',{id: 'leaf_zoom',type:'text'},image_extract_state.leaflet_map ? image_extract_state.leaflet_map.getZoom() : ""),
        m('label',{for: 'leaf_zoom'},'zoomlevel')
      ]), // left panel
      m('a.waves-effect.waves-light.btn', {
        onclick : (event) => {
            image_extract_state.jiggle_selected_area()
        }
      },'Jiggle selected Area')
    ]),
    m('div.col.s9',[ //right panel
      m('div#leafletmap',{
        key: 1,
        style: 'height: ' + (Math.max(document.documentElement.clientHeight, window.innerHeight || 0) - document.getElementById('navbar').offsetHeight - 20) + 'px'
      })
    ])
  ])
}

class GeojsonViewAppState {
  reset(){
    this.leaflet_map = null
    this.tile_layer = null
    this.current_geojson = null
  }
  constructor(){
    this.reset()
  }
  openGeojson(e){
    if(this.leaflet_map){
      this.leaflet_map.off()
      this.leaflet_map.remove()
    }
    let file = document.getElementById('geojsoninputfile').files[0]
    let reader = new FileReader()
    reader.onload = (e) => {
      var contents = e.target.result;
      // get the first tile layer url
      var geojson = JSON.parse(contents)
      var tilelayer_url = geojson.features[0].properties.jiggler.projection.url
      let center_point = Geo.polygon_center(geojson.features[0].geometry.coordinates[0])
      center_point = center_point.reverse()
      let mymap = L.map('geojsonviewmap').setView(center_point,geojson.features[0].properties.jiggler.projection.zoomlevel)
      let mylayer = L.tileLayer(tilelayer_url, {
          attribution: "",
          maxZoom: 20,
        }).addTo(mymap)
      this.leaflet_map = mymap
      this.tile_layer = mylayer
      L.geoJSON(geojson.features,{
        style: (feature) => {
          if ("fill" in feature.properties) {
            return {"color" : feature.properties.fill}
          }
          else {
            return {}
          }
        }
      }).addTo(mymap)
    }
    reader.readAsText(file)
  }
}
const geojson_view_state = new GeojsonViewAppState()



const GeojsonView = {
  initialized_map : false,
  location_filter : null,
  oncreate: (vn) => {

  },
  view : (vn) => m('div.row',[
    m('div.col.s3.leafletview-leftbar',[
      m(FileInputComponent,{
        button_text: 'Load Geojson',
        submit : (e) => geojson_view_state.openGeojson(e),
        file_input_id : 'geojsoninputfile'
      }),
    ]),
    m('div.col.s9',[ //right panel
      m('div#geojsonviewmap',{
        key: 1,
        style: 'height: ' + (Math.max(document.documentElement.clientHeight, window.innerHeight || 0) - document.getElementById('navbar').offsetHeight - 20) + 'px'
      })
    ])
  ])
}

class ImageVotingAppState {
  reset(){
    this.user_id = null
    this.is_authenticated = false
    this.session_id = null

    this.problem_id = null
    this.has_work = false
    this.are_buttons_enabled = false
    if ('key_event_listener' in this && this.key_event_listener != null){
      document.removeEventListener('keydown',this.key_event_listener)
    }
    this.key_event_listener = null
  }
  constructor() {
    this.reset()
  }
  add_key_event_listener(){
    this.key_event_listener = document.addEventListener('keydown', (e) => {
      if (e.keyCode == 38) this.submitYes() // up arrow key for yes
      else if (e.keyCode == 40) this.submitNo() // down arrow key for no
    })
  }
  authenticate(username){
    m.request({
      method: "GET",
      url: "/api/vote/authenticate",
      data: {"uid" : username}
    })
    .then((data) => {
      this.session_id = data.session_id
      this.user_id = data.uid
      this.is_authenticated = true
      this.add_key_event_listener()
      this.getWork()
    }).catch((e) => {
      console.log(e)
      swal('Error during authentication')
    })
  }
  getWork(){
    if(! this.is_authenticated) return;
    m.request({
      method: "GET",
      url: "/api/vote/work",
      data: {"session_id" : this.session_id}
    })
    .then((data) => {
      this.has_work = true
      this.problem_id = data.pid
    }).catch((e) => {
      console.log(e)
      swal('Cannot fetch work unit from server. Error: ' + e)
    })
  }
  submitSolution(solution){
    if(! this.has_work){
      swal('Cannot submit, no work unit loaded')
      return
    }
    m.request({
      method: "POST",
      url: "/api/vote/submit",
      data: {"session_id" : this.session_id,solution:{
        "id" : this.problem_id,
        "vote" : solution
      }}
    })
    .then((data) => {
      this.are_buttons_enabled = false;
      this.getWork()
    }).catch((e) => {
      console.log(e)
      swal('Cannot submit solution to server. Error: ' + e)
    })
  }
  submitYes(){
    if (this.are_buttons_enabled)
      this.submitSolution(1)
  }
  submitNo(){
    if (this.are_buttons_enabled)
      this.submitSolution(0)
  }
  getProblemImageUrl(){
    if(this.has_work == false) return ""
    else return "/api/vote/image?pid=" + this.problem_id
  }
  buttons_enabled(){
    return this.are_buttons_enabled;
  }
  image_loaded_callback(){
    setTimeout(() => { this.are_buttons_enabled = true; m.redraw()},1000)
  }
}

const image_voting_app_state = new ImageVotingAppState()

const ImageVotingView = {
  onremove: () => {
    image_voting_app_state.reset()
  },
  view: (vnode) => m('div.row',{style: "padding-top: 30px"},[
    m('div.col.s3.leafletview-leftbar',[
      m('form',[
        m('input.input-field',{
          id: 'voting_username',
          type:'text',
          readonly : image_voting_app_state.is_authenticated
        }),
        m('label',{for: 'voting_username'},'Username')
      ]), // left panel
      m('br'),
      m('a.waves-effect.waves-light.btn', {
        onclick : (event) => {
            image_voting_app_state.authenticate(document.getElementById("voting_username").value)
        },
        disabled : image_voting_app_state.is_authenticated
      },'Authenticate'),
      m('br'),
      m('p', "Session: " + (image_voting_app_state.is_authenticated ? image_voting_app_state.session_id : "")),
      m('p',"Problem ID: " + (image_voting_app_state.has_work ? image_voting_app_state.problem_id.toString() : "")),
      m('button.waves-effect.waves-light.btn.green', {
        onclick : (event) => {
            image_voting_app_state.submitYes()
            // deactivate the buttons until the image has been loaded
        },
        disabled : !image_voting_app_state.buttons_enabled()
      },/*[m('i.material-icons.right',"thumbs_up"),'Good']*/'Good	👍 '),
      m('button.waves-effect.waves-light.btn.red', {
        onclick : (event) => {
            image_voting_app_state.submitNo()
        },
        disabled : !image_voting_app_state.buttons_enabled()
      },'Wrong 👎 ')
    ]),
    m('div.col.s9',[m('div.container',[
      m('img',{
        src : image_voting_app_state.getProblemImageUrl(),
        onload : (ev) => {image_voting_app_state.image_loaded_callback()}
      })
      ])
    ])
  ])
}

m.route(document.getElementById("mp"), "/", {
    "/": LeafletView,
    "/jiggler" : JiggleComponent,
    "/mapview" : LeafletView,
    "/geojsonview" : GeojsonView,
    "/votingview" : ImageVotingView
})
