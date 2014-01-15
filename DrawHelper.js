/**
 * Created by thomas on 9/01/14.
 *
 * www.geocento.com
 * www.metaaps.com
 *
 */

var DrawHelper = (function() {

    // static variables
    var ellipsoid = Cesium.Ellipsoid.WGS84;

    // constructor
    function _(cesiumWidget) {
        this._scene = cesiumWidget.scene;
        this._tooltip = createTooltip(cesiumWidget.container);
        this._surfaces = [];

        this.initialiseHandlers();
    }

    _.prototype.initialiseHandlers = function() {
        var scene = this._scene;
        var _self = this;
        // scene events
        var handler = new Cesium.ScreenSpaceEventHandler(scene.getCanvas());
        function callPrimitiveCallback(name, position) {
            if(_self._handlersMuted == true) return;
            var pickedObject = scene.pick(position);
            if(pickedObject && pickedObject.primitive && pickedObject.primitive[name]) {
                pickedObject.primitive[name](position);
            }
        }
        handler.setInputAction(
            function (movement) {
                callPrimitiveCallback('leftClick', movement.position);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        handler.setInputAction(
            function (movement) {
                callPrimitiveCallback('leftDoubleClick', movement.position);
            }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        var mouseOutObject;
        handler.setInputAction(
            function (movement) {
                if(_self._handlersMuted == true) return;
                var pickedObject = scene.pick(movement.endPosition);
                if(mouseOutObject && (!pickedObject || mouseOutObject != pickedObject.primitive)) {
                    !(mouseOutObject.isDestroyed && mouseOutObject.isDestroyed()) && mouseOutObject.mouseOut(movement.endPosition);
                    mouseOutObject = null;
                }
                if(pickedObject && pickedObject.primitive) {
                    pickedObject = pickedObject.primitive;
                    if(pickedObject.mouseOut) {
                        mouseOutObject = pickedObject;
                    }
                    if(pickedObject.mouseMove) {
                        pickedObject.mouseMove(movement.endPosition);
                    }
                }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        handler.setInputAction(
            function (movement) {
                callPrimitiveCallback('leftUp', movement.position);
            }, Cesium.ScreenSpaceEventType.LEFT_UP);
        handler.setInputAction(
            function (movement) {
                callPrimitiveCallback('leftDown', movement.position);
            }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
    }

    _.prototype.muteHandlers = function(muted) {
        this._handlersMuted = muted;
    }

    // register event handling for an editable shape
    // shape should implement setEditMode and setHighlighted
    _.prototype.registerEditableShape = function(surface) {
        this._surfaces.push(surface);
    }
    _.prototype.registerEditableShapeHandlers = function(surface, shape) {
        var _self = this;
        // handlers for interactions
        // highlight polygon when mouse is entering
        setListener(shape, 'mouseMove', function(position) {
            surface.setHighlighted(true);
            _self._tooltip.showAt(position, "Click to edit this shape");
        });
        // hide the highlighting when mouse is leaving the polygon
        setListener(shape, 'mouseOut', function(position) {
            surface.setHighlighted(false);
            _self._tooltip.setVisible(false);
        });
        setListener(shape, 'leftClick', function(position) {
            surface.setEditMode(true);
        });
    }

    _.prototype.startDrawing = function(cleanUp) {
        // undo any current edit of shapes
        this.disableAllEditMode();
        // check for cleanUp first
        if(this.editCleanUp) {
            this.editCleanUp();
        }
        this.editCleanUp = cleanUp;
        this.muteHandlers(true);
    }

    _.prototype.stopDrawing = function() {
        // check for cleanUp first
        if(this.editCleanUp) {
            this.editCleanUp();
            this.editCleanUp = null;
        }
        this.muteHandlers(false);
    }

    // make sure only one shape is highlighted at a time
    _.prototype.disableAllHighlights = function() {
        // disable editing mode on existing shapes
        var index = 0, surface;
        for(; index < this._surfaces.length; index++) {
            surface = this._surfaces[index];
            if(typeof surface.setEditMode == "function") {
                surface.setHighlighted(false);
            }
        }
    }

    // make sure only one shape is edited at a time
    _.prototype.disableAllEditMode = function() {
        // disable editing mode on existing shapes
        var index = 0, surface;
        for(; index < this._surfaces.length; index++) {
            surface = this._surfaces[index];
            if(typeof surface.setEditMode == "function") {
                surface.setEditMode(false);
            }
        }
    }

    var defaultSurfaceOptions = {
        material: new Cesium.Material({
            fabric : {
                type : 'Color',
                uniforms : {
                    color : new Cesium.Color(1.0, 1.0, 0.0, 0.6)
                }
            }
        })
    };

    _.prototype.startDrawingPolygon = function(options) {

        var options = fillOptions(options, defaultSurfaceOptions);

        this.startDrawing(
            function() {
                primitives.remove(poly);
                markers.remove();
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = scene.getPrimitives();
        var tooltip = this._tooltip;

        var minPoints = 3;
        var poly = new Cesium.Polygon();
        poly.material = options.material;
        poly.asynchronous = false;

        primitives.add(poly);

        var positions = [];
        var markers = new _.BillboardGroup(this, defaultBillboard);

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.getCanvas());

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if(movement.position != null) {
                var cartesian = scene.getCamera().controller.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    // first click
                    if(positions.length == 0) {
                        positions.push(cartesian.clone());
                        markers.addBillboard(positions[0]);
                    }
                    // add new point to polygon
                    // this one will move with the mouse
                    positions.push(cartesian);
                    if(positions.length > 2) {
                        poly.setPositions(positions);
                    }
                    // add marker at the new position
                    markers.addBillboard(cartesian);
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if(position != null) {
                if(positions.length == 0) {
                    tooltip.showAt(position, "<p>Click to add first point</p>");
                } else {
                    var cartesian = scene.getCamera().controller.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        positions.pop();
                        // make sure it is slightly different
                        cartesian.y += (1 + Math.random()) * Cesium.Math.EPSILON7;
                        positions.push(cartesian);
                        if(positions.length > 2) {
                            poly.setPositions(positions);
                        }
                        // update marker
                        markers.getBillboard(positions.length - 1).setPosition(cartesian);
                        // show tooltip
                        tooltip.showAt(position, "<p>Click to add new point (" + positions.length + ")</p>" + (positions.length > 3 ? "<p>Double click to finish drawing</p>" : ""));
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.position;
            if(position != null) {
                if(positions.length < 4) {
                    return;
                } else {
                    var cartesian = scene.getCamera().controller.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        _self.stopDrawing();
                        if(typeof options.callback == 'function') {
                            options.callback(positions);
                        }
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    }

    _.prototype.startDrawingRectangle = function(options) {

        var options = fillOptions(options, defaultSurfaceOptions);

        this.startDrawing(
            function() {
                if(extent != null) {
                    primitives.remove(extent);
                }
                markers.remove();
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = this._scene.getPrimitives();
        var tooltip = this._tooltip;

        var firstPoint = null;
        var extent = null;
        var markers = null;

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.getCanvas());

        function updateExtent(value) {
            if(extent != null) {
                primitives.remove(extent);
            }
            var extentInstance = new Cesium.GeometryInstance({
                geometry : new Cesium.ExtentGeometry({
                    extent : value,
                    vertexFormat : Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                    stRotation : Cesium.Math.toRadians(45)
                })
            });
            extent = new Cesium.Primitive({
                geometryInstances : [extentInstance],
                appearance : new Cesium.EllipsoidSurfaceAppearance({
                    material : options.material
                }),
                asynchronous: false
            });
            primitives.add(extent);
            // update the markers
            var corners = ellipsoid.cartographicArrayToCartesianArray([value.getNortheast(), value.getNorthwest(), value.getSoutheast(), value.getSouthwest()]);
            // create if they do not yet exist
            if(markers == null) {
                markers = new _.BillboardGroup(_self, defaultBillboard);
                markers.addBillboards(corners);
            } else {
                markers.updateBillboardsPositions(corners);
            }
         }

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if(movement.position != null) {
                var cartesian = scene.getCamera().controller.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    if(extent == null) {
                        // create the rectangle
                        firstPoint = ellipsoid.cartesianToCartographic(cartesian);
                        var value = getExtent(firstPoint, firstPoint);
                        updateExtent(value);
                     } else {
                        _self.stopDrawing();
                        if(typeof options.callback == 'function') {
                            options.callback(getExtent(firstPoint, ellipsoid.cartesianToCartographic(cartesian)));
                        }
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if(position != null) {
                if(extent == null) {
                    tooltip.showAt(position, "<p>Click to start drawing rectangle</p>");
                } else {
                    var cartesian = scene.getCamera().controller.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        var value = getExtent(firstPoint, ellipsoid.cartesianToCartographic(cartesian));
                        updateExtent(value);
                        tooltip.showAt(position, "<p>Drag to change rectangle extent</p><p>Click again to finish drawing</p>");
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

    _.prototype.startDrawingCircle = function(options) {

        var options = fillOptions(options, defaultSurfaceOptions);

        this.startDrawing(
            function cleanUp() {
                if(circle != null) {
                    primitives.remove(circle);
                }
                markers.remove();
                mouseHandler.destroy();
                tooltip.setVisible(false);
            }
        );

        var _self = this;
        var scene = this._scene;
        var primitives = this._scene.getPrimitives();
        var tooltip = this._tooltip;

        var circle = null;
        var markers = null;

        var mouseHandler = new Cesium.ScreenSpaceEventHandler(scene.getCanvas());

        function updateCircle(center, radius) {
            if(circle != null) {
                primitives.remove(circle);
            }
            radius = Math.max(radius, 0.1);
            var geometry = new Cesium.GeometryInstance({
                geometry : new Cesium.CircleGeometry({
                    center: center,
                    radius: radius
                })
            });
            circle = new Cesium.Primitive({
                geometryInstances : [geometry],
                appearance : new Cesium.EllipsoidSurfaceAppearance({
                    material : options.material
                }),
                asynchronous: false
            });
            primitives.add(circle);
            // update the markers
            // just add the center for now
            var points = [center];
            // create if they do not yet exist
            if(markers == null) {
                markers = new _.BillboardGroup(_self, defaultBillboard);
                markers.addBillboards(points);
            } else {
                markers.updateBillboardsPositions(points);
            }
            // TODO - find a better way to do this
            circle.center = center;
            circle.radius = radius;
        }

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if(movement.position != null) {
                var cartesian = scene.getCamera().controller.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    if(circle == null) {
                        // create the rectangle
                        updateCircle(cartesian, 0);
                    } else {
                        _self.stopDrawing();
                        if(typeof options.callback == 'function') {
                            options.callback(circle.center, circle.radius);
                        }
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        mouseHandler.setInputAction(function(movement) {
            var position = movement.endPosition;
            if(position != null) {
                if(circle == null) {
                    tooltip.showAt(position, "<p>Click to start drawing the circle</p>");
                } else {
                    var cartesian = scene.getCamera().controller.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        updateCircle(circle.center, Cesium.Cartesian3.distance(circle.center, cartesian));
                        tooltip.showAt(position, "<p>Move mouse to change circle radius</p><p>Click again to finish drawing</p>");
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

    _.prototype.createEditablePolygon = function(points, options) {
        return new _.EditablePolygon(this, points, options);
    }

    _.EditablePolygon = function(drawHelper, points, options) {

        var options = fillOptions(options, defaultSurfaceOptions);

        var _self = this;
        var scene = drawHelper._scene;
        var primitives = scene.getPrimitives();
        var poly = new Cesium.Polygon(options);
        poly.asynchronous = false;
        primitives.add(poly);

        this._poly = poly;
        this._drawHelper = drawHelper;
        this._scene = scene;

        drawHelper.registerEditableShape(this);
        drawHelper.registerEditableShapeHandlers(this, poly);

        this.setPoints(points);

     }

    _.EditablePolygon.prototype.setPoints = function(points) {
        this._poly.setPositions(points);
        this.setEditMode(false);
    }

    _.EditablePolygon.prototype.setEditMode = function(editMode) {
        // if no change
        if(this._editMode == editMode) {
            return;
        }
        this.setHighlighted(false);
        // display markers
        if(editMode) {
            // make sure all other shapes are not in edit mode before starting the editing of this shape
            this._drawHelper.disableAllEditMode();
            // create the markers and handlers for the editing
            if(this._markers == null) {
                var poly = this._poly;
                var markers = new _.BillboardGroup(this._drawHelper, dragBillboard);
                var editMarkers = new _.BillboardGroup(this._drawHelper, dragHalfBillboard);
                var positions = this._poly.getPositions();
                // function for updating the edit markers around a certain point
                function updateHalfMarkers(index, positions) {
                    // update the half markers before and after the index
                    var editIndex = index - 1 < 0 ? positions.length - 1 : index - 1;
                    editMarkers.getBillboard(editIndex).setPosition(calculateHalfMarkerPosition(editIndex));
                    editIndex = index - 1 < 0 ? 0 : index;
                    editMarkers.getBillboard(editIndex).setPosition(calculateHalfMarkerPosition(editIndex));
                }
                var handleMarkerChanges = {
                    dragHandlers: {
                        onDrag: function(index, position) {
                            positions = poly.getPositions();
                            positions[index] = position;
                            poly.setPositions(positions);
                            updateHalfMarkers(index, positions);
                        },
                        onDragEnd: function(index, position) {

                        }
                    },
                    onDoubleClick: function(index) {
                        if(poly.getPositions().length < 4) {
                            return;
                        }
                        // remove the point and the corresponding markers
                        positions = poly.getPositions();
                        positions.splice(index, 1);
                        markers.removeBillboard(index);
                        editMarkers.removeBillboard(index);
                        poly.setPositions(positions);
                        updateHalfMarkers(index, positions);
                    },
                    tooltip: function() {
                        if(poly.getPositions().length > 3) {
                            return "Double click to remove this point";
                        }
                    }
                };
                // add billboards and keep an ordered list of them for the polygon edges
                markers.addBillboards(positions, handleMarkerChanges);
                this._markers = markers;
                function calculateHalfMarkerPosition(index) {
                    positions = poly.getPositions();
                    return ellipsoid.scaleToGeodeticSurface(Cesium.Cartesian3.lerp(positions[index], positions[index < positions.length - 1 ? index + 1 : 0], 0.5));
                }
                var halfPositions = [];
                var index = 0;
                for(; index < positions.length; index++) {
                    halfPositions.push(calculateHalfMarkerPosition(index));
                }
                var handleEditMarkerChanges = {
                    dragHandlers: {
                        onDragStart: function(index, position) {
                            // add a new position to the polygon but not a new marker yet
                            positions = poly.getPositions();
                            this.index = index + 1;
                            positions.splice(this.index, 0, position);
                            poly.setPositions(positions);
                        },
                        onDrag: function(index, position) {
                            positions = poly.getPositions();
                            positions[this.index] = position;
                            poly.setPositions(positions);
                        },
                        onDragEnd: function(index, position) {
                            // create new sets of makers for editing
                            markers.insertBillboard(this.index, position);
                            editMarkers.getBillboard(this.index - 1).setPosition(calculateHalfMarkerPosition(this.index - 1));
                            editMarkers.insertBillboard(this.index, calculateHalfMarkerPosition(this.index));
                        }
                    }
                };
                editMarkers.addBillboards(halfPositions, handleEditMarkerChanges);
                var _self = this;
                this._editMarkers = editMarkers;
                // add a handler for clicking in the globe
                this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(this._scene.getCanvas());
                this._globeClickhandler.setInputAction(
                    function (movement) {
                        var pickedObject = _self._scene.pick(movement.position);
                        if(!(pickedObject && pickedObject.primitive)) {
                            _self.setEditMode(false);
                        }
                }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                // set on top of the polygon
                markers.setOnTop();
                editMarkers.setOnTop();
            }
            this._editMode = true;
        } else {
            if(this._markers != null) {
                this._markers.remove();
                this._editMarkers.remove();
                this._markers = null;
                this._editMarkers = null;
                this._globeClickhandler.destroy();
            }
            this._editMode = false;
        }
    }

    _.EditablePolygon.prototype.setHighlighted = function(highlighted) {
        // if no change
        // if already highlighted, the outline polygon will be available
        if((this._outlinePolygon != null) == highlighted) {
            return;
        }
        // disable if already in edit mode
        if(this._editMode === true) {
            return;
        }
        var primitives = this._scene.getPrimitives();
        // highlight by creating an outline polygon matching the polygon points
        if(highlighted) {
            // make sure all other shapes are not highlighted
            this._drawHelper.disableAllHighlights();
            // create the highlighting frame
            this._outlinePolygon = primitives.add(new Cesium.Primitive({
                geometryInstances : new Cesium.GeometryInstance({
                    geometry : Cesium.PolygonOutlineGeometry.fromPositions({
                        positions : this._poly.getPositions()
                    }),
                    attributes : {
                        color : Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE)
                    }
                }),
                appearance : new Cesium.PerInstanceColorAppearance({
                    flat : true,
                    renderState : {
                        depthTest : {
                            enabled : true
                        },
                        lineWidth : Math.min(4.0, this._scene.getContext().getMaximumAliasedLineWidth())
                    }
                })
            }));
        } else {
            primitives.remove(this._outlinePolygon);
            this._outlinePolygon = null;
        }
    }

    _.prototype.createEditableRectangle = function(extent, options) {
        return new _.EditableRectangle(this, extent, options);
    }

    _.EditableRectangle = function(drawHelper, extent, options) {

        var options = fillOptions(options, defaultSurfaceOptions);

        var _self = this;
        var scene = drawHelper._scene;

        this._drawHelper = drawHelper;
        this._scene = scene;

        drawHelper.registerEditableShape(this);
        this._rectangle = this.createExtent(extent, options);

        this.setEditMode(false);
    }

    _.EditableRectangle.prototype.createExtent = function(extent, options) {
        var primitives = this._scene.getPrimitives();
        if(this._rectangle) {
            primitives.remove(this._rectangle);
        }
        var geometry = new Cesium.GeometryInstance({
            geometry : new Cesium.ExtentGeometry({
                extent: extent
            })
        });
        var rectangle = new Cesium.Primitive({
            geometryInstances : [geometry],
            appearance : new Cesium.EllipsoidSurfaceAppearance({
                material : options.material
            }),
            asynchronous: false
        });
        primitives.add(rectangle);
        drawHelper.registerEditableShapeHandlers(this, rectangle);

        // store the center and radius values as they do not appear to be available through the primitive
        rectangle._extent = extent;
        rectangle._options = options;

        return rectangle;
    }

    _.EditableRectangle.prototype.setEditMode = function(editMode) {
        // if no change
        if(this._editMode == editMode) {
            return;
        }
        this.setHighlighted(false);
        // display markers
        if(editMode) {
            var _self = this;
            // make sure all other shapes are not in edit mode before starting the editing of this shape
            this._drawHelper.disableAllEditMode();
            // create the markers and handlers for the editing
            if(this._markers == null) {
                var rectangle = this._rectangle;
                function getCorners(extent) {
                    return ellipsoid.cartographicArrayToCartesianArray([extent.getNortheast(), extent.getNorthwest(), extent.getSouthwest(), extent.getSoutheast()]);
                }
                var markers = new _.BillboardGroup(this._drawHelper, dragBillboard);
                var handleMarkerChanges = {
                    dragHandlers: {
                        onDrag: function(index, position) {
                            var corner = markers.getBillboard((index + 2) % 4).getPosition();
                            _self._rectangle = _self.createExtent(getExtent(ellipsoid.cartesianToCartographic(corner), ellipsoid.cartesianToCartographic(position)), _self._rectangle._options);
                            markers.updateBillboardsPositions(getCorners(_self._rectangle._extent));
                        },
                        onDragEnd: function(index, position) {

                        }
                    },
                    tooltip: function() {
                        return "Drag to change the corners of this extent";
                    }
                };
                markers.addBillboards(getCorners(rectangle._extent), handleMarkerChanges);
                this._markers = markers;
                // add a handler for clicking in the globe
                this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(this._scene.getCanvas());
                this._globeClickhandler.setInputAction(
                    function (movement) {
                        var pickedObject = _self._scene.pick(movement.position);
                        if(!(pickedObject && pickedObject.primitive)) {
                            _self.setEditMode(false);
                        }
                    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                // set on top of the polygon
                markers.setOnTop();
            }
            this._editMode = true;
        } else {
            if(this._markers != null) {
                this._markers.remove();
                this._markers = null;
                this._globeClickhandler.destroy();
            }
            this._editMode = false;
        }
    }

    _.EditableRectangle.prototype.setHighlighted = function(highlighted) {
        // if no change
        // if already highlighted, the outline polygon will be available
        if((this._outlineRectangle != null) == highlighted) {
            return;
        }
        // disable if already in edit mode
        if(this._editMode === true) {
            return;
        }
        var primitives = this._scene.getPrimitives();
        // highlight by creating an outline polygon matching the polygon points
        if(highlighted) {
            // make sure all other shapes are not highlighted
            this._drawHelper.disableAllHighlights();
            // create the highlighting frame
            this._outlineRectangle = primitives.add(new Cesium.Primitive({
                geometryInstances : new Cesium.GeometryInstance({
                    geometry : new Cesium.ExtentOutlineGeometry({
                        extent: this._rectangle._extent
                    }),
                    attributes : {
                        color : Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE)
                    }
                }),
                appearance : new Cesium.PerInstanceColorAppearance({
                    flat : true,
                    renderState : {
                        depthTest : {
                            enabled : true
                        },
                        lineWidth : Math.min(4.0, this._scene.getContext().getMaximumAliasedLineWidth())
                    }
                })
            }));
        } else {
            primitives.remove(this._outlineRectangle);
            this._outlineRectangle = null;
        }
    }

    _.prototype.createEditableCircle = function(center, radius, options) {
        return new _.EditableCircle(this, center, radius, options);
    }

    _.EditableCircle = function(drawHelper, center, radius, options) {

        var options = fillOptions(options, defaultSurfaceOptions);

        var _self = this;

        this._drawHelper = drawHelper;
        this._scene = drawHelper._scene;

        drawHelper.registerEditableShape(this);

        this._circle = this.createCircle(center, radius, options);

        this.setEditMode(false);
    }

    _.EditableCircle.prototype.createCircle = function(center, radius, options) {
        var primitives = this._scene.getPrimitives();
        if(this._circle) {
            primitives.remove(this._circle);
        }
        var geometry = new Cesium.GeometryInstance({
            geometry : new Cesium.CircleGeometry({
                center: center,
                radius: radius
            })
        });
        var circle = new Cesium.Primitive({
            geometryInstances : [geometry],
            appearance : new Cesium.EllipsoidSurfaceAppearance({
                material : options.material
            }),
            asynchronous: false
        });
        primitives.add(circle);
        drawHelper.registerEditableShapeHandlers(this, circle);

        // store the center and radius values as they do not appear to be available through the primitive
        circle._center = center;
        circle._radius = radius;
        circle._options = options;

        return circle;
    }

    _.EditableCircle.prototype.setEditMode = function(editMode) {
        // if no change
        if(this._editMode == editMode) {
            return;
        }
        this.setHighlighted(false);
        // display markers
        if(editMode) {
            var _self = this;
            // make sure all other shapes are not in edit mode before starting the editing of this shape
            this._drawHelper.disableAllEditMode();
            // create the markers and handlers for the editing
            if(this._markers == null) {
                var circle = this._circle;
                var markers = new _.BillboardGroup(this._drawHelper, dragBillboard);
                var handleMarkerChanges = {
                    dragHandlers: {
                        onDrag: function(index, position) {
                            _self._circle = _self.createCircle(circle._center, Cesium.Cartesian3.distance(circle._center, position), circle._options);
                        },
                        onDragEnd: function(index, position) {

                        }
                    },
                    tooltip: function() {
                        return "Drag to change the radius";
                    }
                };
                markers.addBillboard(Cesium.Shapes.computeCircleBoundary(ellipsoid, this._circle._center, this._circle._radius)[0], handleMarkerChanges);
                this._markers = markers;
                // add a handler for clicking in the globe
                this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(this._scene.getCanvas());
                this._globeClickhandler.setInputAction(
                    function (movement) {
                        var pickedObject = _self._scene.pick(movement.position);
                        if(!(pickedObject && pickedObject.primitive)) {
                            _self.setEditMode(false);
                        }
                    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                // set on top of the polygon
                markers.setOnTop();
            }
            this._editMode = true;
        } else {
            if(this._markers != null) {
                this._markers.remove();
                this._markers = null;
                this._globeClickhandler.destroy();
            }
            this._editMode = false;
        }
    }

    _.EditableCircle.prototype.setHighlighted = function(highlighted) {
        // if no change
        // if already highlighted, the outline polygon will be available
        if((this._outlineCircle != null) == highlighted) {
            return;
        }
        // disable if already in edit mode
        if(this._editMode === true) {
            return;
        }
        var primitives = this._scene.getPrimitives();
        // highlight by creating an outline polygon matching the polygon points
        if(highlighted) {
            // make sure all other shapes are not highlighted
            this._drawHelper.disableAllHighlights();
            // create the highlighting frame
            this._outlineCircle = primitives.add(new Cesium.Primitive({
                geometryInstances : [new Cesium.GeometryInstance({
                    geometry : new Cesium.CircleOutlineGeometry({
                        center: this._circle._center,
                        radius: this._circle._radius
                    }),
                    attributes : {
                        color : Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE)
                    }
                })],
                appearance : new Cesium.PerInstanceColorAppearance({
                    flat : true,
                    renderState : {
                        depthTest : {
                            enabled : true
                        },
                        lineWidth : Math.min(4.0, this._scene.getContext().getMaximumAliasedLineWidth())
                    }
                })
            }));
        } else {
            primitives.remove(this._outlineCircle);
            this._outlineCircle = null;
        }
    }

    var defaultBillboard = {
        iconUrl: "./img/dragIcon.png",
        shiftX: 0,
        shiftY: 0
    }

    var dragBillboard = {
        iconUrl: "./img/dragIcon.png",
        shiftX: 0,
        shiftY: 0
    }

    var dragHalfBillboard = {
        iconUrl: "./img/dragIconLight.png",
        shiftX: 0,
        shiftY: 0
    }

    _.prototype.createBillboardGroup = function(points, callbacks) {
        var markers = new _.BillboardGroup(this, defaultBillboard);
        markers.addBillboards(points, callbacks);
        return markers;
    }

    _.BillboardGroup = function(drawHelper, options) {

        this._drawHelper = drawHelper;
        this._scene = drawHelper._scene;

        this._options = fillOptions(options, defaultBillboard);

        // create one common billboard collection for all billboards
        var b = new Cesium.BillboardCollection();
        var a = this._scene.getContext().createTextureAtlas();
        b.setTextureAtlas(a);
        this._scene.getPrimitives().add(b);
        this._billboards = b;
        this._textureAtlas = a;
        // keep an ordered list of billboards
        this._orderedBillboards = [];

        // create the image for the billboards
        var image = new Image();
        var _self = this;
        image.onload = function() {
            a.addImage(image);
        };
        image.src = options.iconUrl;
    }

    _.BillboardGroup.prototype.createBillboard = function(position, callbacks) {

        var billboard = this._billboards.add({
            show : true,
            position : position,
            pixelOffset : new Cesium.Cartesian2(this._options.shiftX, this._options.shiftY),
            eyeOffset : new Cesium.Cartesian3(0.0, 0.0, 0.0),
            horizontalOrigin : Cesium.HorizontalOrigin.CENTER,
            verticalOrigin : Cesium.VerticalOrigin.CENTER,
            scale : 1.0,
            imageIndex : 0,
            color : new Cesium.Color(1.0, 1.0, 1.0, 1.0)
        });

        // if editable
        if(callbacks) {
            var _self = this;
            var screenSpaceCameraController = this._scene.getScreenSpaceCameraController();
            function enableRotation(enable) {
                screenSpaceCameraController.enableRotate = enable;
            }
            function getIndex() {
                // find index
                for (var i = 0, I = _self._orderedBillboards.length; i < I && _self._orderedBillboards[i] != billboard; ++i);
                return i;
            }
            if(callbacks.dragHandlers) {
                var _self = this;
                setListener(billboard, 'leftDown', function(position) {
                    // TODO - start the drag handlers here
                    // create handlers for mouseOut and leftUp for the billboard and a mouseMove
                    function onDrag(position) {
                        billboard.setPosition(position);
                        // find index
                        for (var i = 0, I = _self._orderedBillboards.length; i < I && _self._orderedBillboards[i] != billboard; ++i);
                        callbacks.dragHandlers.onDrag && callbacks.dragHandlers.onDrag(getIndex(), position);
                    }
                    function onDragEnd(position) {
                        handler.destroy();
                        enableRotation(true);
                        callbacks.dragHandlers.onDragEnd && callbacks.dragHandlers.onDragEnd(getIndex(), position);
                    }

                    var handler = new Cesium.ScreenSpaceEventHandler(_self._scene.getCanvas());

                    handler.setInputAction(function(movement) {
                        var cartesian = _self._scene.getCamera().controller.pickEllipsoid(movement.endPosition, ellipsoid);
                        if (cartesian) {
                            onDrag(cartesian);
                        } else {
                            onDragEnd(cartesian);
                        }
                    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

                    handler.setInputAction(function(movement) {
                        onDragEnd(_self._scene.getCamera().controller.pickEllipsoid(movement.position, ellipsoid));
                    }, Cesium.ScreenSpaceEventType.LEFT_UP);

                    enableRotation(false);

                    callbacks.dragHandlers.onDragStart && callbacks.dragHandlers.onDragStart(getIndex(), _self._scene.getCamera().controller.pickEllipsoid(position, ellipsoid));
                });
             }
            if(callbacks.onDoubleClick) {
                setListener(billboard, 'leftDoubleClick', function(position) {
                    callbacks.onDoubleClick(getIndex());
                });
            }
            if(callbacks.onClick) {
                setListener(billboard, 'leftClick', function(position) {
                    callbacks.onClick(getIndex());
                });
            }
            if(callbacks.tooltip) {
                setListener(billboard, 'mouseMove', function(position) {
                    _self._drawHelper._tooltip.showAt(position, callbacks.tooltip());
                });
                setListener(billboard, 'mouseOut', function(position) {
                    _self._drawHelper._tooltip.setVisible(false);
                });
            }
        }

        return billboard;
    }

    _.BillboardGroup.prototype.insertBillboard = function(index, position, callbacks) {
        this._orderedBillboards.splice(index, 0, this.createBillboard(position, callbacks));
    }

    _.BillboardGroup.prototype.addBillboard = function(position, callbacks) {
        this._orderedBillboards.push(this.createBillboard(position, callbacks));
    }

    _.BillboardGroup.prototype.addBillboards = function(positions, callbacks) {
        var index =  0;
        for(; index < positions.length; index++) {
            this.addBillboard(positions[index], callbacks);
        }
    }

    _.BillboardGroup.prototype.updateBillboardsPositions = function(positions) {
        var index =  0;
        for(; index < positions.length; index++) {
            this.getBillboard(index).setPosition(positions[index]);
        }
    }

    _.BillboardGroup.prototype.getBillboard = function(index) {
        return this._orderedBillboards[index];
    }

    _.BillboardGroup.prototype.removeBillboard = function(index) {
        this._billboards.remove(this.getBillboard(index));
        this._orderedBillboards.splice(index, 1);
    }

    _.BillboardGroup.prototype.remove = function() {
        this._billboards = this._billboards && this._billboards.removeAll() && this._billboards.destroy();
    }

    _.BillboardGroup.prototype.setOnTop = function() {
            this._scene.getPrimitives().raiseToTop(this._billboards);
    }

    function getExtent(mn, mx) {
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

    function createTooltip(frameDiv) {

        var tooltip = function(frameDiv) {

            var div = document.createElement('DIV');
            div.className = "twipsy right";

            var arrow = document.createElement('DIV');
            arrow.className = "twipsy-arrow";
            div.appendChild(arrow);

            var title = document.createElement('DIV');
            title.className = "twipsy-inner";
            div.appendChild(title);

            this._div = div;
            this._title = title;

            // add to frame div and display coordinates
            frameDiv.appendChild(div);
        }

        tooltip.prototype.setVisible = function(visible) {
            this._div.style.display = visible ? 'block' : 'none';
        }

        tooltip.prototype.showAt = function(position, message) {
            if(position && message) {
                this.setVisible(true);
                this._title.innerHTML = message;
                this._div.style.left = position.x + 10 + "px";
                this._div.style.top = (position.y - this._div.clientHeight / 2) + "px";
            }
        }

        return new tooltip(frameDiv);
    }

    function fillOptions(options, defaultOptions) {
        options = options || {};
        var option;
        for(option in defaultOptions) {
            options[option] = options[option] || defaultOptions[option];
        }
        return options;
    }

    function setListener(primitive, type, callback) {
        primitive[type] = callback;
    }

    return _;
})();
