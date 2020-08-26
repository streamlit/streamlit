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
import { DictionaryVector } from "../vector/dictionary";
/** @ignore */
export class Value {
  eq(other) {
    if (!(other instanceof Value)) {
      other = new Literal(other);
    }
    return new Equals(this, other);
  }
  le(other) {
    if (!(other instanceof Value)) {
      other = new Literal(other);
    }
    return new LTeq(this, other);
  }
  ge(other) {
    if (!(other instanceof Value)) {
      other = new Literal(other);
    }
    return new GTeq(this, other);
  }
  lt(other) {
    return new Not(this.ge(other));
  }
  gt(other) {
    return new Not(this.le(other));
  }
  ne(other) {
    return new Not(this.eq(other));
  }
}
/** @ignore */
export class Literal extends Value {
  constructor(v) {
    super();
    this.v = v;
  }
}
/** @ignore */
export class Col extends Value {
  constructor(name) {
    super();
    this.name = name;
  }
  bind(batch) {
    if (!this.colidx) {
      // Assume column index doesn't change between calls to bind
      //this.colidx = cols.findIndex(v => v.name.indexOf(this.name) != -1);
      this.colidx = -1;
      const fields = batch.schema.fields;
      for (let idx = -1; ++idx < fields.length; ) {
        if (fields[idx].name === this.name) {
          this.colidx = idx;
          break;
        }
      }
      if (this.colidx < 0) {
        throw new Error(`Failed to bind Col "${this.name}"`);
      }
    }
    const vec = (this.vector = batch.getChildAt(this.colidx));
    return idx => vec.get(idx);
  }
}
/** @ignore */
export class Predicate {
  and(...expr) {
    return new And(this, ...expr);
  }
  or(...expr) {
    return new Or(this, ...expr);
  }
  not() {
    return new Not(this);
  }
}
/** @ignore */
export class ComparisonPredicate extends Predicate {
  constructor(left, right) {
    super();
    this.left = left;
    this.right = right;
  }
  bind(batch) {
    if (this.left instanceof Literal) {
      if (this.right instanceof Literal) {
        return this._bindLitLit(batch, this.left, this.right);
      } else {
        // right is a Col
        return this._bindLitCol(batch, this.left, this.right);
      }
    } else {
      // left is a Col
      if (this.right instanceof Literal) {
        return this._bindColLit(batch, this.left, this.right);
      } else {
        // right is a Col
        return this._bindColCol(batch, this.left, this.right);
      }
    }
  }
}
/** @ignore */
export class CombinationPredicate extends Predicate {
  constructor(...children) {
    super();
    this.children = children;
  }
}
// add children to prototype so it doesn't get mangled in es2015/umd
CombinationPredicate.prototype.children = Object.freeze([]); // freeze for safety
/** @ignore */
export class And extends CombinationPredicate {
  constructor(...children) {
    // Flatten any Ands
    children = children.reduce((accum, p) => {
      return accum.concat(p instanceof And ? p.children : p);
    }, []);
    super(...children);
  }
  bind(batch) {
    const bound = this.children.map(p => p.bind(batch));
    return (idx, batch) => bound.every(p => p(idx, batch));
  }
}
/** @ignore */
export class Or extends CombinationPredicate {
  constructor(...children) {
    // Flatten any Ors
    children = children.reduce((accum, p) => {
      return accum.concat(p instanceof Or ? p.children : p);
    }, []);
    super(...children);
  }
  bind(batch) {
    const bound = this.children.map(p => p.bind(batch));
    return (idx, batch) => bound.some(p => p(idx, batch));
  }
}
/** @ignore */
export class Equals extends ComparisonPredicate {
  _bindLitLit(_batch, left, right) {
    const rtrn = left.v == right.v;
    return () => rtrn;
  }
  _bindColCol(batch, left, right) {
    const left_func = left.bind(batch);
    const right_func = right.bind(batch);
    return (idx, batch) => left_func(idx, batch) == right_func(idx, batch);
  }
  _bindColLit(batch, col, lit) {
    const col_func = col.bind(batch);
    if (col.vector instanceof DictionaryVector) {
      let key;
      const vector = col.vector;
      if (vector.dictionary !== this.lastDictionary) {
        key = vector.reverseLookup(lit.v);
        this.lastDictionary = vector.dictionary;
        this.lastKey = key;
      } else {
        key = this.lastKey;
      }
      if (key === -1) {
        // the value doesn't exist in the dictionary - always return
        // false
        // TODO: special-case of PredicateFunc that encapsulates this
        // "always false" behavior. That way filtering operations don't
        // have to bother checking
        return () => false;
      } else {
        return idx => {
          return vector.getKey(idx) === key;
        };
      }
    } else {
      return (idx, cols) => col_func(idx, cols) == lit.v;
    }
  }
  _bindLitCol(batch, lit, col) {
    // Equals is commutative
    return this._bindColLit(batch, col, lit);
  }
}
/** @ignore */
export class LTeq extends ComparisonPredicate {
  _bindLitLit(_batch, left, right) {
    const rtrn = left.v <= right.v;
    return () => rtrn;
  }
  _bindColCol(batch, left, right) {
    const left_func = left.bind(batch);
    const right_func = right.bind(batch);
    return (idx, cols) => left_func(idx, cols) <= right_func(idx, cols);
  }
  _bindColLit(batch, col, lit) {
    const col_func = col.bind(batch);
    return (idx, cols) => col_func(idx, cols) <= lit.v;
  }
  _bindLitCol(batch, lit, col) {
    const col_func = col.bind(batch);
    return (idx, cols) => lit.v <= col_func(idx, cols);
  }
}
/** @ignore */
export class GTeq extends ComparisonPredicate {
  _bindLitLit(_batch, left, right) {
    const rtrn = left.v >= right.v;
    return () => rtrn;
  }
  _bindColCol(batch, left, right) {
    const left_func = left.bind(batch);
    const right_func = right.bind(batch);
    return (idx, cols) => left_func(idx, cols) >= right_func(idx, cols);
  }
  _bindColLit(batch, col, lit) {
    const col_func = col.bind(batch);
    return (idx, cols) => col_func(idx, cols) >= lit.v;
  }
  _bindLitCol(batch, lit, col) {
    const col_func = col.bind(batch);
    return (idx, cols) => lit.v >= col_func(idx, cols);
  }
}
/** @ignore */
export class Not extends Predicate {
  constructor(child) {
    super();
    this.child = child;
  }
  bind(batch) {
    const func = this.child.bind(batch);
    return (idx, batch) => !func(idx, batch);
  }
}
/** @ignore */
export class CustomPredicate extends Predicate {
  constructor(next, bind_) {
    super();
    this.next = next;
    this.bind_ = bind_;
  }
  bind(batch) {
    this.bind_(batch);
    return this.next;
  }
}
export function lit(v) {
  return new Literal(v);
}
export function col(n) {
  return new Col(n);
}
export function and(...p) {
  return new And(...p);
}
export function or(...p) {
  return new Or(...p);
}
export function custom(next, bind) {
  return new CustomPredicate(next, bind);
}

//# sourceMappingURL=predicate.mjs.map
