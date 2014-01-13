
var cesium = (function() {

	// constructor
	function _() {

	}

	// static variables
	var ellipsoid = Cesium.Ellipsoid.WGS84;

	// static methods
	_.createMap = function(lat, lng, zoom, div, callback, failure) {
		// check file has been loaded
	    if(Cesium != undefined) {
	        var map = new _.globeMap(div, lat, lng, zoom);
	        callback(map);
	    } else {
	        failure();
	    }
	}

	var convertToLatLngZoom = function(cartesian) {
        var cartographic = ellipsoid.cartesianToCartographic(cartesian);
    	return {lng: Cesium.Math.toDegrees(cartographic.longitude), lat: Cesium.Math.toDegrees(cartographic.latitude), zoom: convertToZoom(cartographic.height)};
	}

	var convertToZoom = function(height) {
		return Math.floor(Math.log(36000000 / height) / Math.log(2));
	}

    _.convertPath = function(latLngs) {
        var latLngsArray = [], index = 0;
        for(; index < latLngs.length; index++) {
            latLngsArray.push(latLngs[index].latitude);
            latLngsArray.push(latLngs[index].longitude);
        }
        return latLngsArray;
    }

    _.generatePath = function(latLngsArray) {
        var latLngs = [], index = 0;
        for(; index < latLngsArray.length; index += 2) {
            latLngs.push(new Cesium.Cartographic(latLngsArray[index], latLngsArray[index + 1]));
        }
        return latLngs;
    }

    _.interpolate = function(latlng, latlngTo, slope, geodesic) {

        // TODO - move to Cartesians and use the Cartesians.lerp function
        var lat = (latlng.latitude + latlngTo.latitude) / slope;
        var lng = latlng.longitude - latlngTo.longitude;      // Distance between
        var height = (latlng.height + latlngTo.height) / slope;

        // To control the problem with +-180 degrees.
        if (lng <= Math.PI && lng >= -Math.PI) {
            lng = (latlng.longitude + latlngTo.longitude) / slope;
        } else {
            lng = (latlng.longitude + latlngTo.longitude + 2 * Math.PI) / slope;
        }
        return new Cesium.Cartographic(lng, lat);
    }

    _.halfWayTo = function(latlng, latlngTo, geodesic) {
        return _.interpolate(latlng, latlngTo, 0.5, geodesic);
    }

    _.globeMap = (function() {

		// constructor
		function gl(div, lat, lng, zoom) {
			this.frameDiv = div;
			// Create canvas element
			var canvas = document.createElement("canvas");
			canvas.setAttribute("id", "glCanvas");
			canvas.setAttribute("style", "width: 100%; height: 100%;");
			div.appendChild(canvas);
		    var scene = new Cesium.Scene(canvas);

		    scene.skyAtmosphere = new Cesium.SkyAtmosphere();

		    var skyBoxBaseUrl = './Cesium/Assets/Textures/SkyBox/tycho2t3_80';
		    scene.skyBox = new Cesium.SkyBox({
		        positiveX : skyBoxBaseUrl + '_px.jpg',
		        negativeX : skyBoxBaseUrl + '_mx.jpg',
		        positiveY : skyBoxBaseUrl + '_py.jpg',
		        negativeY : skyBoxBaseUrl + '_my.jpg',
		        positiveZ : skyBoxBaseUrl + '_pz.jpg',
		        negativeZ : skyBoxBaseUrl + '_mz.jpg'
		    });

		    var primitives = scene.getPrimitives();

		    // Bing Maps
		    var bing = new Cesium.BingMapsImageryProvider({
		        url : 'https://dev.virtualearth.net',
		        mapStyle : Cesium.BingMapsStyle.AERIAL,
		        // Some versions of Safari support WebGL, but don't correctly implement
		        // cross-origin image loading, so we need to load Bing imagery using a proxy.
		        proxy : Cesium.FeatureDetection.supportsCrossOriginImagery() ? undefined : new Cesium.DefaultProxy('/proxy/')
		    });

		    var centralBody = new Cesium.CentralBody(ellipsoid);
		    centralBody.getImageryLayers().addImageryProvider(bing);
		    primitives.setCentralBody(centralBody);
		    var transitioner = new Cesium.SceneTransitioner(scene, ellipsoid);

		    // add renderers
	        var labels = new Cesium.LabelCollection();
	        scene.getPrimitives().add(labels);
	        this.labels = labels;
	        this.tooltip = this.createTooltip();

		    function animate() {

		    }

		    function tick() {
		        scene.initializeFrame();
		        animate();
		        scene.render();
		        Cesium.requestAnimationFrame(tick);
		    }
		    tick();

		    // Prevent right-click from opening a context menu.
		    canvas.oncontextmenu = function() {
		        return false;
		    };

			// configure the event handlers

			// resize event
		    var _self = this;
		    window.addEventListener('resize', function() {_self.triggerResize()}, false);

		    var mouseOutObject;
		    // scene events
	        handler = new Cesium.ScreenSpaceEventHandler(scene.getCanvas());
	        handler.setInputAction(
	            function (movement) {
	                var pickedObject = scene.pick(movement.position);
	                if(pickedObject && pickedObject.leftClick) {
	                	var latLng = _self.convertScreenPositionToLatLng(movement.position.x, movement.position.y);
	                	if(latLng != null) {
		                	pickedObject.leftClick(latLng);
		                }
	                }
	            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
	        handler.setInputAction(
	            function (movement) {
	                var pickedObject = scene.pick(movement.position);
	                if(pickedObject && pickedObject.leftDoubleClick) {
	                	var latLng = _self.convertScreenPositionToLatLng(movement.position.x, movement.position.y);
	                	if(latLng != null) {
		                	pickedObject.leftDoubleClick(latLng);
		                }
	                }
	            }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
	        handler.setInputAction(
	            function (movement) {
	                var pickedObject = scene.pick(movement.position);
	                if(pickedObject && pickedObject.rightClick) {
	                	var latLng = _self.convertScreenPositionToLatLng(movement.position.x, movement.position.y);
	                	if(latLng != null) {
		                	pickedObject.rightClick(latLng);
		                }
	                }
	            }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
	        handler.setInputAction(
	            function (movement) {
	                var pickedObject = scene.pick(movement.endPosition);
	                if(mouseOutObject && mouseOutObject != pickedObject) {
	                	mouseOutObject.mouseOut();
	                	mouseOutObject = null;
	                }
	                if(pickedObject) {
		                if(pickedObject.mouseOut) {
		                	mouseOutObject = pickedObject;
		                }
		                if(pickedObject.mouseMove) {
		                	var fromLatLng = _self.convertScreenPositionToLatLng(movement.startPosition.x, movement.startPosition.y);
		                	var toLatLng = _self.convertScreenPositionToLatLng(movement.endPosition.x, movement.endPosition.y);
	                		pickedObject.mouseMove(fromLatLng, toLatLng);
		                }
		            }
	            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	        handler.setInputAction(
	            function (movement) {
	                var pickedObject = scene.pick(movement.position);
	                if(pickedObject && pickedObject.leftUp) {
	                	var latLng = _self.convertScreenPositionToLatLng(movement.position.x, movement.position.y);
	                	if(latLng != null) {
		                	pickedObject.leftUp(latLng);
		                }
	                }
	            }, Cesium.ScreenSpaceEventType.LEFT_UP);
	        handler.setInputAction(
	            function (movement) {
	                var pickedObject = scene.pick(movement.position);
	                if(pickedObject && pickedObject.leftDown) {
	                	var latLng = _self.convertScreenPositionToLatLng(movement.position.x, movement.position.y);
	                	if(latLng != null) {
		                	pickedObject.leftDown(latLng);
		                }
	                }
	            }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
	        handler._callbacks.push({
	            name : 'mouseout',
	            onDoc : false,
	            action : function(e) {
	                that._handleMouseDown(e);
	            }
	        });

		    // fields
		    this.canvas = canvas;
		    this.scene = scene;
		    this.transitioner = transitioner;
		    this.overlays = [];

			// refresh width and height of canvas
		    this.triggerResize()
		}

		gl.prototype.triggerResize = function() {
			var canvas = this.canvas;
	        var width = canvas.clientWidth;
	        var height = canvas.clientHeight;

	        if (canvas.width === width && canvas.height === height) {
	            return;
	        }

	        canvas.width = width;
	        canvas.height = height;
	        this.scene.getCamera().frustum.aspectRatio = width / height;
		}

		gl.prototype.setMode = function(mode) {
			if(mode == "3d") {
	        	this.transitioner.morphTo3D();
			} else if(mode == "2.5d") {
				this.transitioner.morphToColumbusView();
			} else if(mode == "2d") {
	        	this.transitioner.morphTo2D();
			}
		}

		gl.prototype.disableAllEditMode = function() {
		    for(var i = 0; i < this.overlays.length; i++) {
		        if(typeof this.overlays[i].setEditMode == "function" && this.overlays[i].isEditable()) {
		            this.overlays[i].setEditMode(false);
		        }
		    }
		}

		gl.prototype.showOverview = function(overview) {
		}

		gl.prototype.setCenter = function(lat, lng) {
		    this.map.setCenter(new google.maps.LatLng(lat, lng));
		}

		gl.prototype.getPosition = function() {
			var cartesian = this.scene.getCamera().position;
			return this.convertCartesiansToCartographic(cartesian);
		}

		gl.prototype.getCenter = function() {
			return this.getPosition();
		}

		gl.prototype.setZoomLevel = function(level) {
			this.scene.getCamera().controller.zoomIn(level);
		}

		gl.prototype.getZoomLevel = function() {
		    return this.getPosition().zoom;
		}

		gl.prototype.addControl = function(control) {
		}

		gl.prototype.setBounds = function(swLat, swLng, neLat, neLng) {
	        var west = Cesium.Math.toRadians(swLng);
	        var south = Cesium.Math.toRadians(swLat);
	        var east = Cesium.Math.toRadians(neLng);
	        var north = Cesium.Math.toRadians(neLat);

	        var extent = new Cesium.Extent(west, south, east, north);
	        this.scene.getCamera().controller.viewExtent(extent, ellipsoid);

	    }

		gl.prototype.getMapId = function() {
		    return this.map.getMapTypeId();
		}

		gl.prototype.setMapId = function(mapTypeId) {
		    // TODO - need to check the mapTypeId exists in the list of map type ids available
		    if(mapTypeId && mapTypeId != "" && mapTypeId != null) {
		        this.map.setMapTypeId(mapTypeId);
		    }
		}

		gl.prototype.cleanUp = function() {
		  if(this.overlays) {
		    for (var index =  0; index < this.overlays.length; index++) {
		        var overlay = this.overlays[index];
		        if(overlay.setMap) {
		          overlay.setMap(null);
		        }
		        if(overlay.remove) {
		          overlay.remove();
		        }
		    }
		  }
		  this.overlays = [];

		  this.closeInfoWindow();

		  // check for cleanUp first
		  if(this.editCleanUp) {
		      this.editCleanUp();
		  }

		}

		gl.prototype.convertScreenPositionToLatLng = function(posX, posY) {
            var cartesian = this.scene.getCamera().controller.pickEllipsoid(new Cesium.Cartesian2(posX, posY), ellipsoid);
            if (cartesian) {
            	return this.convertCartesiansToCartographic(cartesian);
            } else {
            	return null;
            }
		}

        gl.prototype.convertCartographicsToCartesians = function(latLngs) {
            if(latLngs instanceof Array) {
                return ellipsoid.cartographicArrayToCartesianArray(latLngs);
            } else {
                return ellipsoid.cartographicToCartesian(latLngs)
            }
        }

        gl.prototype.convertCartesiansToCartographic = function(cartesians) {
            if(cartesians instanceof Array) {
                return ellipsoid.cartesianArrayToCartographicArray(cartesians);
            } else {
                return ellipsoid.cartesianToCartographic(cartesians);
            }
        }

        gl.prototype.displayCoordinates = function(display) {

		    if(this.coordinatesOverlay == undefined) {
				var _self = this;
				var latLngOverlay = function(frameDiv) {
				    var div = document.createElement('DIV');
				    div.innerHTML = "Position: ";
				    div.style = "position: absolute; bottom: 0px; right: 0px;";
				    this.div_ = div;
				    // add to frame div and display coordinates
				    frameDiv.appendChild(div);
				    frameDiv.onmousemove = function(event) {
				        var latLng = _self.convertScreenPositionToLatLng(event.clientX, event.clientY);
				        div.innerHTML = "Position: " + (latLng == null ? "" : latLng.lat + " " + latLng.lng);
				    };
				}

				latLngOverlay.prototype.show = function() {
				  this.div_.style.display = 'block';
				}

				latLngOverlay.prototype.hide = function() {
				    this.div_.style.display = 'none';
				}
		        this.coordinatesOverlay = new latLngOverlay(this.frameDiv);
		        this.coordinatesOverlay.hide();
		    }
		    if(display) {
		        this.coordinatesOverlay.show();
		    } else {
		        this.coordinatesOverlay.hide();
		    }
		}

		gl.prototype.displayMessage = function(message) {

			if(!this.messageOverlay) {
				var overlay = function(frameDiv) {
				    var div = document.createElement('DIV');
				    div.innerHTML = "Position: ";
				    div.style = "position: absolute; bottom: 0px; right: 0px;";
				    this.div_ = div;
				    // add to frame div and display coordinates
				    frameDiv.appendChild(div);
				}

				overlay.prototype.show = function() {
				  this.div_.style.display = 'block';
				}

				overlay.prototype.hide = function() {
				    this.div_.style.display = 'none';
				}

				overlay.prototype.setMessage = function(message) {
					this.div_.innerHTML = message;
				}
				this.messageOverlay = new overlay(this.frameDiv);

			}
			this.messageOverlay.show();
			this.messageOverlay.setMessage(message);
		}

		gl.prototype.addOverlay = function(overlay) {
			this.overlays.push(overlay);
		}

		gl.prototype.setListener = function(element, eventName, callback) {
			element[eventName] = callback;
		}

		gl.prototype.addBillboard = function(lat, lng, mapIconUrl, shiftX, shiftY) {
			if(this.sb == undefined) {
				var b = new Cesium.BillboardCollection();
				var a = this.scene.getContext().createTextureAtlas();
				b.setTextureAtlas(a);
	            this.scene.getPrimitives().add(b);
	            this.sb = b;
	            this.ta = a;
			}
		    var billboard = this.sb.add({
			  show : true,
			  position : ellipsoid.cartographicToCartesian(Cesium.Cartographic.fromDegrees(lat, lng)),
			  pixelOffset : new Cesium.Cartesian2(shiftX, shiftY),
			  eyeOffset : new Cesium.Cartesian3(0.0, 0.0, 0.0),
			  horizontalOrigin : Cesium.HorizontalOrigin.CENTER,
			  verticalOrigin : Cesium.VerticalOrigin.CENTER,
			  scale : 1.0,
			  imageIndex : 0,
			  color : new Cesium.Color(1.0, 1.0, 1.0, 1.0)
			});
			// create the image
			var image = new Image();
			var _self = this;
        	image.onload = function() {
        		var imageIndex = _self.ta.addImage(image);
			    billboard.setImageIndex(imageIndex);
	        };
	        image.src = mapIconUrl;
	        return billboard;
		}

		gl.prototype.createTooltip = function() {

			var tooltip = function(frameDiv) {
                var div = document.createElement('DIV');
                div.innerHTML = "Position: ";
                div.style = "position: absolute; top: 0px; left: 0px;";
                this.div_ = div;
                // add to frame div and display coordinates
                frameDiv.appendChild(div);
            }

                tooltip.prototype.setVisible = function(visible) {
                this.div_.style.display = visible ? 'block' : 'none';
            }

            tooltip.prototype.show = function(lat, lng, message) {
	            this.showAt(ellipsoid.cartographicToCartesian(Cesium.Cartographic.fromDegrees(lat, lng)), message);
			}

            tooltip.prototype.showAt = function(position, message) {
                if(position != null) {
                    this.setVisible(true);
                    this.div_.innerHTML = message;
                    this.div_.style.position = "absolute";
                    this.div_.style.left = position.x + 10 + "px";
                    this.div_.style.top = position.y + 10 + "px";
                }
            }

			return new tooltip(this.frameDiv);
		}

		gl.prototype.enableRotation = function(enable) {
			var screenSpaceCameraController = this.scene.getScreenSpaceCameraController();
			screenSpaceCameraController.enableRotate = enable;
		}

		return gl;
	})();

	// add a marker to the map and return it
	_.uniMarker = function(globe, lat, lng, mapIconUrl, shiftX, shiftY) {
	    this.globe = globe;
	    this.billboard = globe.addBillboard(lat, lng, mapIconUrl, shiftX, shiftY);
	    globe.addOverlay(this);
	}

	_.uniMarker.prototype.setTitle = function(title) {
	}

	_.uniMarker.prototype.setDraggable = function(callback) {
		var _self = this;
	    this.globe.setListener(this.billboard, 'leftDown', function(event) {
	    	_self.dragged = true;
		    _self.globe.displayMessage("leftDown");
		    _self.globe.enableRotation(false);
	    });
	    this.globe.setListener(this.billboard, 'mouseMove', function(fromLatLng, toLatLng) {
	    	if(_self.dragged === true) {
	    		_self.setPosition(toLatLng.lat, toLatLng.lng);
	    		if(_self.onDragHandler) {
	    			_self.onDragHandler(toLatLng.lat, toLatLng.lng);
	    		}
		    	_self.globe.displayMessage("mouseDrag " + toLatLng.lat + " " + toLatLng.lng);
	    	}
	    	_self.globe.displayMessage("mouseMove " + toLatLng.lat + " " + toLatLng.lng);
	    });
	    this.globe.setListener(this.billboard, 'mouseOut', function(event) {
	    	if(_self.dragged === true) {
		    	_self.dragged = false;
		    	_self.globe.enableRotation(true);
		    	callback();
			    _self.globe.displayMessage("mouseOut");
			}
	    });
	    this.globe.setListener(this.billboard, 'leftUp', function(event) {
		    _self.globe.displayMessage("leftUp");
	    	if(_self.dragged === true) {
		    	_self.dragged = false;
		    	_self.globe.enableRotation(true);
		    	callback();
	    	}
	    });
	}

	_.uniMarker.prototype.setClickHandler = function(callback) {
	    this.globe.setListener(this.billboard, 'leftClick', function(event) {callback(event.lat, event.lng)});
	}

	_.uniMarker.prototype.setDblClickHandler = function(callback) {
	    var marker = this;
	    this.globe.setListener(this.billboard, 'leftDoubleClick', function() {callback(marker)});
	}

	_.uniMarker.prototype.setOnDragHandler = function(callback) {
		this.onDragHandler = callback;
	}

	_.uniMarker.prototype.setVisible = function(visible) {
	    return this.billboard.setShow(visible);
	}

	_.uniMarker.prototype.getPosition = function() {
	    return convertToLatLngZoom(this.billboard.getPosition());
	}

	_.uniMarker.prototype.getLat = function() {
	    return this.getPosition().lat;
	}

	_.uniMarker.prototype.getLng = function() {
	    return this.getPosition().lng;
	}

	_.uniMarker.prototype.setPosition = function(lat, lng) {
	    return this.billboard.setPosition(this.globe.convertCartographicsToCartesians(Cesium.Cartographic.fromDegrees(lng, lat)));
	}

	_.uniMarker.prototype.remove = function() {
		// remove all listeners
		// nothing to do listeners are part of the object
	}

	// returns a LatLng coordinates between the two markers
	_.uniMarker.prototype.halfWayTo = function(marker, geodesic) {
	    return _.halfWayTo(this.getPosition(), marker.getPosition(), geodesic);
	}

	//uniSurface is a base class for objects using a surface like Polygon, Rectangle and Circle
	_.uniSurface = function() {
	}

	_.uniSurface.prototype.setClickHandler = function(callback) {
	    this.globe.setListener(this.surface, 'leftClick', function(event) {callback(event.lat, event.lng)});
	}

	_.uniSurface.prototype.setMouseOverHandler = function(callback) {
		// there is no mouse over event use mouseMove instead
	    this.globe.setListener(this.surface, 'mouseMove', function(event) {callback(event.lat, event.lng)});
	}

	_.uniSurface.prototype.setMouseMoveHandler = function(callback) {
	    this.globe.setListener(this.surface, 'mouseMove', function(event) {callback(event.lat, event.lng)});
	}

	_.uniSurface.prototype.setMouseOutHandler = function(callback) {
	    this.globe.setListener(this.surface, 'mouseOut', function(event) {callback(event.lat, event.lng)});
	}

	_.uniSurface.prototype.setTooltip = function(message) {
		var _tooltip = this.globe.tooltip;
	    this.setMouseMoveHandler(function(event) {_tooltip.show(event, message)});
	    this.setMouseOutHandler(function(event) {_tooltip.hide()});
	}

	_.uniSurface.prototype.setVisible = function(visible) {
	    this.surface.setVisible(visible);
	}

	_.uniSurface.prototype.setFillColor = function(color) {
	    this.surface.setOptions({
	        fillColor: color
	    });
	}

	_.uniSurface.prototype.setFillOpacity = function(opacity) {
		this.fillopacity = opacity;
	    this.surface.setOptions({
	        fillOpacity: opacity
	    });
	}

	_.uniSurface.prototype.setStrokeStyle = function(color, opacity, thickness) {
		this.color = color;
		this.opacity = opacity;
		this.thickness = thickness;
	    this.surface.setOptions({
	        strokeColor: color,
	        strokeWeight: thickness,
	        strokeOpacity: opacity
	    });
	}

	_.uniSurface.prototype.setHighlighted = function(highlighted) {
	    if(highlighted && !this.isHighlighted) {
	        this.surface.setOptions({
	            strokeColor: "#ffffff",
	            strokeWeight: this.weight * 2
	        });
	        this.isHighlighted = true;
	        this.setOnTop();
	    } else if(!highlighted && this.isHighlighted) {
	        this.surface.setOptions({
	            strokeColor: this.color,
	            strokeWeight: this.weight,
	            zIndex: 1
	        });
	        this.isHighlighted = false;
	    }
	}

	_.uniSurface.prototype.setOnTop = function() {
	    this.surface.setOptions({
	        zIndex: this.map2D.zIndex++
	    });
	}

	_.uniSurface.prototype.sendToBack = function() {
	    this.surface.setOptions({
	        zIndex: 0
	    });
	}

	// method to enable a surface to be editable
	// automatically adds the tooltip and click handler to toggle the edit mode of a surface
	// the method expects the setEditMode method to be available
	_.uniSurface.prototype.configureEditable = function(tooltip) {
		var _self = this;
		var _tooltip = this.globe.tooltip;
		this.edit = undefined;
		this.editable = true;
		this.setEditMode(false);
		this.setMouseOverHandler(function() {
		    if(_self.edit != true && _self.editable == true) {
			    _self.setHighlighted(true);
		    } else {
			    _self.setHighlighted(false);
		    }
		});
		this.setMouseOverHandler(function(event) {
		    if(_self.edit != true && _self.editable == true) {
		        _tooltip.show(event, "<p>" + tooltip + "</p>");
		    }
		});
		this.setMouseOutHandler(function() {
		    _self.setHighlighted(false);
		    _tooltip.hide();
		});
		this.setClickHandler(function() {
			if(_self.editable == true) {
				// remove all edit modes first
				_self.globe.disableAllEditMode();
				// remove highlighting
				_self.setHighlighted(false);
				// set this surface in edit mode
		        _self.setEditMode(true);
		        // disable edit mode if the user clicks in the map
		        _self.globe.setListener(_self.globe, 'leftClick', function(event){_self.setEditMode(false)});
		        // hide tooltip
		        _self.globe.tooltip.hide();
			}
		});
	}

	_.uniSurface.prototype.setEditable = function(editable) {
	    this.editable = editable;
	    this.setEditMode(editable);
	}

	_.uniSurface.prototype.isEditable = function() {
	    return this.editable;
	}

	_.uniSurface.prototype.setCenter = function(lat, lng) {
	    return this._setCenter(lat, lng);
	}

	// get the center of the surface using the _getCenter method of the class
	// returns [lat, lng] value
	_.uniSurface.prototype.getCenter = function() {
		return this._getCenter();
	}

	_.createPolypoints = function(globe, options, callback, initialLat, initialLng) {

	    // check for cleanUp first
	    if(globe.editCleanUp) {
	    	globe.editCleanUp();
	    }

	    globe.disableAllEditMode();

        var scene = globe.scene;
        var primitives = scene.getPrimitives();

	    var poly;
	    var minPoints;
	    if(options.polygon) {
	    	poly = new Cesium.Polygon();
	        poly.material = Cesium.Material.fromType(scene.getContext(), Cesium.Material.ColorType);
		    minPoints = 3;
        } else {
	    	poly = new Cesium.Polyline();
		    minPoints = 2;
	    }
        primitives.add(poly);

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.getCanvas());

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if(movement.position != null) {
                var cartesian = scene.getCamera().controller.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    // add new point to polygon
                    var positions = poly.getPositions();
                    if(positions == undefined || positions == null || positions.length == 0) {
                        positions = [];
                        positions.push(cartesian);
                        positions.push(cartesian);
                    }
                    positions.push(cartesian);
                    poly.setPositions(positions);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if(position != null) {
                var positions = poly.getPositions();
                if(positions == undefined || positions == null || positions.length == 0) {
                    globe.tooltip.showAt(position, "<p>Click to add first point</p>");
                } else {
                    var cartesian = scene.getCamera().controller.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        positions.pop();
                        positions.push(cartesian);
                        poly.setPositions(positions);
                        globe.tooltip.showAt(position, "<p>Click to add new point</p>" + positions.length > 3 ? "<p>Double click to finish drawing</p>" : "");
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.position;
            if(position != null) {
                var positions = poly.getPositions();
                if(positions == undefined || positions == null || positions.length < 4) {
                    return;
                } else {
                    var cartesian = scene.getCamera().controller.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        positions.pop();
                        positions.push(cartesian);
                        poly.setPositions(positions);
                        // turn cartesian positions into lat lng array of values
                        // skip first value
                        positions.slice(0, 1);
                        callback(_.convertPath(globe.convertCartesiansToCartographic(positions)));
                        cleanUp();
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

	    function cleanUp() {
            primitives.remove(poly);
            mouseHandler.destroy();
            globe.editCleanUp = null;
        }
	    // to handle cancel edit events
	    globe.editCleanUp = cleanUp;

	}

	_.createPolygon = function(globe, color, thickness, opacity, fillcolor, fillopacity, clickable, geodesic, callback, initialLat, initialLng) {
		_.createPolypoints(globe, {polygon: true, color: color, thickness: thickness, opacity: opacity, fillcolor: fillcolor, fillopacity: fillopacity, clickable: clickable, geodesic: geodesic}, callback, initialLat, initialLng);
	}

	// polygon implementation
	_.uniPolygon = function(globe, polygonCoordinates, color, thickness, opacity, fillcolor, fillopacity, clickable, geodesic, editCallback, editMarkerCallback) {

	    this.globe = globe;

	    // handle case where constructor is empty
	    if(polygonCoordinates == undefined || polygonCoordinates.length == undefined || polygonCoordinates.length < 6) {
	        return;
	    }

        var scene = globe.scene;
        var primitives = scene.getPrimitives();

        var poly = new Cesium.Polygon();
        poly.material = Cesium.Material.fromType(scene.getContext(), Cesium.Material.ColorType);
        poly.setPositions(globe.convertCartographicsToCartesians(_.generatePath(polygonCoordinates)));
        this.surface = poly;
	    this.color = color;
	    this.weight = thickness;
	    this.opacity = opacity;
	    this.fillopacity = fillopacity;
	    this.geodesic = geodesic;
	    this.isHighlighted = false;
	    // a polygon is a closed shape
	    this.closed = true;
	    this.minPoints = 3;

	    if(typeof editCallback == "function") {
		    this.editCallback = editCallback;
		    this.editMarkerCallback = editMarkerCallback;
		    this.markers = [];
		    this.editmarkers = [];
	    	this.configureEditable("Click to graphically edit the points of this polygon");
	    } else {
	    	this.editable = false;
	    }

	}
	
	_.uniPolygon.prototype = new _.uniSurface();
	
	_.uniPolygon.prototype.getArea = function() {
		return gm.geometry.spherical.computeArea(this.path);
	}
	
	// methods for editing
	_.uniPolygon.prototype.addPoint = function(latLng, index) {
	    var path = this.surface.getPositions();
	    index = index ? index : path.length;
        var position = this.globe.convertCartographicsToCartesians(latLng);
        path.splice(index, 0, position);
	    this.addMarkerPoint(latLng, index);
	}
	
	_.uniPolygon.prototype.addMarkerPoint = function(latLng, index) {
        var path = this.surface.getPositions();
        // add marker
        var _this = this;
        var marker = new _.uniMarker(this.globe, latLng.lat, latLng.lng, "./img/dragIcon.png", 0, 0);
        marker.setOnDragHandler(function() {
            for (var i = 0, I = _this.markers.length; i < I && _this.markers[i] != marker; ++i);
            path.splice(i, 0, marker.getPosition());
            _this.updateEditMarkers(false);
        });
        marker.setDraggable(
            function() {
              _this.editCallback(_this.getPositions());
            });
        if(this.editMarkerCallback != undefined) {
        	marker.setTitle("Double click to edit this point");
            marker.setDblClickHandler(function() {
                // find index of marker
                for (var i = 0, I = _this.markers.length; i < I && _this.markers[i] != marker; ++i);
                _this.editMarkerCallback(i);
            });
        } else {
        	marker.setTitle("Double click to remove this point");
            marker.setDblClickHandler(function() {
                _this.removePoint(marker);
            });
        }
        this.markers.splice(index, 0, marker);
	}
	
	_.uniPolygon.prototype.removePoint = function(marker) {
        var path = this.surface.getPositions();
	    if(path.length > this.minPoints) {
	        for (var i = 0, I = this.markers.length; i < I && this.markers[i] != marker; ++i);
	        this.markers[i].remove();
	        this.markers.splice(i, 1);
	        path.splice(i, 1);
	        if(this.editCallback) {
	            this.updateEditMarkers(true);
	            this.editCallback(this.getPositions());
	        }
	    }
	}
	
	_.uniPolygon.prototype.setEditMode = function(edit) {
	    this.edit = edit;
	    if(edit && this.markers.length == 0) {
	    	this.createEditMarkers();
			this.createPointMarkers();
	    }
	    this.setMarkersVisibility(edit);
	}
	
	_.uniPolygon.prototype.createPointMarkers = function() {
        // remove all point markers first
        if(this.markers) {
	        var i;
	        for(i = 0; i < this.markers.length; i++) {
	            this.markers[i].remove();
	        }
        }
        var index = 0;
        var latLngs = this.globe.convertCartesiansToCartographic(this.surface.getPositions());
        for(; index < latLngs.length; index++) {
            this.addMarkerPoint(latLng);
        }
	}
	
	_.uniPolygon.prototype.createEditMarkers = function() {
        var i;
        // remove all edit markers first
        if(this.editmarkers) {
	        for(i = 0; i < this.editmarkers.length; i++) {
	            this.editmarkers[i].remove();
	        }
        }
        
        this.editmarkers = [];
        var _this = this;
        var latLng;
        var latLngs = this.globe.convertCartesiansToCartographic(this.surface.getPositions());
        var length = this.closed ? latLngs.length : latLngs.length - 1;
        for(i = 0; i < length; i++) {
            latLng = _.halfWayTo(latLngs[i], latLngs[i < length - 1 ? i + 1 : 0], this.geodesic);
            var markerIcon = this.editMarker ? this.editMarker : _.defaultEditMarker;
            var editmarker = new _.uniMarker(this.map2D, latLng.lat(), latLng.lng(), markerIcon.url, markerIcon.shiftX, markerIcon.shiftY);
            (function(marker) {
                marker.setListener("dragstart", function() {
                    _this.path.insertAt(marker.markerPos, marker.getPosition());
                });
                marker.setListener("drag", function() {
                    _this.path.setAt(marker.markerPos, marker.getPosition());
                });
                marker.setDraggable(
                    function(marker) {
                        _this.path.removeAt(marker.markerPos);
                        _this.addPoint(marker.getPosition(), marker.markerPos);
                        _this.updateEditMarkers(true);
                        _this.editCallback(_this.getPositions());
                });
            })(editmarker);
            editmarker.setTitle("Drag me to create a new point!");
            editmarker.markerPos = i + 1;
            this.editmarkers.push(editmarker);
        }
    }
    
	_.uniPolygon.prototype.updateEditMarkers = function(create) {
	    if(create == true) {
	    	this.createEditMarkers();
	    } else {
	        // udpate markers positions
	        for(i = 0; i < this.editmarkers.length; i++) {
	            latLng = this.markers[i].halfWayTo(this.markers[i + 1 < this.markers.length ? i + 1 : 0], this.geodesic);
	            this.editmarkers[i].setPosition(latLng.lat(), latLng.lng());
	        }
	    }
	}
	
	_.uniPolygon.prototype.setMarkersVisibility = function(visible) {
	    var i;
	    for(i = 0; i < this.markers.length; i++) {
	        this.markers[i].setVisible(visible);
	    }
	    for(i = 0; i < this.editmarkers.length; i++) {
	        this.editmarkers[i].setVisible(visible);
	    }
	}
	
	// returns and arry of lat long positions of the polygon
	_.uniPolygon.prototype.getPositions = function() {
	    return _.convertPath(this.path);
	}
	
	//fix to force the polygon to be oriented towards the south pole
	_.uniPolygon.prototype.forceSouthPole = function() {
		var path = this.surface.getPath().getArray();
		var southPole = [new gm.LatLng(-89.99,180), new gm.LatLng(-89.99,-120), 
	        	         new gm.LatLng(-89.99,-60), new gm.LatLng(-89.99,0), 
	        	         new gm.LatLng(-89.99,60), new gm.LatLng(-89.99,120), 
	        	         new gm.LatLng(-89.99,180)];
		this.surface.setPaths([path, southPole]);
	}
	
	// remove all markers, clear path and create new points based on the new positions
	_.uniPolygon.prototype.updatePositions = function(polygonCoordinates) {
	    var i;
	    for(i = 0; i < this.markers.length; i++) {
	        this.markers[i].remove();
	    }
	    this.markers = [];
	    this.path.clear();
	    for(i = 0; i < polygonCoordinates.length;) {
	        this.addPoint(new gm.LatLng(polygonCoordinates[i], polygonCoordinates[i + 1]));
	        i = i + 2;
	    }
	    this.updateEditMarkers(true);
	}
	
	_.uniPolygon.prototype.updateMarkers = function() {
	    var i;
	    for(i = 0; i < this.markers.length; i++) {
	        this.markers[i].setPosition(this.path.getAt(i).lat(), this.path.getAt(i).lng());
	    }
	    var latLng;
	    // udpate markers positions
	    for(i = 0; i < this.editmarkers.length; i++) {
	        latLng = this.markers[i].halfWayTo(this.markers[i + 1 < this.markers.length ? i + 1 : 0], this.geodesic);
	        this.editmarkers[i].setPosition(latLng.lat(), latLng.lng());
	    }
	}
	
	_.uniPolygon.prototype.getEOBounds = function() {
	    var bounds = _._getPathBounds(this.surface.getPath());
	    return _.convertBounds(bounds);
	}
	
	_.uniPolygon.prototype._getCenter = function() {
	    return _._getPathCenter(this.surface.getPath());
	}
	
	_.uniPolygon.prototype._setCenter = function(newCenter) {
	    var center = this._getCenter();
	    var deltaLat = newCenter.lat() - center.lat();
	    var deltaLng = newCenter.lng() - center.lng();
	    // update polygon
	    var index;
	    for(index = 0; index < this.path.getLength(); index++) {
	        if(Math.abs(this.path.getAt(index).lat() + deltaLat) > 90) return false;
	    }
	    var latLng;
	    for(index = 0; index < this.path.getLength(); index++) {
	        latLng = this.path.getAt(index);
	    	this.path.setAt(index, new gm.LatLng(latLng.lat() + deltaLat, latLng.lng() + deltaLng));
	    }
	    // refresh all markers
	    this.updateMarkers(false);
	    return true;
	}
	
	_.uniPolygon.prototype.remove = function() {
	    this.surface.setMap(null);
	    if(this.markers) {
		    for (var i = 0, I = this.markers.length; i < I; i++) {
		        this.markers[i].remove();
		    }
	    }
	    if(this.editmarkers) {
		    for (i = 0, I = this.editmarkers.length; i < I; i++) {
		        this.editmarkers[i].remove();
		    }
	    }
	}
	
	_.createRectangle = function(globe, color, thickness, opacity, fillcolor, fillopacity, clickable, geodesic, callback, initialLat, initialLng) {
			
			var scene = globe.scene;
			
	        var DrawExtentHelper = function(scene, handler) {
	            this._canvas = scene.getCanvas();
	            this._finishHandler = handler;
	            this._mouseHandler = new Cesium.ScreenSpaceEventHandler(this._canvas);
	            this._poly = new Cesium.Polygon();
	            scene.getPrimitives().add(this._poly);
	        };
	        
	        DrawExtentHelper.prototype.enableInput = function() {
	            var controller = scene.getScreenSpaceCameraController();
	            
	            controller.enableTranslate = true;
	            controller.enableZoom = true;
	            controller.enableRotate = true;
	            controller.enableTilt = true;
	            controller.enableLook = true;
	        };
	        
	        DrawExtentHelper.prototype.disableInput = function() {
	            var controller = scene.getScreenSpaceCameraController();
	            
	            controller.enableTranslate = false;
	            controller.enableZoom = false;
	            controller.enableRotate = false;
	            controller.enableTilt = false;
	            controller.enableLook = false;
	        };
	        
	        DrawExtentHelper.prototype.getExtent = function(mn, mx) {
	            var e = new Cesium.Extent();

	            // Re-order so west < east and south < north
	            e.west = Math.min(mn.longitude, mx.longitude);
	            e.east = Math.max(mn.longitude, mx.longitude);
	            e.south = Math.min(mn.latitude, mx.latitude);
	            e.north = Math.max(mn.latitude, mx.latitude);

	            // Check for approx equal (shouldn't require abs due to re-order)
	            var epsilon = Cesium.Math.EPSILON7;

	            if ((e.east - e.west) < epsilon) {
	                e.east += epsilon * 2.0;
	            }

	            if ((e.north - e.south) < epsilon) {
	                e.north += epsilon * 2.0;
	            }

	            return e;
	        };
	        
	        DrawExtentHelper.prototype.setPolyPts = function(mn, mx) {
	            var e = this.getExtent(mn, mx);
	            this._poly.configureExtent(e);
	        };
	        
	        DrawExtentHelper.prototype.setToDegrees = function(w, s, e, n) {
	            var toRad = Cesium.Math.toRadians;
	            var mn = new Cesium.Cartographic(toRad(w), toRad(s));
	            var mx = new Cesium.Cartographic(toRad(e), toRad(n));
	            this.setPolyPts(mn, mx);
	        };
	        
	        DrawExtentHelper.prototype.handleRegionStop = function(movement) {
	            this.enableInput();
	            var cartesian = scene.getCamera().controller.pickEllipsoid(movement.position,
	                    ellipsoid);
	            if (cartesian) {
	                this._click2 = ellipsoid.cartesianToCartographic(cartesian);
	            }
	            this._mouseHandler.destroy();

	            this._finishHandler(this.getExtent(this._click1, this._click2));
	        };
	        
	        DrawExtentHelper.prototype.handleRegionInter = function(movement) {
	            var cartesian = scene.getCamera().controller.pickEllipsoid(movement.endPosition, ellipsoid);
	            if (cartesian) {
	                var cartographic = ellipsoid.cartesianToCartographic(cartesian);
	                this.setPolyPts(this._click1, cartographic);
	            }
	        };
	        
	        DrawExtentHelper.prototype.handleRegionStart = function(movement) {
	            var cartesian = scene.getCamera().controller.pickEllipsoid(movement.position, ellipsoid);
	            if (cartesian) {
	                var that = this;
	                this._click1 = ellipsoid.cartesianToCartographic(cartesian);
	                this._mouseHandler.setInputAction(function(movement) {
	                    that.handleRegionStop(movement);
	                }, Cesium.ScreenSpaceEventType.LEFT_UP);
	                this._mouseHandler.setInputAction(function(movement) {
	                    that.handleRegionInter(movement);
	                }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	            }
	        };
	        
	        DrawExtentHelper.prototype.start = function() {
	            this.disableInput();

	            var that = this;

	            // Now wait for start
	            this._mouseHandler.setInputAction(function(movement) {
	                that.handleRegionStart(movement);
	            }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
	        };
	        
	        // Actual instantiation...
	        var myHandler = function(e) {
	            var labels = new Cesium.LabelCollection();
	            label = labels.add();
	            scene.getPrimitives().add(labels);
	            
	            label.setShow(true);
	            label.setText('(' +
	                Cesium.Math.toDegrees(e.west).toFixed(2) + ', ' +
	                Cesium.Math.toDegrees(e.south).toFixed(2) + ', ' +
	                Cesium.Math.toDegrees(e.east).toFixed(2) + ', ' +
	                Cesium.Math.toDegrees(e.north).toFixed(2) + ')');
	            label.setScale(0.7);
	            label.setPosition(ellipsoid.cartographicToCartesian(e.getCenter()));
	            label.setHorizontalOrigin( Cesium.HorizontalOrigin.CENTER );
	        };
	        
			// check for cleanUp first
		    if(globe.editCleanUp) {
		    	globe.editCleanUp();
		    }
	        
	        var drawExtentHelper = new DrawExtentHelper(scene, myHandler);
		    if(initialLat != undefined && initialLng != undefined) {
		    	drawExtentHelper.handleRegionStart({position: new Cesium.Cartesian2(initialLat, initial)});
		    } else {
	        	drawExtentHelper.start();
		    }

	}

    return _;
})();
