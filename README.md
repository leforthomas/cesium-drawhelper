cesium-drawhelper
================

DrawHelper: A very early stage shape editor for Cesium. Currently limited to 2D and simple shapes.

Cesium version: Tested against b24.

License: Apache 2.0. Free for commercial and non-commercial use. See LICENSE.md.

Usage:

Import the DrawHelper.js, DrawHelper.css and /img/ image files into your directory. Add script and css files to your page.

Instantiate a drawHelper passing it the CesiumWidget.

You can:
- use the self contained drawing widget by calling the drawHelper.addToolbar(container, options). This will add a drawing toolbar to the specified container. Options are for personalising the display of the shapes.
- use the startDrawXXX methods of DrawHelper to create shapes interactively
- enable editing of your primitives (at the moment only Polygon, ExtentPrimitive and DrawHelper.CirclePrimitive) by calling their setEditMode method.

Check the index.html example to get started.

Check the website http://pad.geocento.com/DrawHelper/ for a live version.

Future versions will include additional shapes (Polyline, Ellipse) creation and editing and hierarchical polygon editing and creation.

