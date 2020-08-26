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
const interfaces_1 = require("../io/interfaces")
/** @ignore */
const [BigIntCtor, BigIntAvailable] = (() => {
  const BigIntUnavailableError = () => {
    throw new Error("BigInt is not available in this environment")
  }
  function BigIntUnavailable() {
    throw BigIntUnavailableError()
  }
  BigIntUnavailable.asIntN = () => {
    throw BigIntUnavailableError()
  }
  BigIntUnavailable.asUintN = () => {
    throw BigIntUnavailableError()
  }
  return typeof BigInt !== "undefined"
    ? [BigInt, true]
    : [BigIntUnavailable, false]
})()
exports.BigInt = BigIntCtor
exports.BigIntAvailable = BigIntAvailable
/** @ignore */
const [BigInt64ArrayCtor, BigInt64ArrayAvailable] = (() => {
  const BigInt64ArrayUnavailableError = () => {
    throw new Error("BigInt64Array is not available in this environment")
  }
  class BigInt64ArrayUnavailable {
    static get BYTES_PER_ELEMENT() {
      return 8
    }
    static of() {
      throw BigInt64ArrayUnavailableError()
    }
    static from() {
      throw BigInt64ArrayUnavailableError()
    }
    constructor() {
      throw BigInt64ArrayUnavailableError()
    }
  }
  return typeof BigInt64Array !== "undefined"
    ? [BigInt64Array, true]
    : [BigInt64ArrayUnavailable, false]
})()
exports.BigInt64Array = BigInt64ArrayCtor
exports.BigInt64ArrayAvailable = BigInt64ArrayAvailable
/** @ignore */
const [BigUint64ArrayCtor, BigUint64ArrayAvailable] = (() => {
  const BigUint64ArrayUnavailableError = () => {
    throw new Error("BigUint64Array is not available in this environment")
  }
  class BigUint64ArrayUnavailable {
    static get BYTES_PER_ELEMENT() {
      return 8
    }
    static of() {
      throw BigUint64ArrayUnavailableError()
    }
    static from() {
      throw BigUint64ArrayUnavailableError()
    }
    constructor() {
      throw BigUint64ArrayUnavailableError()
    }
  }
  return typeof BigUint64Array !== "undefined"
    ? [BigUint64Array, true]
    : [BigUint64ArrayUnavailable, false]
})()
exports.BigUint64Array = BigUint64ArrayCtor
exports.BigUint64ArrayAvailable = BigUint64ArrayAvailable
/** @ignore */ const isNumber = x => typeof x === "number"
/** @ignore */ const isBoolean = x => typeof x === "boolean"
/** @ignore */ const isFunction = x => typeof x === "function"
/** @ignore */
exports.isObject = x => x != null && Object(x) === x
/** @ignore */
exports.isPromise = x => {
  return exports.isObject(x) && isFunction(x.then)
}
/** @ignore */
exports.isObservable = x => {
  return exports.isObject(x) && isFunction(x.subscribe)
}
/** @ignore */
exports.isIterable = x => {
  return exports.isObject(x) && isFunction(x[Symbol.iterator])
}
/** @ignore */
exports.isAsyncIterable = x => {
  return exports.isObject(x) && isFunction(x[Symbol.asyncIterator])
}
/** @ignore */
exports.isArrowJSON = x => {
  return exports.isObject(x) && exports.isObject(x["schema"])
}
/** @ignore */
exports.isArrayLike = x => {
  return exports.isObject(x) && isNumber(x["length"])
}
/** @ignore */
exports.isIteratorResult = x => {
  return exports.isObject(x) && "done" in x && "value" in x
}
/** @ignore */
exports.isUnderlyingSink = x => {
  return (
    exports.isObject(x) &&
    isFunction(x["abort"]) &&
    isFunction(x["close"]) &&
    isFunction(x["start"]) &&
    isFunction(x["write"])
  )
}
/** @ignore */
exports.isFileHandle = x => {
  return exports.isObject(x) && isFunction(x["stat"]) && isNumber(x["fd"])
}
/** @ignore */
exports.isFSReadStream = x => {
  return exports.isReadableNodeStream(x) && isNumber(x["bytesRead"])
}
/** @ignore */
exports.isFetchResponse = x => {
  return exports.isObject(x) && exports.isReadableDOMStream(x["body"])
}
/** @ignore */
exports.isWritableDOMStream = x => {
  return (
    exports.isObject(x) &&
    isFunction(x["abort"]) &&
    isFunction(x["getWriter"]) &&
    !(x instanceof interfaces_1.ReadableInterop)
  )
}
/** @ignore */
exports.isReadableDOMStream = x => {
  return (
    exports.isObject(x) &&
    isFunction(x["cancel"]) &&
    isFunction(x["getReader"]) &&
    !(x instanceof interfaces_1.ReadableInterop)
  )
}
/** @ignore */
exports.isWritableNodeStream = x => {
  return (
    exports.isObject(x) &&
    isFunction(x["end"]) &&
    isFunction(x["write"]) &&
    isBoolean(x["writable"]) &&
    !(x instanceof interfaces_1.ReadableInterop)
  )
}
/** @ignore */
exports.isReadableNodeStream = x => {
  return (
    exports.isObject(x) &&
    isFunction(x["read"]) &&
    isFunction(x["pipe"]) &&
    isBoolean(x["readable"]) &&
    !(x instanceof interfaces_1.ReadableInterop)
  )
}

//# sourceMappingURL=compat.js.map
