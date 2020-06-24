function get_random_id(n_chars = 10){
  let chars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let id = ""
  for(let x = 0; x < n_chars; x+= 1){
    let rand_idx = Math.min(chars.length - 1, Math.floor(Math.random() * chars.length))
    id += chars.charAt(rand_idx)
  }
  return id
}

exports.get_random_id = get_random_id
