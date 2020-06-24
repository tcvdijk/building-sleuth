# Polygon Jiggler

## Installation and Requirements

Dependencies:

- node.js
- yarn (or npm)

Optional Dependencies:

- redis

To install the dependencies call

	yarn

or

	npm install

in the cloned directory.

## Basic Usage

This application consists of three componenents

- A Webapp, that can run with or without a server
- A server, which is used to host the webapp and build images for jiggling in the webapp
- A command line application with a lot of functionality (e.g. jiggling, gathering inforamtion, processing GeoJson etc.)

## Using the webapp

To run the webapp run
	
	yarn build
	yarn webapp

This will rebuild the application and start the server in the background.
You should be able to access the application by visiting [http://localhost:8080](http://localhost:8080)


## Using the command line application

You can run be command line interface by executing the script

	./src/cli.js OPTIONS

or equivalently

	yarn cli OPTIONS


### Redis caching
During annotation and jiggling, the required tilemap images must be downloaded from a central server.
In order to improve performance and reduce server load, these images can be cached using redis:
Install redis and start the service using the default configuration.

*Note:* This application will not clean up data in the redis database and will not check timestamps in the database for consistency. After use, you may want to manually delete all matching entries in the database.

If you havn't installed or started redis, the tool will still work but will be way slower.
If you have installed redis but it's already used by another application and you don't want to use it for the polygon jiggler, pass the --disable-redis argument to all suitable commands to disable caching.

Note: If you run out of memory, set the configuration options "maxmemory 1gb" and "maxmemory-policy allkeys-lru" for the database manually using redis-cli (also see /etc/redis.conf).


### Basic Usage
The command line interface is intended to be used in 4 steps

##### Step 0: List all available sheets using
	./cli.js dl sheetspec --list

##### Step 1: Download GeoJson data from a source using

	./cli.js dl sheethistory --only-polygons <sheet-id> > sheet.geojson

##### Step 2: Annotating the GeoJson data with Jiggling Information using

	./cli.js annotate sheet.geojson <tile_url> <zoomlevel> > sheet.ageojson

You get the Tile Layer URL and the available zoomlevels using

	./cli.js dl tileinfo <sheet-id>

##### Step 3: Jiggling the Annotated Polygons (optional)

	./cli.js jiggle --blur 2 --mix5050 sheet.ageojson > jiggled_sheet.json

It's important to specify the --blur or --mix5050 options, because by default, the jiggler will not process the image.

The brightness of the polygons in the output will be calculated based on the blurred (processed) image.

##### Step 4: Reevaluate the Brightness using different options (optional)

	./cli.js evaluate jiggled_geojson.json > eval_geojson.json

Using these settings, the brightness of the polygons will be recalculated, without any blur or mixing applied to the image. This command can also be used if polygons from other sources should be evaluated without getting jiggled first.

##### Step 5: Gathering information about the polygons, e.g.

	./cli.js get ids jiggled_geojson.json # get all annotated polygon ids
	./cli.js get all jiggled_geojson.json <id> # get information for a polygon
	./cli.js brightness --average jiggled_geojson.json # get the average brightness of all polygons
	./cli.js get processed-map jiggled.ageojson <polygon-id> > polygon_map.png # show the map for a polygon
