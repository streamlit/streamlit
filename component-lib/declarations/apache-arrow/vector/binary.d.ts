import { BaseVector } from "./base";
import { Binary } from "../type";
/** @ignore */
export declare class BinaryVector extends BaseVector<Binary> {
  asUtf8(): import("./utf8").Utf8Vector;
}
