
const LINE_SAMPLE_RESOLUTION = 5

// Use this class to store image data
// Might write a wrapper
// Date is stored as brightness (that is, floating point values)
class GreyscaleImage{
  constructor(array,w,h){
    this.data = array
    this.width = w
    this.height = h
  }
  pixel(x,y){
    return this.data[y * this.width + x]
  }
  rgba_array(){
    const image_len = this.data.length
    let new_img = new Array(image_len * 4)
    for (let pid = 0; pid < image_len; pid++){
      const pix = this.data[pid]
      new_img[pid * 4 + 0] = pix // R
      new_img[pid * 4 + 1] = pix // G
      new_img[pid * 4 + 2] = pix // B
      new_img[pid * 4 + 3] = 255 // Alpha
    }
    return new_img
  }
  pixel_count() {
    return this.data.length
  }
  get_getPixelFn(){
    const getPixel = (x,y) => {
        return this.pixel(Math.round(x),Math.round(y))
    }
    return getPixel
  }
}

function mix_image(greyscale_img_a,greyscale_img_b, factor_a = 0.5, factor_b = 0.5){
  if (greyscale_img_a.pixel_count() != greyscale_img_b.pixel_count()){
    console.error("images must have same dimensions for mixing")
  }
  const len = greyscale_img_a.pixel_count()
  let new_arr = new Array(len)
  const da = greyscale_img_a.data
  const db = greyscale_img_b.data
  for (let x = 0 ; x < len; x++){
    new_arr[x] = da[x] * factor_a + db[x] * factor_b
  }
  return new GreyscaleImage(new_arr,greyscale_img_a.width,greyscale_img_a.height)
}

// converts image to greyscale
function rgba_to_greyscale(img_data,w,h){
  const brightness = (r,g,b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
  const pixel_count = w * h
  const grey_img = new Array(pixel_count).fill(0)
    .map((elem,index) => brightness(
      img_data[index * 4],
      img_data[index * 4 + 1],
      img_data[index * 4 + 2]))
  return new GreyscaleImage(grey_img,w,h)
}

function blur_image(greyscale_img,blur_radius = 5){

  function boxesForGauss(sigma, n)  // standard deviation, number of boxes
  {
      var wIdeal = Math.sqrt((12*sigma*sigma/n)+1);  // Ideal averaging filter width
      var wl = Math.floor(wIdeal);  if(wl%2==0) wl--;
      var wu = wl+2;

      var mIdeal = (12*sigma*sigma - n*wl*wl - 4*n*wl - 3*n)/(-4*wl - 4);
      var m = Math.round(mIdeal);
      // var sigmaActual = Math.sqrt( (m*wl*wl + (n-m)*wu*wu - n)/12 );

      var sizes = [];  for(var i=0; i<n; i++) sizes.push(i<m?wl:wu);
      return sizes;
  }
  function gaussBlur_4 (scl, tcl, w, h, r) {
      var bxs = boxesForGauss(r, 3);
      boxBlur_4 (scl, tcl, w, h, (bxs[0]-1)/2);
      boxBlur_4 (tcl, scl, w, h, (bxs[1]-1)/2);
      boxBlur_4 (scl, tcl, w, h, (bxs[2]-1)/2);
  }
  function boxBlur_4 (scl, tcl, w, h, r) {
      for(var i=0; i<scl.length; i++) tcl[i] = scl[i];
      boxBlurH_4(tcl, scl, w, h, r);
      boxBlurT_4(scl, tcl, w, h, r);
  }
  function boxBlurH_4 (scl, tcl, w, h, r) {
      var iarr = 1 / (r+r+1);
      for(var i=0; i<h; i++) {
          var ti = i*w, li = ti, ri = ti+r;
          var fv = scl[ti], lv = scl[ti+w-1], val = (r+1)*fv;
          for(var j=0; j<r; j++) val += scl[ti+j];
          for(var j=0  ; j<=r ; j++) { val += scl[ri++] - fv       ;   tcl[ti++] = val*iarr; }
          for(var j=r+1; j<w-r; j++) { val += scl[ri++] - scl[li++];   tcl[ti++] = val*iarr; }
          for(var j=w-r; j<w  ; j++) { val += lv        - scl[li++];   tcl[ti++] = val*iarr; }
      }
  }
  function boxBlurT_4 (scl, tcl, w, h, r) {
      var iarr = 1 / (r+r+1);
      for(var i=0; i<w; i++) {
          var ti = i, li = ti, ri = ti+r*w;
          var fv = scl[ti], lv = scl[ti+w*(h-1)], val = (r+1)*fv;
          for(var j=0; j<r; j++) val += scl[ti+j*w];
          for(var j=0  ; j<=r ; j++) { val += scl[ri] - fv     ;  tcl[ti] = val*iarr;  ri+=w; ti+=w; }
          for(var j=r+1; j<h-r; j++) { val += scl[ri] - scl[li];  tcl[ti] = val*iarr;  li+=w; ri+=w; ti+=w; }
          for(var j=h-r; j<h  ; j++) { val += lv      - scl[li];  tcl[ti] = val*iarr;  li+=w; ti+=w; }
      }
  }

  let blurred_img = new Array(greyscale_img.pixel_count()).fill(0)
  gaussBlur_4(greyscale_img.data.slice(),blurred_img,greyscale_img.width,greyscale_img.height,blur_radius)
  return new GreyscaleImage(blurred_img,greyscale_img.width,greyscale_img.height)
}

function edge_detection(img,w,h){
  function gp(x,y){
    if (x < 0) x = 0
    if (x >= w) x = w-1
    if(y < 0) y = 0
    if (y >= h) y = h-1
    return img[y * w + x]
  }
  let new_img = new GreyscaleImage(img.data,w,h)
  for (let x = 0; x < w; x++){
    for(let y = 0; y < w; y++){
      // 0  1  0
      // 1 -4  1
      // 0  1  0
      let out_pix = gp(x, y-1) + gp(x-1,y) + gp(x+1,y) + gp(x,y+1) + gp(x,y)*(-4)
      new_img.data[y * w + x] = out_pix
    }
  }
  // normalize image
  let min_img_value = new_img.data.reduce((x,y) => Math.min(x,y),256)
  let offs = 0 - min_img_value
  new_img.data = new_img.data.map((x) => x - offs)
  let max_img_value = new_img.data.reduce((x,y) => Math.max(x,y),0)
  let max_img_normalized = new_img.data.map(x => 255 - Math.floor(x * 255.0 / max_img_value))
  new_img.data = max_img_normalized
  return new_img
}

function pixel_brightness (pixel) {
  const r = pixel[0]
  const g = pixel[1]
  const b = pixel[2]

  // https://stackoverflow.com/questions/596216/formula-to-determine-brightness-of-rgb-color
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}


function default_processing_options(){
  return {
    blur_radius : 0,
    mix5050 : false,
    edge_detect: false
  }
}

function best_processing_options(){
  return {
    blur_radius : 4,
    mix5050 : true,
    edge_detect: false
  }
}

function process_greyscale_image(greyscale,options = default_processing_options()){
  if(options == null) { options = default_processing_options() }
  let final_img = greyscale
  if(options.blur_radius != 0){
    let blurred_img = blur_image(greyscale,options.blur_radius)
    final_img = blurred_img
    if(options.mix5050){
      final_img = mix_image(greyscale,blurred_img)
    }
    if(options.edge_detect){
      console.error("TODO edge detect")
    }
  }
  return final_img
}

function process_rgba_image(rgba_array,w,h,options = default_processing_options()){
  let greyscale = rgba_to_greyscale(rgba_array,w,h)
  return process_greyscale_image(greyscale,options)
}


function distance (pointA, pointB) {
  const dX = pointA[0] - pointB[0]
  const dY = pointA[1] - pointB[1]
  return Math.sqrt(Math.pow(dX, 2) + Math.pow(dY, 2))
}

function evaluateEdge (pointA, pointB, getPixel) {
  const length = distance(pointA, pointB)
  const resolution = LINE_SAMPLE_RESOLUTION

  if (length === 0) {
    return 0
  }

  const minumumSamples = Math.floor(length / resolution)

  const usedResolution = length / (minumumSamples + 1)
  const samples = Math.round(length / usedResolution)

  const dX = pointB[0] - pointA[0]
  const dY = pointB[1] - pointA[1]

  let sum = 0.0
  for(let i = 0; i < samples + 1; i++){
    sum += getPixel(pointA[0] + dX / samples * i, pointA[1] + dY / samples * i)
  }
  return sum / (samples + 1)
  /*
  const average = Array(samples + 1).fill(null)
    .map((__, i) => getPixel(pointA[0] + dX / samples * i, pointA[1] + dY / samples * i))
    .reduce((total, score) => total + score) / (samples + 1)
  return average
  */
}

// # JigglePolygon
// This class represents a polygon with the calculated edge edge_scores
class JigglePolygon{
  constructor(points = []){
    this.points = points
    this.edge_scores = Array(this.points.length).fill(null)
  }

  update_edge_scores(getPixel){
    const num_points = this.points.length
    if(! this.edge_scores || this.edge_scores.length != num_points)
      this.edge_scores = Array(num_points)
    for(let i = 0; i < num_points; i++){
      this.edge_scores[i] = evaluateEdge(
        this.points[i],
        this.points[(i+1) % num_points],
        getPixel
      )
    }
  }

  count(){
    return this.points.length
  }

  update_edge_score(index,getPixel){
    const count_points = this.count()
    index = (index + count_points) % count_points
    if (index >= 0 && index < this.count() ) {
      const pointA = this.points[index]
      const pointB = this.points[(index + 1) % count_points]
      this.edge_scores[index] = evaluateEdge(pointA, pointB, getPixel)
    }
  }
  // update the edge scores first before using this

  edge_lengths(){
    const euclidean = (e) => {
      let d1 = e[0][0] - e[1][0]
      let d2 = e[0][1] - e[1][1]
      return Math.sqrt((d1 * d1) + (d2 * d2))
    }

    return Array(this.points.length).fill(null)
      .map((__,index) => ([
        this.points[index],
        this.points[(index + 1) % this.points.length]
      ]))
      .map(euclidean)
  }

  weighted_scores(){
    let lengths = this.edge_lengths()
    let sum_length = lengths.reduce((x,y) => x+y, 0.0)
    let scores = this.edge_scores
    let weighted_scores = scores.map((s,idx) => s * (lengths[idx] / sum_length))
    return weighted_scores
  }

  edge_rgba(index){
    const edge_score_to_rgba = (value,alpha=0.9) => {
      const r = Math.round(255 * value)
      const g = Math.round(255 * (1 - value))
      const b = 0
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }

    return edge_score_to_rgba(this.edge_scores[index])
  }

  // update edge scores first or make sure that they are already updated
  get_jiggler_annotation(projection){
    const weighted_edge_scores = this.weighted_scores()
    return {
      polygon : this.points,
      edge_brightnesses : this.edge_scores,
      average_edge_brightness : this.edge_scores.reduce((x,y) => x+y, 0.0) / this.edge_scores.length,
      //weighted_brightnesses : weighted_edge_scores, // this is actually not that interesting
      brightness : weighted_edge_scores.reduce((x,y) => x+y, 0.0),
      projection : projection
    }
  }

  search_step(dimensions,getPixel,search_size=20){
    const searchSize = search_size
    const currentEdgeScores = this.edge_scores

    const new_points = this.points.slice(0)
    const moveIndex = Math.floor(Math.random() * new_points.length)
    const movePoint = new_points[moveIndex]
    new_points[moveIndex] = [
      Math.min(Math.max(0, movePoint[0] + searchSize * Math.random() - 0.5 * searchSize), dimensions.width - 1),
      Math.min(Math.max(0, movePoint[1] + searchSize * Math.random() - 0.5 * searchSize), dimensions.height - 1)
    ]
    let new_poly = new JigglePolygon()
    new_poly.points = new_points
    new_poly.edge_scores = this.edge_scores.slice(0)
    new_poly.update_edge_score(moveIndex - 1,getPixel)
    new_poly.update_edge_score(moveIndex,getPixel)
    const compute_average = (arr) => (arr.reduce((total,score) => total + score) / arr.length)

    if (compute_average(new_poly.edge_scores) < compute_average(currentEdgeScores)) {
      return new_poly
    }
  }

  jiggle_to_end(maxTries,search_size,dimensions,getPixel){
    let tries = 0
    let best_poly = this
    this.update_edge_scores(getPixel)
    while(tries < maxTries){
      tries+=1
      let new_poly = best_poly.search_step(dimensions,getPixel,search_size)
      if(new_poly){
        tries = 0
        best_poly = new_poly
      }
    }
    return best_poly
  }
  jiggle(img,max_tries = 2000, search_size = 20){
    const getPixel = img.get_getPixelFn()
    const w = img.width
    const h = img.height
    return this.jiggle_to_end(max_tries,search_size, {width: w, height: h},getPixel)
  }
  distance_to(reference){
    let sum = 0.0
    if(this.points.length != reference.points.length) return -1.0;
    let mp = this.points;
    let rp = reference.points;
    for (let i = 0; i < this.points.length; i++){
      sum += Math.sqrt(
        (mp[i][0] - rp[i][0])*(mp[i][0] - rp[i][0]) +
        (mp[i][1] - rp[i][1])*(mp[i][1] - rp[i][1]))
    }
    return sum
  }
}

exports.blur_image = blur_image
exports.mix_image = mix_image
exports.rgba_to_greyscale = rgba_to_greyscale
exports.process_greyscale_image = process_greyscale_image
exports.process_rgba_image = process_rgba_image
exports.default_processing_options = default_processing_options
exports.best_processing_options = best_processing_options
exports.pixel_brightness = pixel_brightness
exports.JigglePolygon = JigglePolygon
exports.edge_detection = edge_detection
