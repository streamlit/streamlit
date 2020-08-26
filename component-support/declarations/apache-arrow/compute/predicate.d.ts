import { Vector } from "../vector";
import { RecordBatch } from "../recordbatch";
/** @ignore */
export declare type ValueFunc<T> = (
  idx: number,
  cols: RecordBatch
) => T | null;
/** @ignore */
export declare type PredicateFunc = (
  idx: number,
  cols: RecordBatch
) => boolean;
/** @ignore */
export declare abstract class Value<T> {
  eq(other: Value<T> | T): Predicate;
  le(other: Value<T> | T): Predicate;
  ge(other: Value<T> | T): Predicate;
  lt(other: Value<T> | T): Predicate;
  gt(other: Value<T> | T): Predicate;
  ne(other: Value<T> | T): Predicate;
}
/** @ignore */
export declare class Literal<T = any> extends Value<T> {
  v: T;
  constructor(v: T);
}
/** @ignore */
export declare class Col<T = any> extends Value<T> {
  name: string;
  vector: Vector;
  colidx: number;
  constructor(name: string);
  bind(batch: RecordBatch): (idx: number, batch?: RecordBatch) => any;
}
/** @ignore */
export declare abstract class Predicate {
  abstract bind(batch: RecordBatch): PredicateFunc;
  and(...expr: Predicate[]): And;
  or(...expr: Predicate[]): Or;
  not(): Predicate;
}
/** @ignore */
export declare abstract class ComparisonPredicate<T = any> extends Predicate {
  readonly left: Value<T>;
  readonly right: Value<T>;
  constructor(left: Value<T>, right: Value<T>);
  bind(batch: RecordBatch): PredicateFunc;
  protected abstract _bindLitLit(
    batch: RecordBatch,
    left: Literal,
    right: Literal
  ): PredicateFunc;
  protected abstract _bindColCol(
    batch: RecordBatch,
    left: Col,
    right: Col
  ): PredicateFunc;
  protected abstract _bindColLit(
    batch: RecordBatch,
    col: Col,
    lit: Literal
  ): PredicateFunc;
  protected abstract _bindLitCol(
    batch: RecordBatch,
    lit: Literal,
    col: Col
  ): PredicateFunc;
}
/** @ignore */
export declare abstract class CombinationPredicate extends Predicate {
  readonly children: Predicate[];
  constructor(...children: Predicate[]);
}
/** @ignore */
export declare class And extends CombinationPredicate {
  constructor(...children: Predicate[]);
  bind(batch: RecordBatch): (idx: number, batch: RecordBatch<any>) => boolean;
}
/** @ignore */
export declare class Or extends CombinationPredicate {
  constructor(...children: Predicate[]);
  bind(batch: RecordBatch): (idx: number, batch: RecordBatch<any>) => boolean;
}
/** @ignore */
export declare class Equals extends ComparisonPredicate {
  private lastDictionary;
  private lastKey;
  protected _bindLitLit(
    _batch: RecordBatch,
    left: Literal,
    right: Literal
  ): PredicateFunc;
  protected _bindColCol(
    batch: RecordBatch,
    left: Col,
    right: Col
  ): PredicateFunc;
  protected _bindColLit(
    batch: RecordBatch,
    col: Col,
    lit: Literal
  ): PredicateFunc;
  protected _bindLitCol(
    batch: RecordBatch,
    lit: Literal,
    col: Col
  ): PredicateFunc;
}
/** @ignore */
export declare class LTeq extends ComparisonPredicate {
  protected _bindLitLit(
    _batch: RecordBatch,
    left: Literal,
    right: Literal
  ): PredicateFunc;
  protected _bindColCol(
    batch: RecordBatch,
    left: Col,
    right: Col
  ): PredicateFunc;
  protected _bindColLit(
    batch: RecordBatch,
    col: Col,
    lit: Literal
  ): PredicateFunc;
  protected _bindLitCol(
    batch: RecordBatch,
    lit: Literal,
    col: Col
  ): (idx: number, cols: RecordBatch<any>) => boolean;
}
/** @ignore */
export declare class GTeq extends ComparisonPredicate {
  protected _bindLitLit(
    _batch: RecordBatch,
    left: Literal,
    right: Literal
  ): PredicateFunc;
  protected _bindColCol(
    batch: RecordBatch,
    left: Col,
    right: Col
  ): PredicateFunc;
  protected _bindColLit(
    batch: RecordBatch,
    col: Col,
    lit: Literal
  ): PredicateFunc;
  protected _bindLitCol(
    batch: RecordBatch,
    lit: Literal,
    col: Col
  ): (idx: number, cols: RecordBatch<any>) => boolean;
}
/** @ignore */
export declare class Not extends Predicate {
  readonly child: Predicate;
  constructor(child: Predicate);
  bind(batch: RecordBatch): (idx: number, batch: RecordBatch<any>) => boolean;
}
/** @ignore */
export declare class CustomPredicate extends Predicate {
  private next;
  private bind_;
  constructor(next: PredicateFunc, bind_: (batch: RecordBatch) => void);
  bind(batch: RecordBatch): PredicateFunc;
}
export declare function lit(v: any): Value<any>;
export declare function col(n: string): Col<any>;
export declare function and(...p: Predicate[]): And;
export declare function or(...p: Predicate[]): Or;
export declare function custom(
  next: PredicateFunc,
  bind: (batch: RecordBatch) => void
): CustomPredicate;
