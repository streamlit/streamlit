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
import { valueToString } from "../util/pretty";
/** @ignore */ const kParent = Symbol.for("parent");
/** @ignore */ const kRowIndex = Symbol.for("rowIndex");
/** @ignore */ const kKeyToIdx = Symbol.for("keyToIdx");
/** @ignore */ const kIdxToVal = Symbol.for("idxToVal");
/** @ignore */ const kCustomInspect = Symbol.for("nodejs.util.inspect.custom");
class Row {
  constructor(parent, numKeys) {
    this[kParent] = parent;
    this.size = numKeys;
  }
  entries() {
    return this[Symbol.iterator]();
  }
  has(key) {
    return this.get(key) !== undefined;
  }
  get(key) {
    let val = undefined;
    if (key !== null && key !== undefined) {
      const ktoi = this[kKeyToIdx] || (this[kKeyToIdx] = new Map());
      let idx = ktoi.get(key);
      if (idx !== undefined) {
        const itov =
          this[kIdxToVal] || (this[kIdxToVal] = new Array(this.size));
        (val = itov[idx]) !== undefined ||
          (itov[idx] = val = this.getValue(idx));
      } else if ((idx = this.getIndex(key)) > -1) {
        ktoi.set(key, idx);
        const itov =
          this[kIdxToVal] || (this[kIdxToVal] = new Array(this.size));
        (val = itov[idx]) !== undefined ||
          (itov[idx] = val = this.getValue(idx));
      }
    }
    return val;
  }
  set(key, val) {
    if (key !== null && key !== undefined) {
      const ktoi = this[kKeyToIdx] || (this[kKeyToIdx] = new Map());
      let idx = ktoi.get(key);
      if (idx === undefined) {
        ktoi.set(key, (idx = this.getIndex(key)));
      }
      if (idx > -1) {
        const itov =
          this[kIdxToVal] || (this[kIdxToVal] = new Array(this.size));
        itov[idx] = this.setValue(idx, val);
      }
    }
    return this;
  }
  clear() {
    throw new Error(`Clearing ${this[Symbol.toStringTag]} not supported.`);
  }
  delete(_) {
    throw new Error(
      `Deleting ${this[Symbol.toStringTag]} values not supported.`
    );
  }
  *[Symbol.iterator]() {
    const ki = this.keys();
    const vi = this.values();
    const ktoi = this[kKeyToIdx] || (this[kKeyToIdx] = new Map());
    const itov = this[kIdxToVal] || (this[kIdxToVal] = new Array(this.size));
    for (
      let k, v, i = 0, kr, vr;
      !((kr = ki.next()).done || (vr = vi.next()).done);
      ++i
    ) {
      k = kr.value;
      v = vr.value;
      itov[i] = v;
      ktoi.has(k) || ktoi.set(k, i);
      yield [k, v];
    }
  }
  forEach(callbackfn, thisArg) {
    const ki = this.keys();
    const vi = this.values();
    const callback =
      thisArg === undefined
        ? callbackfn
        : (v, k, m) => callbackfn.call(thisArg, v, k, m);
    const ktoi = this[kKeyToIdx] || (this[kKeyToIdx] = new Map());
    const itov = this[kIdxToVal] || (this[kIdxToVal] = new Array(this.size));
    for (
      let k, v, i = 0, kr, vr;
      !((kr = ki.next()).done || (vr = vi.next()).done);
      ++i
    ) {
      k = kr.value;
      v = vr.value;
      itov[i] = v;
      ktoi.has(k) || ktoi.set(k, i);
      callback(v, k, this);
    }
  }
  toArray() {
    return [...this.values()];
  }
  toJSON() {
    const obj = {};
    this.forEach((val, key) => (obj[key] = val));
    return obj;
  }
  inspect() {
    return this.toString();
  }
  [kCustomInspect]() {
    return this.toString();
  }
  toString() {
    const str = [];
    this.forEach((val, key) => {
      key = valueToString(key);
      val = valueToString(val);
      str.push(`${key}: ${val}`);
    });
    return `{ ${str.join(", ")} }`;
  }
}
Row[Symbol.toStringTag] = (proto => {
  Object.defineProperties(proto, {
    size: { writable: true, enumerable: false, configurable: false, value: 0 },
    [kParent]: {
      writable: true,
      enumerable: false,
      configurable: false,
      value: null
    },
    [kRowIndex]: {
      writable: true,
      enumerable: false,
      configurable: false,
      value: -1
    }
  });
  return (proto[Symbol.toStringTag] = "Row");
})(Row.prototype);
export class MapRow extends Row {
  constructor(slice) {
    super(slice, slice.length);
    return createRowProxy(this);
  }
  keys() {
    return this[kParent].getChildAt(0)[Symbol.iterator]();
  }
  values() {
    return this[kParent].getChildAt(1)[Symbol.iterator]();
  }
  getKey(idx) {
    return this[kParent].getChildAt(0).get(idx);
  }
  getIndex(key) {
    return this[kParent].getChildAt(0).indexOf(key);
  }
  getValue(index) {
    return this[kParent].getChildAt(1).get(index);
  }
  setValue(index, value) {
    this[kParent].getChildAt(1).set(index, value);
  }
}
export class StructRow extends Row {
  constructor(parent) {
    super(parent, parent.type.children.length);
    return defineRowProxyProperties(this);
  }
  *keys() {
    for (const field of this[kParent].type.children) {
      yield field.name;
    }
  }
  *values() {
    for (const field of this[kParent].type.children) {
      yield this[field.name];
    }
  }
  getKey(idx) {
    return this[kParent].type.children[idx].name;
  }
  getIndex(key) {
    return this[kParent].type.children.findIndex(f => f.name === key);
  }
  getValue(index) {
    return this[kParent].getChildAt(index).get(this[kRowIndex]);
  }
  setValue(index, value) {
    return this[kParent].getChildAt(index).set(this[kRowIndex], value);
  }
}
Object.setPrototypeOf(Row.prototype, Map.prototype);
/** @ignore */
const defineRowProxyProperties = (() => {
  const desc = { enumerable: true, configurable: false, get: null, set: null };
  return row => {
    let idx = -1,
      ktoi = row[kKeyToIdx] || (row[kKeyToIdx] = new Map());
    const getter = key =>
      function() {
        return this.get(key);
      };
    const setter = key =>
      function(val) {
        return this.set(key, val);
      };
    for (const key of row.keys()) {
      ktoi.set(key, ++idx);
      desc.get = getter(key);
      desc.set = setter(key);
      row.hasOwnProperty(key) ||
        ((desc.enumerable = true), Object.defineProperty(row, key, desc));
      row.hasOwnProperty(idx) ||
        ((desc.enumerable = false), Object.defineProperty(row, idx, desc));
    }
    desc.get = desc.set = null;
    return row;
  };
})();
/** @ignore */
const createRowProxy = (() => {
  if (typeof Proxy === "undefined") {
    return defineRowProxyProperties;
  }
  const has = Row.prototype.has;
  const get = Row.prototype.get;
  const set = Row.prototype.set;
  const getKey = Row.prototype.getKey;
  const RowProxyHandler = {
    isExtensible() {
      return false;
    },
    deleteProperty() {
      return false;
    },
    preventExtensions() {
      return true;
    },
    ownKeys(row) {
      return [...row.keys()].map(x => `${x}`);
    },
    has(row, key) {
      switch (key) {
        case "getKey":
        case "getIndex":
        case "getValue":
        case "setValue":
        case "toArray":
        case "toJSON":
        case "inspect":
        case "constructor":
        case "isPrototypeOf":
        case "propertyIsEnumerable":
        case "toString":
        case "toLocaleString":
        case "valueOf":
        case "size":
        case "has":
        case "get":
        case "set":
        case "clear":
        case "delete":
        case "keys":
        case "values":
        case "entries":
        case "forEach":
        case "__proto__":
        case "__defineGetter__":
        case "__defineSetter__":
        case "hasOwnProperty":
        case "__lookupGetter__":
        case "__lookupSetter__":
        case Symbol.iterator:
        case Symbol.toStringTag:
        case kParent:
        case kRowIndex:
        case kIdxToVal:
        case kKeyToIdx:
        case kCustomInspect:
          return true;
      }
      if (typeof key === "number" && !row.has(key)) {
        key = row.getKey(key);
      }
      return row.has(key);
    },
    get(row, key, receiver) {
      switch (key) {
        case "getKey":
        case "getIndex":
        case "getValue":
        case "setValue":
        case "toArray":
        case "toJSON":
        case "inspect":
        case "constructor":
        case "isPrototypeOf":
        case "propertyIsEnumerable":
        case "toString":
        case "toLocaleString":
        case "valueOf":
        case "size":
        case "has":
        case "get":
        case "set":
        case "clear":
        case "delete":
        case "keys":
        case "values":
        case "entries":
        case "forEach":
        case "__proto__":
        case "__defineGetter__":
        case "__defineSetter__":
        case "hasOwnProperty":
        case "__lookupGetter__":
        case "__lookupSetter__":
        case Symbol.iterator:
        case Symbol.toStringTag:
        case kParent:
        case kRowIndex:
        case kIdxToVal:
        case kKeyToIdx:
        case kCustomInspect:
          return Reflect.get(row, key, receiver);
      }
      if (typeof key === "number" && !has.call(receiver, key)) {
        key = getKey.call(receiver, key);
      }
      return get.call(receiver, key);
    },
    set(row, key, val, receiver) {
      switch (key) {
        case kParent:
        case kRowIndex:
        case kIdxToVal:
        case kKeyToIdx:
          return Reflect.set(row, key, val, receiver);
        case "getKey":
        case "getIndex":
        case "getValue":
        case "setValue":
        case "toArray":
        case "toJSON":
        case "inspect":
        case "constructor":
        case "isPrototypeOf":
        case "propertyIsEnumerable":
        case "toString":
        case "toLocaleString":
        case "valueOf":
        case "size":
        case "has":
        case "get":
        case "set":
        case "clear":
        case "delete":
        case "keys":
        case "values":
        case "entries":
        case "forEach":
        case "__proto__":
        case "__defineGetter__":
        case "__defineSetter__":
        case "hasOwnProperty":
        case "__lookupGetter__":
        case "__lookupSetter__":
        case Symbol.iterator:
        case Symbol.toStringTag:
          return false;
      }
      if (typeof key === "number" && !has.call(receiver, key)) {
        key = getKey.call(receiver, key);
      }
      return has.call(receiver, key) ? !!set.call(receiver, key, val) : false;
    }
  };
  return row => new Proxy(row, RowProxyHandler);
})();

//# sourceMappingURL=row.mjs.map
