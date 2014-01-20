/**
 * Created by thomas on 9/01/14.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * (c) www.geocento.com
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

        this.enhancePrimitives();

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
        var _self = this;

        this._surfaces.push(surface);

        // handlers for interactions
        // highlight polygon when mouse is entering
        setListener(surface, 'mouseMove', function(position) {
            surface.setHighlighted(true);
            if(!surface._editMode) {
                _self._tooltip.showAt(position, "Click to edit this shape");
            }
        });
        // hide the highlighting when mouse is leaving the polygon
        setListener(surface, 'mouseOut', function(position) {
            surface.setHighlighted(false);
            _self._tooltip.setVisible(false);
        });
        setListener(surface, 'leftClick', function(position) {
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

    var ChangeablePrimitive = (function() {
        function _() {
        }

        _.prototype.initialiseOptions = function(options) {

            var material = Cesium.Material.fromType(Cesium.Material.ColorType);
            material.uniforms.color = new Cesium.Color(1.0, 1.0, 0.0, 0.5);

            options = fillOptions(options, {
                ellipsoid: Cesium.Ellipsoid.WGS84,
                granularity: Math.PI / 180.0,
                height: 0.0,
                textureRotationAngle: 0.0,
                show: true,
                material: material,
                asynchronous: true,
                debugShowBoundingVolume: false
            });

            fillOptions(this, options);

            this._ellipsoid = undefined;
            this._granularity = undefined;
            this._height = undefined;
            this._textureRotationAngle = undefined;
            this._id = undefined;

            // set the flags to initiate a first drawing
            this._createPrimitive = true;
            this._primitive = undefined;

        }

        _.prototype.setAttribute = function(name, value) {
            this[name] = value;
            this._createPrimitive = true;
        };

        _.prototype.getAttribute = function(name) {
            return this[name];
        };

        /**
         * @private
         */
        _.prototype.update = function(context, frameState, commandList) {
            if (!Cesium.defined(this.ellipsoid)) {
                throw new Cesium.DeveloperError('this.ellipsoid must be defined.');
            }

            if (!Cesium.defined(this.material)) {
                throw new Cesium.DeveloperError('this.material must be defined.');
            }

            if (this.granularity < 0.0) {
                throw new Cesium.DeveloperError('this.granularity and scene2D/scene3D overrides must be greater than zero.');
            }

            if (!this.show) {
                return;
            }

            if (!this._createPrimitive && (!Cesium.defined(this._primitive))) {
                // No positions/hierarchy to draw
                return;
            }

            if (this._createPrimitive ||
                (this._ellipsoid !== this.ellipsoid) ||
                (this._granularity !== this.granularity) ||
                (this._height !== this.height) ||
                (this._textureRotationAngle !== this.textureRotationAngle) ||
                (this._id !== this.id)) {

                this._createPrimitive = false;
                this._ellipsoid = this.ellipsoid;
                this._granularity = this.granularity;
                this._height = this.height;
                this._textureRotationAngle = this.textureRotationAngle;
                this._id = this.id;

                this._primitive = this._primitive && this._primitive.destroy();

                this._primitive = new Cesium.Primitive({
                    geometryInstances : new Cesium.GeometryInstance({
                        geometry : this.getGeometry(),
                        id : this.id,
                        pickPrimitive : this
                    }),
                    appearance : new Cesium.EllipsoidSurfaceAppearance({
                        aboveGround : (this.height > 0.0)
                    }),
                    asynchronous : this.asynchronous
                });
            }

            var primitive = this._primitive;
            primitive.debugShowBoundingVolume = this.debugShowBoundingVolume;
            primitive.appearance.material = this.material;
            primitive.update(context, frameState, commandList);
        };

        _.prototype.isDestroyed = function() {
            return false;
        };

        _.prototype.destroy = function() {
            this._primitive = this._primitive && this._primitive.destroy();
            return Cesium.destroyObject(this);
        };

        return _;
    })();

    _.CirclePrimitive = (function() {
        function _(options) {

            if(!(Cesium.defined(options.center) && Cesium.defined(options.radius))) {
                throw new Cesium.DeveloperError('Center and radius are required');
            }

            this.initialiseOptions(options);

            this.setRadius(options.radius);

        }

        _.prototype = new ChangeablePrimitive();

        _.prototype.setCenter = function(center) {
            this.setAttribute('center', center);
        };

        _.prototype.setRadius = function(radius) {
            this.setAttribute('radius', Math.max(0.1, radius));
        };

        _.prototype.getCenter = function() {
            return this.getAttribute('center');
        };

        _.prototype.getRadius = function() {
            return this.getAttribute('radius');
        };

        _.prototype.getGeometry = function() {
            if (!(Cesium.defined(this.center) && Cesium.defined(this.radius))) {
                return;
            }

            return new Cesium.CircleGeometry({
                center : this.center,
                radius : this.radius,
                height : this.height,
                vertexFormat : Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                stRotation : this.textureRotationAngle,
                ellipsoid : this.ellipsoid,
                granularity : this.granularity
            });
        };

        return _;
    })();

    _.EllipsePrimitive = (function() {
        function _(options) {

            if(!(Cesium.defined(options.center) && Cesium.defined(options.semiMajorAxis) && Cesium.defined(options.semiMinorAxis))) {
                throw new Cesium.DeveloperError('Center and semi major and semi minor axis are required');
            }

            this.initialiseOptions(options);

        }

        _.prototype = new ChangeablePrimitive();

        _.prototype.setCenter = function(center) {
            this.setAttribute('center', center);
        };

        _.prototype.setSemiMajorAxis = function(semiMajorAxis) {
            this.setAttribute('semiMajorAxis', semiMajorAxis);
        };

        _.prototype.setSemiMinorAxis = function(semiMinorAxis) {
            this.setAttribute('semiMinorAxis', semiMinorAxis);
        };

        _.prototype.getCenter = function() {
            return this.getAttribute('center');
        };

        _.prototype.getSemiMajorAxis = function() {
            return this.getAttribute('semiMajorAxis');
        };

        _.prototype.getSemiMinorAxis = function() {
            return this.getAttribute('semiMinorAxis');
        };

        _.prototype.getGeometry = function() {
            if (!(Cesium.defined(this.center) && Cesium.defined(this.radius))) {
                return;
            }

            return new Cesium.EllipseGeometry({
                ellipsoid : this.ellipsoid,
                center : this.center,
                semiMajorAxis : this.semiMajorAxis,
                semiMinorAxis : this.semiMinorAxis,
                rotation : 0.0,
                height : this.height,
                vertexFormat : Cesium.EllipsoidSurfaceAppearance.VERTEX_FORMAT,
                stRotation : this.textureRotationAngle,
                ellipsoid : this.ellipsoid,
                granularity : this.granularity
            });
        };

        return _;
    })();

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
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

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
                if(positions.length < 5) {
                    return;
                } else {
                    var cartesian = scene.getCamera().controller.pickEllipsoid(position, ellipsoid);
                    if (cartesian) {
                        _self.stopDrawing();
                        if(typeof options.callback == 'function') {
                            // remove overlapping ones
                            var index = positions.length - 1;
                            // TODO - calculate some epsilon based on the zoom level
                            var epsilon = Cesium.Math.EPSILON3;
                            for(; index > 0 && positions[index].equalsEpsilon(positions[index - 1], epsilon); index--) {}
                            options.callback(positions.splice(0, index + 1));
                        }
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    }

    _.prototype.startDrawingExtent = function(options) {

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
            if(extent == null) {
                extent = new Cesium.ExtentPrimitive();
                extent.asynchronous = false;
                primitives.add(extent);
            }
            extent.extent = value;
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

        // Now wait for start
        mouseHandler.setInputAction(function(movement) {
            if(movement.position != null) {
                var cartesian = scene.getCamera().controller.pickEllipsoid(movement.position, ellipsoid);
                if (cartesian) {
                    if(circle == null) {
                        // create the circle
                        circle = new _.CirclePrimitive({
                            center: cartesian,
                            radius: 0,
                            asynchronous: false,
                            appearance : new Cesium.EllipsoidSurfaceAppearance({
                                material : options.material
                            })
                        });
                        primitives.add(circle);
                        markers = new _.BillboardGroup(_self, defaultBillboard);
                        markers.addBillboards([cartesian]);
                    } else {
                        if(typeof options.callback == 'function') {
                            options.callback(circle.getCenter(), circle.getRadius());
                        }
                        _self.stopDrawing();
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
                        circle.setRadius(Cesium.Cartesian3.distance(circle.getCenter(), cartesian));
                        markers.updateBillboardsPositions(cartesian);
                        tooltip.showAt(position, "<p>Move mouse to change circle radius</p><p>Click again to finish drawing</p>");
                    }
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    }

    _.prototype.enhancePrimitives = function() {

        var drawHelper = this;

        Cesium.Polygon.prototype.setEditable = function() {

            var polygon = this;
            polygon.asynchronous = false;

            var scene = drawHelper._scene;

            drawHelper.registerEditableShape(polygon);

            polygon.setEditMode = function(editMode) {
                // if no change
                if(this._editMode == editMode) {
                    return;
                }
                this.setHighlighted(false);
                // display markers
                if(editMode) {
                    // make sure all other shapes are not in edit mode before starting the editing of this shape
                    drawHelper.disableAllEditMode();
                    // create the markers and handlers for the editing
                    if(this._markers == null) {
                        var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                        var editMarkers = new _.BillboardGroup(drawHelper, dragHalfBillboard);
                        var positions = polygon.getPositions();
                        // function for updating the edit markers around a certain point
                        function updateHalfMarkers(index, positions) {
                            // update the half markers before and after the index
                            var editIndex = index - 1 < 0 ? positions.length - 1 : index - 1;
                            editMarkers.getBillboard(editIndex).setPosition(calculateHalfMarkerPosition(editIndex));
                            editIndex = index - 1 < 0 ? 0 : index;
                            editMarkers.getBillboard(editIndex).setPosition(calculateHalfMarkerPosition(editIndex));
                        }
                        function onEdited() {
                            polygon.executeListeners({name: 'onEdited', positions: polygon.getPositions()});
                        }
                        var handleMarkerChanges = {
                            dragHandlers: {
                                onDrag: function(index, position) {
                                    positions = polygon.getPositions();
                                    positions[index] = position;
                                    polygon.setPositions(positions);
                                    updateHalfMarkers(index, positions);
                                },
                                onDragEnd: function(index, position) {
                                    onEdited();
                                }
                            },
                            onDoubleClick: function(index) {
                                if(polygon.getPositions().length < 4) {
                                    return;
                                }
                                // remove the point and the corresponding markers
                                positions = polygon.getPositions();
                                positions.splice(index, 1);
                                markers.removeBillboard(index);
                                editMarkers.removeBillboard(index);
                                polygon.setPositions(positions);
                                updateHalfMarkers(index, positions);
                                onEdited();
                            },
                            tooltip: function() {
                                if(polygon.getPositions().length > 3) {
                                    return "Double click to remove this point";
                                }
                            }
                        };
                        // add billboards and keep an ordered list of them for the polygon edges
                        markers.addBillboards(positions, handleMarkerChanges);
                        this._markers = markers;
                        function calculateHalfMarkerPosition(index) {
                            positions = polygon.getPositions();
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
                                    positions = polygon.getPositions();
                                    this.index = index + 1;
                                    positions.splice(this.index, 0, position);
                                    polygon.setPositions(positions);
                                },
                                onDrag: function(index, position) {
                                    positions = polygon.getPositions();
                                    positions[this.index] = position;
                                    polygon.setPositions(positions);
                                },
                                onDragEnd: function(index, position) {
                                    // create new sets of makers for editing
                                    markers.insertBillboard(this.index, position, handleMarkerChanges);
                                    editMarkers.getBillboard(this.index - 1).setPosition(calculateHalfMarkerPosition(this.index - 1));
                                    editMarkers.insertBillboard(this.index, calculateHalfMarkerPosition(this.index), handleEditMarkerChanges);
                                    onEdited();
                                }
                            }
                        };
                        editMarkers.addBillboards(halfPositions, handleEditMarkerChanges);
                        this._editMarkers = editMarkers;
                        // add a handler for clicking in the globe
                        this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(scene.getCanvas());
                        this._globeClickhandler.setInputAction(
                            function (movement) {
                                var pickedObject = scene.pick(movement.position);
                                if(!(pickedObject && pickedObject.primitive)) {
                                    polygon.setEditMode(false);
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

            polygon.setHighlighted = function(highlighted) {
                // if no change
                // if already highlighted, the outline polygon will be available
                if((this._outlinePolygon != null) == highlighted) {
                    return;
                }
                // disable if already in edit mode
                if(this._editMode === true) {
                    return;
                }
                var primitives = scene.getPrimitives();
                // highlight by creating an outline polygon matching the polygon points
                if(highlighted) {
                    // make sure all other shapes are not highlighted
                    drawHelper.disableAllHighlights();
                    // create the highlighting frame
                    this._outlinePolygon = primitives.add(new Cesium.Primitive({
                        geometryInstances : new Cesium.GeometryInstance({
                            geometry : Cesium.PolygonOutlineGeometry.fromPositions({
                                positions : this.getPositions()
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
                                lineWidth : Math.min(4.0, scene.getContext().getMaximumAliasedLineWidth())
                            }
                        })
                    }));
                } else {
                    primitives.remove(this._outlinePolygon);
                    this._outlinePolygon = null;
                }

            }

            enhanceWithListeners(polygon);

            polygon.setEditMode(false);

        }

        Cesium.ExtentPrimitive.prototype.setEditable = function() {

            var extent = this;
            var scene = drawHelper._scene;

            drawHelper.registerEditableShape(extent);
            extent.asynchronous = false;

            extent.setEditMode = function(editMode) {
                // if no change
                if(this._editMode == editMode) {
                    return;
                }
                this.setHighlighted(false);
                // display markers
                if(editMode) {
                    // make sure all other shapes are not in edit mode before starting the editing of this shape
                    drawHelper.disableAllEditMode();
                    // create the markers and handlers for the editing
                    if(this._markers == null) {
                        function getCorners(extent) {
                            return ellipsoid.cartographicArrayToCartesianArray([extent.getNortheast(), extent.getNorthwest(), extent.getSouthwest(), extent.getSoutheast()]);
                        }
                        var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                        function onEdited() {
                            extent.executeListeners({name: 'onEdited', extent: extent.extent});
                        }
                        var handleMarkerChanges = {
                            dragHandlers: {
                                onDrag: function(index, position) {
                                    var corner = markers.getBillboard((index + 2) % 4).getPosition();
                                    extent.extent = getExtent(ellipsoid.cartesianToCartographic(corner), ellipsoid.cartesianToCartographic(position));
                                    markers.updateBillboardsPositions(getCorners(extent.extent));
                                },
                                onDragEnd: function(index, position) {
                                    onEdited();
                                }
                            },
                            tooltip: function() {
                                return "Drag to change the corners of this extent";
                            }
                        };
                        markers.addBillboards(getCorners(extent.extent), handleMarkerChanges);
                        this._markers = markers;
                        // add a handler for clicking in the globe
                        this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(scene.getCanvas());
                        this._globeClickhandler.setInputAction(
                            function (movement) {
                                var pickedObject = scene.pick(movement.position);
                                if(!(pickedObject && pickedObject.primitive)) {
                                    extent.setEditMode(false);
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

            extent.setHighlighted = function(highlighted) {
                // if no change
                // if already highlighted, the outline polygon will be available
                if((this._outlineRectangle != null) == highlighted) {
                    return;
                }
                // disable if already in edit mode
                if(this._editMode === true) {
                    return;
                }
                var primitives = scene.getPrimitives();
                // highlight by creating an outline polygon matching the polygon points
                if(highlighted) {
                    // make sure all other shapes are not highlighted
                    drawHelper.disableAllHighlights();
                    // create the highlighting frame
                    this._outlineRectangle = primitives.add(new Cesium.Primitive({
                        geometryInstances : new Cesium.GeometryInstance({
                            geometry : new Cesium.ExtentOutlineGeometry({
                                extent: this.extent
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
                                lineWidth : Math.min(4.0, scene.getContext().getMaximumAliasedLineWidth())
                            }
                        })
                    }));
                } else {
                    primitives.remove(this._outlineRectangle);
                    this._outlineRectangle = null;
                }
            }

            enhanceWithListeners(extent);

            extent.setEditMode(false);

        }

        _.CirclePrimitive.prototype.setEditable = function() {

            var circle = this;
            var scene = drawHelper._scene;

            circle.asynchronous = false;

            drawHelper.registerEditableShape(circle);

            circle.setEditMode = function(editMode) {
                // if no change
                if(this._editMode == editMode) {
                    return;
                }
                this.setHighlighted(false);
                // display markers
                if(editMode) {
                    var _self = this;
                    // make sure all other shapes are not in edit mode before starting the editing of this shape
                    drawHelper.disableAllEditMode();
                    // create the markers and handlers for the editing
                    if(this._markers == null) {
                        var markers = new _.BillboardGroup(drawHelper, dragBillboard);
                        function getMarkerPositions() {
                            return Cesium.Shapes.computeCircleBoundary(ellipsoid, circle.getCenter(), circle.getRadius(), 4).splice(0, 4);
                        }
                        function onEdited() {
                            circle.executeListeners({name: 'onEdited', center: circle.getCenter(), radius: circle.getRadius()});
                        }
                        var handleMarkerChanges = {
                            dragHandlers: {
                                onDrag: function(index, position) {
                                    circle.setRadius(Cesium.Cartesian3.distance(circle.getCenter(), position));
                                    markers.updateBillboardsPositions(getMarkerPositions());
                                },
                                onDragEnd: function(index, position) {
                                    onEdited();
                                }
                            },
                            tooltip: function() {
                                return "Drag to change the radius";
                            }
                        };
                        markers.addBillboards(getMarkerPositions(), handleMarkerChanges);
                        this._markers = markers;
                        // add a handler for clicking in the globe
                        this._globeClickhandler = new Cesium.ScreenSpaceEventHandler(scene.getCanvas());
                        this._globeClickhandler.setInputAction(
                            function (movement) {
                                var pickedObject = scene.pick(movement.position);
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

            circle.setHighlighted = function(highlighted) {
                // if no change
                // if already highlighted, the outline polygon will be available
                if((this._outlineCircle != null) == highlighted) {
                    return;
                }
                // disable if already in edit mode
                if(this._editMode === true) {
                    return;
                }
                var primitives = scene.getPrimitives();
                // highlight by creating an outline polygon matching the polygon points
                if(highlighted) {
                    // make sure all other shapes are not highlighted
                    drawHelper.disableAllHighlights();
                    // create the highlighting frame
                    this._outlineCircle = primitives.add(new Cesium.Primitive({
                        geometryInstances : [new Cesium.GeometryInstance({
                            geometry : new Cesium.CircleOutlineGeometry({
                                center: circle.getCenter(),
                                radius: circle.getRadius()
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
                                lineWidth : Math.min(4.0, scene.getContext().getMaximumAliasedLineWidth())
                            }
                        })
                    }));
                } else {
                    primitives.remove(this._outlineCircle);
                    this._outlineCircle = null;
                }
            }

            enhanceWithListeners(circle);

            circle.setEditMode(false);
        }

    }

    _.DrawHelperWidget = (function() {

        // constructor
        function _(drawHelper, options) {

            // container must be specified
            if(!(Cesium.defined(options.container))) {
                throw new Cesium.DeveloperError('Container is required');
            }

            var drawOptions = {
                polygonIcon: "./img/glyphicons_096_vector_path_polygon.png",
                circleIcon: "./img/glyphicons_095_vector_path_circle.png",
                extentIcon: "./img/glyphicons_094_vector_path_square.png",
                polygonDrawingOptions: {
                    material: new Cesium.Material({
                        fabric : {
                            type : 'Color',
                            uniforms : {
                                color : new Cesium.Color(1.0, 0.0, 1.0, 0.6)
                            }
                        }
                    })
                },
                extentDrawingOptions: {
                    material: new Cesium.Material({
                        fabric : {
                            type : 'Color',
                            uniforms : {
                                color : new Cesium.Color(0.0, 1.0, 0.0, 0.6)
                            }
                        }
                    })
                },
                circleDrawingOptions: {
                    material: new Cesium.Material({
                        fabric : {
                            type : 'Color',
                            uniforms : {
                                color : new Cesium.Color(0.0, 0.0, 1.0, 0.6)
                            }
                        }
                    })
                }
            };

            fillOptions(options, drawOptions);

            var _self = this;

            var toolbar = document.createElement('DIV');
            toolbar.className = "toolbar";
            options.container.appendChild(toolbar);

            function addIcon(id, url, title, callback) {
                var div = document.createElement('DIV');
                div.className = 'button';
                div.title = title;
                toolbar.appendChild(div);
                div.onclick = callback;
                var span = document.createElement('SPAN');
                div.appendChild(span);
                var image = document.createElement('IMG');
                image.src = url;
                span.appendChild(image);
                return div;
            }

            var scene = drawHelper._scene;

            addIcon('polygon', options.polygonIcon, 'Click to start drawing a 2D polygon', function() {
                drawHelper.startDrawingPolygon({
                    callback: function(positions) {
                        _self.executeListeners({name: 'polygonCreated', positions: positions});
                    }
                });
            })

            addIcon('extent', options.extentIcon, 'Click to start drawing an Extent', function() {
                drawHelper.startDrawingExtent({
                    callback: function(extent) {
                        _self.executeListeners({name: 'extentCreated', extent: extent});
                    }
                });
            })

            addIcon('circle', options.circleIcon, 'Click to start drawing a Circle', function() {
                drawHelper.startDrawingCircle({
                    callback: function(center, radius) {
                        _self.executeListeners({name: 'circleCreated', center: center, radius: radius});
                    }
                });
            })

            enhanceWithListeners(this);

        }

        return _;

    })();

    _.prototype.addToolbar = function(container, options) {
        options = fillOptions(options, {container: container});
        return new _.DrawHelperWidget(this, options);
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
            if(options[option] === undefined) {
                options[option] = defaultOptions[option];
            }
        }
        return options;
    }

    function setListener(primitive, type, callback) {
        primitive[type] = callback;
    }

    function enhanceWithListeners(element) {

        element._listeners = {};

        element.addListener = function(name, callback) {
            this._listeners[name] = (this._listeners[name] || []);
            this._listeners[name].push(callback);
            return this._listeners[name].length;
        }

        element.executeListeners = function(event, defaultCallback) {
            if(this._listeners[event.name] && this._listeners[event.name].length > 0) {
                var index = 0;
                for(;index < this._listeners[event.name].length; index++) {
                    this._listeners[event.name][index](event);
                }
            } else {
                if(defaultCallback) {
                    defaultCallback(event);
                }
            }
        }

    }

    return _;
})();
