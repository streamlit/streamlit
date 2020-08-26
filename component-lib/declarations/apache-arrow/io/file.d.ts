import { FileHandle } from "./interfaces";
import { ByteStream, AsyncByteStream } from "./stream";
import { ArrayBufferViewInput } from "../util/buffer";
/** @ignore */
export declare class RandomAccessFile extends ByteStream {
  size: number;
  position: number;
  protected buffer: Uint8Array | null;
  constructor(buffer: ArrayBufferViewInput, byteLength?: number);
  readInt32(position: number): number;
  seek(position: number): boolean;
  read(nBytes?: number | null): Uint8Array | null;
  readAt(position: number, nBytes: number): Uint8Array;
  close(): void;
  throw(
    value?: any
  ): {
    done: boolean;
    value: any;
  };
  return(
    value?: any
  ): {
    done: boolean;
    value: any;
  };
}
/** @ignore */
export declare class AsyncRandomAccessFile extends AsyncByteStream {
  size: number;
  position: number;
  _pending?: Promise<void>;
  protected _handle: FileHandle | null;
  constructor(file: FileHandle, byteLength?: number);
  readInt32(position: number): Promise<number>;
  seek(position: number): Promise<boolean>;
  read(nBytes?: number | null): Promise<Uint8Array | null>;
  readAt(position: number, nBytes: number): Promise<Uint8Array>;
  close(): Promise<void>;
  throw(
    value?: any
  ): Promise<{
    done: boolean;
    value: any;
  }>;
  return(
    value?: any
  ): Promise<{
    done: boolean;
    value: any;
  }>;
}
