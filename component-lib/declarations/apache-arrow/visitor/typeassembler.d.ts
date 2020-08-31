import { flatbuffers } from "flatbuffers";
import Builder = flatbuffers.Builder;
import * as type from "../type";
import { Visitor } from "../visitor";
/** @ignore */
export interface TypeAssembler extends Visitor {
  visit<T extends type.DataType>(
    node: T,
    builder: Builder
  ): number | undefined;
}
/** @ignore */
export declare class TypeAssembler extends Visitor {
  visitNull<T extends type.Null>(_node: T, b: Builder): number;
  visitInt<T extends type.Int>(node: T, b: Builder): number;
  visitFloat<T extends type.Float>(node: T, b: Builder): number;
  visitBinary<T extends type.Binary>(_node: T, b: Builder): number;
  visitBool<T extends type.Bool>(_node: T, b: Builder): number;
  visitUtf8<T extends type.Utf8>(_node: T, b: Builder): number;
  visitDecimal<T extends type.Decimal>(node: T, b: Builder): number;
  visitDate<T extends type.Date_>(node: T, b: Builder): number;
  visitTime<T extends type.Time>(node: T, b: Builder): number;
  visitTimestamp<T extends type.Timestamp>(node: T, b: Builder): number;
  visitInterval<T extends type.Interval>(node: T, b: Builder): number;
  visitList<T extends type.List>(_node: T, b: Builder): number;
  visitStruct<T extends type.Struct>(_node: T, b: Builder): number;
  visitUnion<T extends type.Union>(node: T, b: Builder): number;
  visitDictionary<T extends type.Dictionary>(node: T, b: Builder): number;
  visitFixedSizeBinary<T extends type.FixedSizeBinary>(
    node: T,
    b: Builder
  ): number;
  visitFixedSizeList<T extends type.FixedSizeList>(
    node: T,
    b: Builder
  ): number;
  visitMap<T extends type.Map_>(node: T, b: Builder): number;
}
/** @ignore */
export declare const instance: TypeAssembler;
