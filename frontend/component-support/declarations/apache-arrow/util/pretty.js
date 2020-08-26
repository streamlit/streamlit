"use strict"
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
Object.defineProperty(exports, "__esModule", { value: true })
/** @ignore */ const undf = void 0
/** @ignore */
function valueToString(x) {
  if (x === null) {
    return "null"
  }
  if (x === undf) {
    return "undefined"
  }
  switch (typeof x) {
    case "number":
      return `${x}`
    case "bigint":
      return `${x}`
    case "string":
      return `"${x}"`
  }
  // If [Symbol.toPrimitive] is implemented (like in BN)
  // use it instead of JSON.stringify(). This ensures we
  // print BigInts, Decimals, and Binary in their native
  // representation
  if (typeof x[Symbol.toPrimitive] === "function") {
    return x[Symbol.toPrimitive]("string")
  }
  return ArrayBuffer.isView(x) ? `[${x}]` : JSON.stringify(x)
}
exports.valueToString = valueToString

//# sourceMappingURL=pretty.js.map
