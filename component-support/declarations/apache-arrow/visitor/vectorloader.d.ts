import { Data } from "../data";
import * as type from "../type";
import { Field } from "../schema";
import { Vector } from "../vector";
import { DataType } from "../type";
import { Visitor } from "../visitor";
import { BufferRegion, FieldNode } from "../ipc/metadata/message";
/** @ignore */
export interface VectorLoader extends Visitor {
  visit<T extends DataType>(node: Field<T> | T): Data<T>;
  visitMany<T extends DataType>(nodes: (Field<T> | T)[]): Data<T>[];
}
/** @ignore */
export declare class VectorLoader extends Visitor {
  private bytes;
  private nodes;
  private nodesIndex;
  private buffers;
  private buffersIndex;
  private dictionaries;
  constructor(
    bytes: Uint8Array,
    nodes: FieldNode[],
    buffers: BufferRegion[],
    dictionaries: Map<number, Vector<any>>
  );
  visitNull<T extends type.Null>(type: T, { length }?: FieldNode): Data<T>;
  visitBool<T extends type.Bool>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitInt<T extends type.Int>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitFloat<T extends type.Float>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitUtf8<T extends type.Utf8>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitBinary<T extends type.Binary>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitFixedSizeBinary<T extends type.FixedSizeBinary>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitDate<T extends type.Date_>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitTimestamp<T extends type.Timestamp>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitTime<T extends type.Time>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitDecimal<T extends type.Decimal>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitList<T extends type.List>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitStruct<T extends type.Struct>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitUnion<T extends type.Union>(
    type: T
  ): Data<type.DenseUnion> | Data<type.SparseUnion>;
  visitDenseUnion<T extends type.DenseUnion>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitSparseUnion<T extends type.SparseUnion>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitDictionary<T extends type.Dictionary>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitInterval<T extends type.Interval>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitFixedSizeList<T extends type.FixedSizeList>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  visitMap<T extends type.Map_>(
    type: T,
    { length, nullCount }?: FieldNode
  ): Data<T>;
  protected nextFieldNode(): FieldNode;
  protected nextBufferRange(): BufferRegion;
  protected readNullBitmap<T extends DataType>(
    type: T,
    nullCount: number,
    buffer?: BufferRegion
  ): Uint8Array;
  protected readOffsets<T extends DataType>(
    type: T,
    buffer?: BufferRegion
  ): Uint8Array;
  protected readTypeIds<T extends DataType>(
    type: T,
    buffer?: BufferRegion
  ): Uint8Array;
  protected readData<T extends DataType>(
    _type: T,
    { length, offset }?: BufferRegion
  ): Uint8Array;
  protected readDictionary<T extends type.Dictionary>(
    type: T
  ): Vector<T["dictionary"]>;
}
/** @ignore */
export declare class JSONVectorLoader extends VectorLoader {
  private sources;
  constructor(
    sources: any[][],
    nodes: FieldNode[],
    buffers: BufferRegion[],
    dictionaries: Map<number, Vector<any>>
  );
  protected readNullBitmap<T extends DataType>(
    _type: T,
    nullCount: number,
    { offset }?: BufferRegion
  ): Uint8Array;
  protected readOffsets<T extends DataType>(
    _type: T,
    { offset }?: BufferRegion
  ): Uint8Array;
  protected readTypeIds<T extends DataType>(
    type: T,
    { offset }?: BufferRegion
  ): Uint8Array;
  protected readData<T extends DataType>(
    type: T,
    { offset }?: BufferRegion
  ): Uint8Array;
}
