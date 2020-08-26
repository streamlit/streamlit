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
const data_1 = require("../data");
const schema_1 = require("../schema");
const column_1 = require("../column");
const vector_1 = require("../vector");
const type_1 = require("../type");
const chunked_1 = require("../vector/chunked");
const isArray = Array.isArray;
/** @ignore */
exports.selectArgs = (Ctor, vals) => _selectArgs(Ctor, vals, [], 0);
/** @ignore */
exports.selectColumnArgs = args => {
  const [fields, values] = _selectFieldArgs(args, [[], []]);
  return values.map((x, i) =>
    x instanceof column_1.Column
      ? column_1.Column.new(x.field.clone(fields[i]), x)
      : x instanceof vector_1.Vector
      ? column_1.Column.new(fields[i], x)
      : column_1.Column.new(fields[i], [])
  );
};
/** @ignore */
exports.selectFieldArgs = args => _selectFieldArgs(args, [[], []]);
/** @ignore */
exports.selectChunkArgs = (Ctor, vals) => _selectChunkArgs(Ctor, vals, [], 0);
/** @ignore */
exports.selectVectorChildrenArgs = (Ctor, vals) =>
  _selectVectorChildrenArgs(Ctor, vals, [], 0);
/** @ignore */
exports.selectColumnChildrenArgs = (Ctor, vals) =>
  _selectColumnChildrenArgs(Ctor, vals, [], 0);
/** @ignore */
function _selectArgs(Ctor, vals, res, idx) {
  let value,
    j = idx;
  let i = -1,
    n = vals.length;
  while (++i < n) {
    if (isArray((value = vals[i]))) {
      j = _selectArgs(Ctor, value, res, j).length;
    } else if (value instanceof Ctor) {
      res[j++] = value;
    }
  }
  return res;
}
/** @ignore */
function _selectChunkArgs(Ctor, vals, res, idx) {
  let value,
    j = idx;
  let i = -1,
    n = vals.length;
  while (++i < n) {
    if (isArray((value = vals[i]))) {
      j = _selectChunkArgs(Ctor, value, res, j).length;
    } else if (value instanceof chunked_1.Chunked) {
      j = _selectChunkArgs(Ctor, value.chunks, res, j).length;
    } else if (value instanceof Ctor) {
      res[j++] = value;
    }
  }
  return res;
}
/** @ignore */
function _selectVectorChildrenArgs(Ctor, vals, res, idx) {
  let value,
    j = idx;
  let i = -1,
    n = vals.length;
  while (++i < n) {
    if (isArray((value = vals[i]))) {
      j = _selectVectorChildrenArgs(Ctor, value, res, j).length;
    } else if (value instanceof Ctor) {
      j = _selectArgs(
        vector_1.Vector,
        value.schema.fields.map((_, i) => value.getChildAt(i)),
        res,
        j
      ).length;
    } else if (value instanceof vector_1.Vector) {
      res[j++] = value;
    }
  }
  return res;
}
/** @ignore */
function _selectColumnChildrenArgs(Ctor, vals, res, idx) {
  let value,
    j = idx;
  let i = -1,
    n = vals.length;
  while (++i < n) {
    if (isArray((value = vals[i]))) {
      j = _selectColumnChildrenArgs(Ctor, value, res, j).length;
    } else if (value instanceof Ctor) {
      j = _selectArgs(
        column_1.Column,
        value.schema.fields.map((f, i) =>
          column_1.Column.new(f, value.getChildAt(i))
        ),
        res,
        j
      ).length;
    } else if (value instanceof column_1.Column) {
      res[j++] = value;
    }
  }
  return res;
}
/** @ignore */
const toKeysAndValues = (xs, [k, v], i) => (
  (xs[0][i] = k), (xs[1][i] = v), xs
);
/** @ignore */
function _selectFieldArgs(vals, ret) {
  let keys, n;
  switch ((n = vals.length)) {
    case 0:
      return ret;
    case 1:
      keys = ret[0];
      if (!vals[0]) {
        return ret;
      }
      if (isArray(vals[0])) {
        return _selectFieldArgs(vals[0], ret);
      }
      if (
        !(
          vals[0] instanceof data_1.Data ||
          vals[0] instanceof vector_1.Vector ||
          vals[0] instanceof type_1.DataType
        )
      ) {
        [keys, vals] = Object.entries(vals[0]).reduce(toKeysAndValues, ret);
      }
      break;
    default:
      !isArray((keys = vals[n - 1]))
        ? ((vals = isArray(vals[0]) ? vals[0] : vals), (keys = []))
        : (vals = isArray(vals[0]) ? vals[0] : vals.slice(0, n - 1));
  }
  let fieldIndex = -1;
  let valueIndex = -1;
  let idx = -1,
    len = vals.length;
  let field;
  let val;
  let [fields, values] = ret;
  while (++idx < len) {
    val = vals[idx];
    if (val instanceof column_1.Column && (values[++valueIndex] = val)) {
      fields[++fieldIndex] = val.field.clone(keys[idx], val.type, true);
    } else {
      ({ [idx]: field = idx } = keys);
      if (val instanceof type_1.DataType && (values[++valueIndex] = val)) {
        fields[++fieldIndex] = schema_1.Field.new(field, val, true);
      } else if (val && val.type && (values[++valueIndex] = val)) {
        val instanceof data_1.Data &&
          (values[valueIndex] = val = vector_1.Vector.new(val));
        fields[++fieldIndex] = schema_1.Field.new(field, val.type, true);
      }
    }
  }
  return ret;
}

//# sourceMappingURL=args.js.map
