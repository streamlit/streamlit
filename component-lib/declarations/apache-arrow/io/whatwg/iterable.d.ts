import { ReadableDOMStreamOptions } from "../../io/interfaces";
/** @ignore */
export declare function toDOMStream<T>(
  source: Iterable<T> | AsyncIterable<T>,
  options?: ReadableDOMStreamOptions
): ReadableStream<T>;
