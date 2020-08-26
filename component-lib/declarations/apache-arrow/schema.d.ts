import { Data } from "./data";
import { Vector } from "./vector";
import { DataType } from "./type";
declare type VectorMap = {
  [key: string]: Vector;
};
declare type Fields<
  T extends {
    [key: string]: DataType;
  }
> = (keyof T)[] | Field<T[keyof T]>[];
declare type ChildData<
  T extends {
    [key: string]: DataType;
  }
> = T[keyof T][] | Data<T[keyof T]>[] | Vector<T[keyof T]>[];
export declare class Schema<
  T extends {
    [key: string]: DataType;
  } = any
> {
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(children: T): Schema<T>;
  static from<T extends VectorMap = any>(
    children: T
  ): Schema<
    {
      [P in keyof T]: T[P]["type"];
    }
  >;
  static from<
    T extends {
      [key: string]: DataType;
    } = any
  >(children: ChildData<T>, fields?: Fields<T>): Schema<T>;
  static new<
    T extends {
      [key: string]: DataType;
    } = any
  >(children: T): Schema<T>;
  static new<T extends VectorMap = any>(
    children: T
  ): Schema<
    {
      [P in keyof T]: T[P]["type"];
    }
  >;
  static new<
    T extends {
      [key: string]: DataType;
    } = any
  >(children: ChildData<T>, fields?: Fields<T>): Schema<T>;
  readonly fields: Field<T[keyof T]>[];
  readonly metadata: Map<string, string>;
  readonly dictionaries: Map<number, DataType>;
  constructor(
    fields?: Field[],
    metadata?: Map<string, string> | null,
    dictionaries?: Map<number, DataType> | null
  );
  readonly [Symbol.toStringTag]: string;
  toString(): string;
  compareTo(other?: Schema | null): other is Schema<T>;
  select<K extends keyof T = any>(
    ...columnNames: K[]
  ): Schema<{ [P in K]: T[P] }>;
  selectAt<K extends T[keyof T] = any>(
    ...columnIndices: number[]
  ): Schema<{
    [key: string]: K;
  }>;
  assign<
    R extends {
      [key: string]: DataType;
    } = any
  >(schema: Schema<R>): Schema<T & R>;
  assign<
    R extends {
      [key: string]: DataType;
    } = any
  >(...fields: (Field<R[keyof R]> | Field<R[keyof R]>[])[]): Schema<T & R>;
}
export declare class Field<T extends DataType = any> {
  static new<T extends DataType = any>(props: {
    name: string | number;
    type: T;
    nullable?: boolean;
    metadata?: Map<string, string> | null;
  }): Field<T>;
  static new<T extends DataType = any>(
    name: string | number | Field<T>,
    type: T,
    nullable?: boolean,
    metadata?: Map<string, string> | null
  ): Field<T>;
  readonly type: T;
  readonly name: string;
  readonly nullable: boolean;
  readonly metadata: Map<string, string>;
  constructor(
    name: string,
    type: T,
    nullable?: boolean,
    metadata?: Map<string, string> | null
  );
  readonly typeId: import("./enum").Type;
  readonly [Symbol.toStringTag]: string;
  toString(): string;
  compareTo(other?: Field | null): other is Field<T>;
  clone<R extends DataType = T>(props: {
    name?: string | number;
    type?: R;
    nullable?: boolean;
    metadata?: Map<string, string> | null;
  }): Field<R>;
  clone<R extends DataType = T>(
    name?: string | number | Field<T>,
    type?: R,
    nullable?: boolean,
    metadata?: Map<string, string> | null
  ): Field<R>;
}
export {};
