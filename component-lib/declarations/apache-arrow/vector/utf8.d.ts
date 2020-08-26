import { Chunked } from "./chunked";
import { BaseVector } from "./base";
import { Utf8 } from "../type";
import { VectorBuilderOptions } from "./index";
import { VectorBuilderOptionsAsync } from "./index";
/** @ignore */
export declare class Utf8Vector extends BaseVector<Utf8> {
  static from<TNull = any>(input: Iterable<string | TNull>): Utf8Vector;
  static from<TNull = any>(
    input: AsyncIterable<string | TNull>
  ): Promise<Utf8Vector>;
  static from<TNull = any>(
    input: VectorBuilderOptions<Utf8, TNull>
  ): Chunked<Utf8>;
  static from<TNull = any>(
    input: VectorBuilderOptionsAsync<Utf8, TNull>
  ): Promise<Chunked<Utf8>>;
  asBinary(): import("./binary").BinaryVector;
}
