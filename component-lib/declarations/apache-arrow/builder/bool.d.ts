import { Bool } from "../type";
import { Builder, BuilderOptions } from "../builder";
/** @ignore */
export declare class BoolBuilder<TNull = any> extends Builder<Bool, TNull> {
  constructor(options: BuilderOptions<Bool, TNull>);
  setValue(index: number, value: boolean): void;
}
