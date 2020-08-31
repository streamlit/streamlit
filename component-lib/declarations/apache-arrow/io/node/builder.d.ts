/// <reference types="node" />
import { Duplex } from "stream";
import { DataType } from "../../type";
import { Builder, BuilderOptions } from "../../builder/index";
/** @ignore */
export interface BuilderDuplexOptions<T extends DataType = any, TNull = any>
  extends BuilderOptions<T, TNull> {
  autoDestroy?: boolean;
  highWaterMark?: number;
  queueingStrategy?: "bytes" | "count";
  dictionaryHashFunction?: (value: any) => string | number;
  valueToChildTypeId?: (
    builder: Builder<T, TNull>,
    value: any,
    offset: number
  ) => number;
}
/** @ignore */
export declare function builderThroughNodeStream<
  T extends DataType = any,
  TNull = any
>(options: BuilderDuplexOptions<T, TNull>): BuilderDuplex<any, TNull>;
/** @ignore */
declare type CB = (error?: Error | null | undefined) => void;
/** @ignore */
declare class BuilderDuplex<
  T extends DataType = any,
  TNull = any
> extends Duplex {
  private _finished;
  private _numChunks;
  private _desiredSize;
  private _builder;
  private _getSize;
  constructor(
    builder: Builder<T, TNull>,
    options: BuilderDuplexOptions<T, TNull>
  );
  _read(size: number): void;
  _final(cb?: CB): void;
  _write(value: any, _: string, cb?: CB): boolean;
  _destroy(err: Error | null, cb?: (error: Error | null) => void): void;
  private _maybeFlush;
}
export {};
