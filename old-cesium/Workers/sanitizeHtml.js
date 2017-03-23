/**
 * Cesium - https://github.com/AnalyticalGraphicsInc/cesium
 *
 * Copyright 2011-2014 Cesium Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Columbus View (Pat. Pend.)
 *
 * Portions licensed separately.
 * See https://github.com/AnalyticalGraphicsInc/cesium/blob/master/LICENSE.md for full licensing details.
 */
!function(){define("Core/defined",[],function(){"use strict";var e=function(e){return void 0!==e};return e}),define("Core/RuntimeError",["./defined"],function(e){"use strict";var r=function(e){this.name="RuntimeError",this.message=e;var r;try{throw new Error}catch(t){r=t.stack}this.stack=r};return r.prototype.toString=function(){var r=this.name+": "+this.message;return e(this.stack)&&(r+="\n"+this.stack.toString()),r},r}),define("Core/freezeObject",["./defined"],function(e){"use strict";var r=Object.freeze;return e(r)||(r=function(e){return e}),r}),define("Core/defaultValue",["./freezeObject"],function(e){"use strict";var r=function(e,r){return void 0!==e?e:r};return r.EMPTY_OBJECT=e({}),r}),define("Workers/createTaskProcessorWorker",["../Core/defaultValue","../Core/defined"],function(e,r){"use strict";var t=function(t){var i,n=[],o={id:void 0,result:void 0,error:void 0};return function(s){var a=s.data;n.length=0,o.id=a.id,o.error=void 0,o.result=void 0;try{o.result=t(a.parameters,n)}catch(u){o.error=u}r(i)||(i=e(self.webkitPostMessage,self.postMessage));try{i(o,n)}catch(u){o.result=void 0,o.error="postMessage failed with error: "+u+"\n  with responseMessage: "+JSON.stringify(o),i(o)}}};return t}),define("Workers/sanitizeHtml",["../Core/defined","../Core/RuntimeError","./createTaskProcessorWorker"],function(e,r,t){"use strict";var i,n="//caja.appspot.com/html-css-sanitizer-minified.js",o=function(t){if(!e(i)&&(self.window={},importScripts(n),i=window.html_sanitize,!e(i)))throw new r("Unable to load Google Caja sanitizer script.");return i(t)};return t(o)})}();