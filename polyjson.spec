{
  "features" : [
    {
      "polygon": [               # polygon in image-space coordinates
        [103,102],
        [200,100]
      ],
      "edge_scores" : [
        0.1,
        0.3,
        ...
      ],
      "tileset" : {              # tileset to generate the underlying image from
        "url" : "http://...",    #
        "zoomlevel" : 18,        # zoomlevel of the map used to generate the image
        "exact" : false          # is the image cropped to fit the region excactly?
      },
      "region" : [               # Region to generate the Image from
        40.3,                    # South West Latitude
        -70.1,                   # South West Longitude
        40.4,                    # North East Latitude
        -70.0                    # North East Longitude
      ],
      "meta" : {
        id : "..." # ID (10 characters a-zA-Z0-9)
        # undefined contents
      }
    }
  ]
}
