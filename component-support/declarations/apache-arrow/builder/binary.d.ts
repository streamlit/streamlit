import { Binary } from "../type";
import { VariableWidthBuilder, BuilderOptions } from "../builder";
/** @ignore */
export declare class BinaryBuilder<TNull = any> extends VariableWidthBuilder<
  Binary,
  TNull
> {
  constructor(opts: BuilderOptions<Binary, TNull>);
  readonly byteLength: number;
  setValue(index: number, value: Uint8Array): void;
  protected _flushPending(
    pending: Map<number, Uint8Array | undefined>,
    pendingLength: number
  ): void;
}
