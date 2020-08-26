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
const adapters_1 = require("./adapters");
/** @ignore */
exports.ITERATOR_DONE = Object.freeze({ done: true, value: void 0 });
/** @ignore */
class ArrowJSON {
  // @ts-ignore
  constructor(_json) {
    this._json = _json;
  }
  get schema() {
    return this._json["schema"];
  }
  get batches() {
    return this._json["batches"] || [];
  }
  get dictionaries() {
    return this._json["dictionaries"] || [];
  }
}
exports.ArrowJSON = ArrowJSON;
/** @ignore */
class ReadableInterop {
  tee() {
    return this._getDOMStream().tee();
  }
  pipe(writable, options) {
    return this._getNodeStream().pipe(
      writable,
      options
    );
  }
  pipeTo(writable, options) {
    return this._getDOMStream().pipeTo(writable, options);
  }
  pipeThrough(duplex, options) {
    return this._getDOMStream().pipeThrough(duplex, options);
  }
  _getDOMStream() {
    return this._DOMStream || (this._DOMStream = this.toDOMStream());
  }
  _getNodeStream() {
    return this._nodeStream || (this._nodeStream = this.toNodeStream());
  }
}
exports.ReadableInterop = ReadableInterop;
/** @ignore */
class AsyncQueue extends ReadableInterop {
  constructor() {
    super();
    this._values = [];
    this.resolvers = [];
    this._closedPromise = new Promise(r => (this._closedPromiseResolve = r));
  }
  get closed() {
    return this._closedPromise;
  }
  async cancel(reason) {
    await this.return(reason);
  }
  write(value) {
    if (this._ensureOpen()) {
      this.resolvers.length <= 0
        ? this._values.push(value)
        : this.resolvers.shift().resolve({ done: false, value });
    }
  }
  abort(value) {
    if (this._closedPromiseResolve) {
      this.resolvers.length <= 0
        ? (this._error = { error: value })
        : this.resolvers.shift().reject({ done: true, value });
    }
  }
  close() {
    if (this._closedPromiseResolve) {
      const { resolvers } = this;
      while (resolvers.length > 0) {
        resolvers.shift().resolve(exports.ITERATOR_DONE);
      }
      this._closedPromiseResolve();
      this._closedPromiseResolve = undefined;
    }
  }
  [Symbol.asyncIterator]() {
    return this;
  }
  toDOMStream(options) {
    return adapters_1.default.toDOMStream(
      this._closedPromiseResolve || this._error ? this : this._values,
      options
    );
  }
  toNodeStream(options) {
    return adapters_1.default.toNodeStream(
      this._closedPromiseResolve || this._error ? this : this._values,
      options
    );
  }
  async throw(_) {
    await this.abort(_);
    return exports.ITERATOR_DONE;
  }
  async return(_) {
    await this.close();
    return exports.ITERATOR_DONE;
  }
  async read(size) {
    return (await this.next(size, "read")).value;
  }
  async peek(size) {
    return (await this.next(size, "peek")).value;
  }
  next(..._args) {
    if (this._values.length > 0) {
      return Promise.resolve({ done: false, value: this._values.shift() });
    } else if (this._error) {
      return Promise.reject({ done: true, value: this._error.error });
    } else if (!this._closedPromiseResolve) {
      return Promise.resolve(exports.ITERATOR_DONE);
    } else {
      return new Promise((resolve, reject) => {
        this.resolvers.push({ resolve, reject });
      });
    }
  }
  _ensureOpen() {
    if (this._closedPromiseResolve) {
      return true;
    }
    throw new Error(`${this} is closed`);
  }
}
exports.AsyncQueue = AsyncQueue;

//# sourceMappingURL=interfaces.js.map
