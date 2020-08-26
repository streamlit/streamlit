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
const enum_1 = require("../enum");
const base_1 = require("./base");
const index_1 = require("./index");
const type_1 = require("../type");
/** @ignore */
class DateVector extends base_1.BaseVector {
  /** @nocollapse */
  static from(...args) {
    if (args.length === 2) {
      return index_1.vectorFromValuesWithType(
        () =>
          args[1] === enum_1.DateUnit.DAY
            ? new type_1.DateDay()
            : new type_1.DateMillisecond(),
        args[0]
      );
    }
    return index_1.vectorFromValuesWithType(
      () => new type_1.DateMillisecond(),
      args[0]
    );
  }
}
exports.DateVector = DateVector;
/** @ignore */
class DateDayVector extends DateVector {}
exports.DateDayVector = DateDayVector;
/** @ignore */
class DateMillisecondVector extends DateVector {}
exports.DateMillisecondVector = DateMillisecondVector;

//# sourceMappingURL=date.js.map
