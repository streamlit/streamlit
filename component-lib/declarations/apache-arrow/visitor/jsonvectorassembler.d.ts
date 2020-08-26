import { Column } from "../column";
import { Visitor } from "../visitor";
import { RecordBatch } from "../recordbatch";
import { VectorType as V } from "../interfaces";
import {
  DataType,
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
export interface JSONVectorAssembler extends Visitor {
  visit<T extends Column>(node: T): object;
  visitMany<T extends Column>(cols: T[]): object[];
  getVisitFn<T extends DataType>(
    node: Column<T>
  ): (
    column: Column<T>
  ) => {
    name: string;
    count: number;
    VALIDITY: (0 | 1)[];
    DATA?: any[];
    OFFSET?: number[];
    TYPE?: number[];
    children?: any[];
  };
  visitNull<T extends Null>(vector: V<T>): {};
  visitBool<T extends Bool>(
    vector: V<T>
  ): {
    DATA: boolean[];
  };
  visitInt<T extends Int>(
    vector: V<T>
  ): {
    DATA: (number | string)[];
  };
  visitFloat<T extends Float>(
    vector: V<T>
  ): {
    DATA: number[];
  };
  visitUtf8<T extends Utf8>(
    vector: V<T>
  ): {
    DATA: string[];
    OFFSET: number[];
  };
  visitBinary<T extends Binary>(
    vector: V<T>
  ): {
    DATA: string[];
    OFFSET: number[];
  };
  visitFixedSizeBinary<T extends FixedSizeBinary>(
    vector: V<T>
  ): {
    DATA: string[];
  };
  visitDate<T extends Date_>(
    vector: V<T>
  ): {
    DATA: number[];
  };
  visitTimestamp<T extends Timestamp>(
    vector: V<T>
  ): {
    DATA: string[];
  };
  visitTime<T extends Time>(
    vector: V<T>
  ): {
    DATA: number[];
  };
  visitDecimal<T extends Decimal>(
    vector: V<T>
  ): {
    DATA: string[];
  };
  visitList<T extends List>(
    vector: V<T>
  ): {
    children: any[];
    OFFSET: number[];
  };
  visitStruct<T extends Struct>(
    vector: V<T>
  ): {
    children: any[];
  };
  visitUnion<T extends Union>(
    vector: V<T>
  ): {
    children: any[];
    TYPE: number[];
  };
  visitInterval<T extends Interval>(
    vector: V<T>
  ): {
    DATA: number[];
  };
  visitFixedSizeList<T extends FixedSizeList>(
    vector: V<T>
  ): {
    children: any[];
  };
  visitMap<T extends Map_>(
    vector: V<T>
  ): {
    children: any[];
  };
}
/** @ignore */
export declare class JSONVectorAssembler extends Visitor {
  /** @nocollapse */
  static assemble<T extends Column | RecordBatch>(
    ...args: (T | T[])[]
  ): object[];
}
