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
import { ReadableInterop } from "../io/interfaces"
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
export { BigIntCtor as BigInt, BigIntAvailable }
export { BigInt64ArrayCtor as BigInt64Array, BigInt64ArrayAvailable }
export { BigUint64ArrayCtor as BigUint64Array, BigUint64ArrayAvailable }
/** @ignore */ const isNumber = x => typeof x === "number"
/** @ignore */ const isBoolean = x => typeof x === "boolean"
/** @ignore */ const isFunction = x => typeof x === "function"
/** @ignore */
export const isObject = x => x != null && Object(x) === x
/** @ignore */
export const isPromise = x => {
  return isObject(x) && isFunction(x.then)
}
/** @ignore */
export const isObservable = x => {
  return isObject(x) && isFunction(x.subscribe)
}
/** @ignore */
export const isIterable = x => {
  return isObject(x) && isFunction(x[Symbol.iterator])
}
/** @ignore */
export const isAsyncIterable = x => {
  return isObject(x) && isFunction(x[Symbol.asyncIterator])
}
/** @ignore */
export const isArrowJSON = x => {
  return isObject(x) && isObject(x["schema"])
}
/** @ignore */
export const isArrayLike = x => {
  return isObject(x) && isNumber(x["length"])
}
/** @ignore */
export const isIteratorResult = x => {
  return isObject(x) && "done" in x && "value" in x
}
/** @ignore */
export const isUnderlyingSink = x => {
  return (
    isObject(x) &&
    isFunction(x["abort"]) &&
    isFunction(x["close"]) &&
    isFunction(x["start"]) &&
    isFunction(x["write"])
  )
}
/** @ignore */
export const isFileHandle = x => {
  return isObject(x) && isFunction(x["stat"]) && isNumber(x["fd"])
}
/** @ignore */
export const isFSReadStream = x => {
  return isReadableNodeStream(x) && isNumber(x["bytesRead"])
}
/** @ignore */
export const isFetchResponse = x => {
  return isObject(x) && isReadableDOMStream(x["body"])
}
/** @ignore */
export const isWritableDOMStream = x => {
  return (
    isObject(x) &&
    isFunction(x["abort"]) &&
    isFunction(x["getWriter"]) &&
    !(x instanceof ReadableInterop)
  )
}
/** @ignore */
export const isReadableDOMStream = x => {
  return (
    isObject(x) &&
    isFunction(x["cancel"]) &&
    isFunction(x["getReader"]) &&
    !(x instanceof ReadableInterop)
  )
}
/** @ignore */
export const isWritableNodeStream = x => {
  return (
    isObject(x) &&
    isFunction(x["end"]) &&
    isFunction(x["write"]) &&
    isBoolean(x["writable"]) &&
    !(x instanceof ReadableInterop)
  )
}
/** @ignore */
export const isReadableNodeStream = x => {
  return (
    isObject(x) &&
    isFunction(x["read"]) &&
    isFunction(x["pipe"]) &&
    isBoolean(x["readable"]) &&
    !(x instanceof ReadableInterop)
  )
}

//# sourceMappingURL=compat.mjs.map
