/// <reference types="node" />
import { ArrayBufferViewInput } from "../util/buffer";
import { ReadableDOMStreamOptions } from "./interfaces";
declare const _default: {
  fromIterable<T extends ArrayBufferViewInput>(
    source: T | Iterable<T>
  ): IterableIterator<Uint8Array>;
  fromAsyncIterable<T extends ArrayBufferViewInput>(
    source: AsyncIterable<T> | PromiseLike<T>
  ): AsyncIterableIterator<Uint8Array>;
  fromDOMStream<T extends ArrayBufferViewInput>(
    source: ReadableStream<T>
  ): AsyncIterableIterator<Uint8Array>;
  fromNodeStream(
    stream: NodeJS.ReadableStream
  ): AsyncIterableIterator<Uint8Array>;
  toDOMStream<T>(
    source: Iterable<T> | AsyncIterable<T>,
    options?: ReadableDOMStreamOptions | undefined
  ): ReadableStream<T>;
  toNodeStream<T>(
    source: Iterable<T> | AsyncIterable<T>,
    options?: import("stream").ReadableOptions | undefined
  ): import("stream").Readable;
};
/** @ignore */
export default _default;
