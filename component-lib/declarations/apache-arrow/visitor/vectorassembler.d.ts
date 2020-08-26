import { Data } from "../data";
import { Vector } from "../vector";
import { Visitor } from "../visitor";
import { Type } from "../enum";
import { RecordBatch } from "../recordbatch";
import { VectorType as V } from "../interfaces";
import { BufferRegion, FieldNode } from "../ipc/metadata/message";
import {
  DataType,
  Dictionary,
  Float,
  Int,
  Date_,
  Interval,
  Time,
  Timestamp,
  Union,
  Bool,
  Null,
  Utf8,
  Binary,
  Decimal,
  FixedSizeBinary,
  List,
  FixedSizeList,
  Map_,
  Struct
} from "../type";
/** @ignore */
export interface VectorAssembler extends Visitor {
  visit<T extends Vector>(node: T): this;
  visitMany<T extends Vector>(nodes: T[]): this[];
  getVisitFn<T extends Type>(node: T): (vector: V<T>) => this;
  getVisitFn<T extends DataType>(
    node: V<T> | Data<T> | T
  ): (vector: V<T>) => this;
  visitBool<T extends Bool>(vector: V<T>): this;
  visitInt<T extends Int>(vector: V<T>): this;
  visitFloat<T extends Float>(vector: V<T>): this;
  visitUtf8<T extends Utf8>(vector: V<T>): this;
  visitBinary<T extends Binary>(vector: V<T>): this;
  visitFixedSizeBinary<T extends FixedSizeBinary>(vector: V<T>): this;
  visitDate<T extends Date_>(vector: V<T>): this;
  visitTimestamp<T extends Timestamp>(vector: V<T>): this;
  visitTime<T extends Time>(vector: V<T>): this;
  visitDecimal<T extends Decimal>(vector: V<T>): this;
  visitList<T extends List>(vector: V<T>): this;
  visitStruct<T extends Struct>(vector: V<T>): this;
  visitUnion<T extends Union>(vector: V<T>): this;
  visitInterval<T extends Interval>(vector: V<T>): this;
  visitFixedSizeList<T extends FixedSizeList>(vector: V<T>): this;
  visitMap<T extends Map_>(vector: V<T>): this;
}
/** @ignore */
export declare class VectorAssembler extends Visitor {
  /** @nocollapse */
  static assemble<T extends Vector | RecordBatch>(
    ...args: (T | T[])[]
  ): VectorAssembler;
  private constructor();
  visitNull<T extends Null>(_nullV: V<T>): this;
  visitDictionary<T extends Dictionary>(vector: V<T>): this;
  readonly nodes: FieldNode[];
  readonly buffers: ArrayBufferView[];
  readonly byteLength: number;
  readonly bufferRegions: BufferRegion[];
  protected _byteLength: number;
  protected _nodes: FieldNode[];
  protected _buffers: ArrayBufferView[];
  protected _bufferRegions: BufferRegion[];
}
