/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Table, Type, Vector } from "apache-arrow";
import { StructRow } from "apache-arrow/vector/row";

export type CellType = "blank" | "index" | "columns" | "data";

/** Data types used by ArrowJS. */
export type DataType =
  | null
  | boolean
  | number
  | string
  | Date // datetime
  | Int32Array // int
  | Uint8Array // bytes
  | Vector // arrays
  | StructRow; // interval

export interface ArrowDataframeProto {
  data: ArrowTableProto;
  height: string;
  width: string;
}

export interface ArrowTableProto {
  data: Uint8Array;
  index: Uint8Array;
  columns: Uint8Array;
  styler?: Styler;
}

export interface Cell {
  classNames: string;
  content: DataType;
  id?: string;
  type: CellType;
}

export interface Styler {
  caption?: string;
  displayValuesTable: Table;
  styles?: string;
  uuid: string;
}

export class ArrowTable {
  private readonly dataTable: Table;
  private readonly indexTable: Table;
  private readonly columnsTable: Table;
  private readonly styler?: Styler;

  constructor(
    dataBuffer: Uint8Array,
    indexBuffer: Uint8Array,
    columnsBuffer: Uint8Array,
    styler?: any
  ) {
    this.dataTable = Table.from(dataBuffer);
    this.indexTable = Table.from(indexBuffer);
    this.columnsTable = Table.from(columnsBuffer);
    this.styler = styler
      ? {
          caption: styler.caption,
          displayValuesTable: Table.from(styler.displayValues),
          styles: styler.styles,
          uuid: styler.uuid
        }
      : undefined;
  }

  get rows(): number {
    return this.indexTable.length + this.columnsTable.numCols;
  }

  get columns(): number {
    return this.indexTable.numCols + this.columnsTable.length;
  }

  get headerRows(): number {
    return this.rows - this.dataRows;
  }

  get headerColumns(): number {
    return this.columns - this.dataColumns;
  }

  get dataRows(): number {
    return this.dataTable.length;
  }

  get dataColumns(): number {
    return this.dataTable.numCols;
  }

  get uuid(): string | undefined {
    return this.styler && this.styler.uuid;
  }

  get caption(): string | undefined {
    return this.styler && this.styler.caption;
  }

  get styles(): string | undefined {
    return this.styler && this.styler.styles;
  }

  get table(): Table {
    return this.dataTable;
  }

  get index(): Table {
    return this.indexTable;
  }

  get columnTable(): Table {
    return this.columnsTable;
  }

  public getCell = (rowIndex: number, columnIndex: number): Cell => {
    const isBlankCell =
      rowIndex < this.headerRows && columnIndex < this.headerColumns;
    const isIndexCell =
      rowIndex >= this.headerRows && columnIndex < this.headerColumns;
    const isColumnsCell =
      rowIndex < this.headerRows && columnIndex >= this.headerColumns;

    if (isBlankCell) {
      const classNames = ["blank"];
      if (columnIndex > 0) {
        classNames.push("level" + rowIndex);
      }

      return {
        type: "blank",
        classNames: classNames.join(" "),
        content: ""
      };
    } else if (isColumnsCell) {
      const dataColumnIndex = columnIndex - this.headerColumns;
      const classNames = [
        "col_heading",
        "level" + rowIndex,
        "col" + dataColumnIndex
      ];

      return {
        type: "columns",
        classNames: classNames.join(" "),
        content: this.getContent(this.columnsTable, dataColumnIndex, rowIndex)
      };
    } else if (isIndexCell) {
      const dataRowIndex = rowIndex - this.headerRows;
      const classNames = [
        "row_heading",
        "level" + columnIndex,
        "row" + dataRowIndex
      ];

      return {
        type: "index",
        id: `T_${this.uuid}level${columnIndex}_row${dataRowIndex}`,
        classNames: classNames.join(" "),
        content: this.getContent(this.indexTable, dataRowIndex, columnIndex)
      };
    } else {
      const dataRowIndex = rowIndex - this.headerRows;
      const dataColumnIndex = columnIndex - this.headerColumns;
      const classNames = [
        "data",
        "row" + dataRowIndex,
        "col" + dataColumnIndex
      ];
      const content = this.styler
        ? this.getContent(
            this.styler.displayValuesTable,
            dataRowIndex,
            dataColumnIndex
          )
        : this.getContent(this.dataTable, dataRowIndex, dataColumnIndex);

      return {
        type: "data",
        id: `T_${this.uuid}row${dataRowIndex}_col${dataColumnIndex}`,
        classNames: classNames.join(" "),
        content
      };
    }
  };

  public getContent = (
    table: Table,
    rowIndex: number,
    columnIndex: number
  ): DataType => {
    const column = table.getColumnAt(columnIndex);
    if (column === null) {
      return "";
    }

    const columnTypeId = this.getColumnTypeId(table, columnIndex);
    switch (columnTypeId) {
      case Type.Timestamp: {
        return this.nanosToDate(column.get(rowIndex));
      }
      default: {
        return column.get(rowIndex);
      }
    }
  };

  /**
   * Serialize arrow table.
   */
  public serialize(): ArrowTableProto {
    return {
      data: this.dataTable.serialize(),
      index: this.indexTable.serialize(),
      columns: this.columnsTable.serialize()
    };
  }

  /**
   * Returns apache-arrow specific typeId of column.
   */
  private getColumnTypeId(table: Table, columnIndex: number): Type {
    return table.schema.fields[columnIndex].type.typeId;
  }

  private nanosToDate(nanos: number): Date {
    return new Date(nanos / 1e6);
  }
}
