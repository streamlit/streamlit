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
const buffer_1 = require("./buffer");
const text_encoding_utf_8_1 = require("text-encoding-utf-8");
/** @ignore @suppress {missingRequire} */
const _Buffer = typeof Buffer === "function" ? Buffer : null;
/** @ignore */
const useNativeEncoders =
  typeof TextDecoder === "function" && typeof TextEncoder === "function";
/** @ignore */
exports.decodeUtf8 = (TextDecoder => {
  if (useNativeEncoders || !_Buffer) {
    const decoder = new TextDecoder("utf-8");
    return buffer => decoder.decode(buffer);
  }
  return input => {
    const { buffer, byteOffset, length } = buffer_1.toUint8Array(input);
    return _Buffer.from(buffer, byteOffset, length).toString();
  };
})(
  typeof TextDecoder !== "undefined"
    ? TextDecoder
    : text_encoding_utf_8_1.TextDecoder
);
/** @ignore */
exports.encodeUtf8 = (TextEncoder => {
  if (useNativeEncoders || !_Buffer) {
    const encoder = new TextEncoder();
    return value => encoder.encode(value);
  }
  return (input = "") => buffer_1.toUint8Array(_Buffer.from(input, "utf8"));
})(
  typeof TextEncoder !== "undefined"
    ? TextEncoder
    : text_encoding_utf_8_1.TextEncoder
);

//# sourceMappingURL=utf8.js.map
