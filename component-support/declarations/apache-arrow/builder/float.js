"use strict";
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
Object.defineProperty(exports, "__esModule", { value: true });
const math_1 = require("../util/math");
const builder_1 = require("../builder");
/** @ignore */
class FloatBuilder extends builder_1.FixedWidthBuilder {}
exports.FloatBuilder = FloatBuilder;
/** @ignore */
class Float16Builder extends FloatBuilder {
  setValue(index, value) {
    // convert JS float64 to a uint16
    this._values.set(index, math_1.float64ToUint16(value));
  }
}
exports.Float16Builder = Float16Builder;
/** @ignore */
class Float32Builder extends FloatBuilder {
  setValue(index, value) {
    this._values.set(index, value);
  }
}
exports.Float32Builder = Float32Builder;
/** @ignore */
class Float64Builder extends FloatBuilder {
  setValue(index, value) {
    this._values.set(index, value);
  }
}
exports.Float64Builder = Float64Builder;

//# sourceMappingURL=float.js.map
