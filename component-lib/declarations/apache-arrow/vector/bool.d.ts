import { Bool } from "../type";
import { Chunked } from "./chunked";
import { BaseVector } from "./base";
import { VectorBuilderOptions } from "./index";
import { VectorBuilderOptionsAsync } from "./index";
/** @ignore */
export declare class BoolVector extends BaseVector<Bool> {
  static from<TNull = any>(input: Iterable<boolean | TNull>): BoolVector;
  static from<TNull = any>(
    input: AsyncIterable<boolean | TNull>
  ): Promise<BoolVector>;
  static from<TNull = any>(
    input: VectorBuilderOptions<Bool, TNull>
  ): Chunked<Bool>;
  static from<TNull = any>(
    input: VectorBuilderOptionsAsync<Bool, TNull>
  ): Promise<Chunked<Bool>>;
}
