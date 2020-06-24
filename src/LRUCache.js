class LRUCache{
  constructor(compare_fn = (x,y) => x === y, max_elements = 10){
    this.cache = []
    this.compare_fn = compare_fn
    this.max_elements = max_elements
  }
  get(k){
    let cache = this.cache
    for(let i = 0; i < cache.length; i++){
      if(this.compare_fn(cache[i].key,k)){
        return cache[i].value
      }
    }
    return null
  }
  set(k,v){
    let cache = this.cache
    if(this.get(k) != null){
      for(let i = 0; i < cache.length; i++){
        if(this.compare_fn(cache[i].key,k)){
          this.cache.splice(i,1)
          break
        }
      }
    }
    else{
      if (this.cache.length >= this.max_elements){
        this.cache.splice(0,1)
      }
    }
    let new_entry = {key : k, value: v}
    this.cache.push(new_entry)
  }
}

exports.LRUCache = LRUCache
