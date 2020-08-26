import { Null } from "../type";
import { Builder } from "../builder";
/** @ignore */
export declare class NullBuilder<TNull = any> extends Builder<Null, TNull> {
  setValue(index: number, value: null): void;
  setValid(index: number, valid: boolean): boolean;
}
