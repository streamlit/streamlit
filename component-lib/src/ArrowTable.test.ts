/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { ArrowTable } from "./ArrowTable";
import { EXAMPLE_DF } from "./mock_data";

const range = (startAt = 0, endAt = 0) =>
  Array(endAt - startAt)
    .fill(0)
    .map((_, i) => i + startAt);

describe("ArrowTable", () => {
  const table = new ArrowTable(
    EXAMPLE_DF.data,
    EXAMPLE_DF.index,
    EXAMPLE_DF.columns
  );

  test("basic getters should returns values for basic table", () => {
    expect(table.rows).toEqual(6);
    expect(table.columns).toEqual(4);
    expect(table.headerRows).toEqual(1);
    expect(table.headerColumns).toEqual(1);
    expect(table.dataRows).toEqual(5);
    expect(table.dataColumns).toEqual(3);
    expect(table.uuid).toEqual(undefined);
    expect(table.caption).toEqual(undefined);
    expect(table.styles).toEqual(undefined);
    expect(table.table).toBeDefined();
    expect(table.index).toBeDefined();
    expect(table.columnTable).toBeDefined();
  });

  test.each([
    {
      rowIndex: 0,
      columnIndex: 0,
      expectedResult: {
        classNames: "blank",
        content: "",
        type: "blank",
      },
    },
    {
      rowIndex: 0,
      columnIndex: 1,
      expectedResult: {
        classNames: "col_heading level0 col0",
        content: "First Name",
        type: "columns",
      },
    },
    {
      rowIndex: 1,
      columnIndex: 0,
      expectedResult: {
        classNames: "row_heading level0 row0",
        content: BigInt(0),
        id: "T_undefinedlevel0_row0",
        type: "index",
      },
    },
    {
      rowIndex: 1,
      columnIndex: 1,
      expectedResult: {
        classNames: "data row0 col0",
        content: "Jason",
        id: "T_undefinedrow0_col0",
        type: "data",
      },
    },
    {
      rowIndex: 5,
      columnIndex: 3,
      expectedResult: {
        classNames: "data row4 col2",
        content: BigInt(73),
        id: "T_undefinedrow4_col2",
        type: "data",
      },
    },
  ])(
    "getCell should return cell metadata",
    ({ rowIndex, columnIndex, expectedResult }) => {
      expect(table.getCell(rowIndex, columnIndex)).toEqual(expectedResult);
    }
  );

  test("getCell should return cell content", () => {
    const celContents = range(0, table.rows).map((rowIndex) =>
      range(0, table.columns).map(
        (columnIndex) => table.getCell(rowIndex, columnIndex).content
      )
    );

    expect(celContents).toEqual([
      ["", "First Name", "Last Name", "Age"],
      [BigInt(0), "Jason", "Miller", BigInt(42)],
      [BigInt(1), "Molly", "Jacobson", BigInt(52)],
      [BigInt(2), "Tina", "Ali", BigInt(36)],
      [BigInt(3), "Jake", "Milner", BigInt(24)],
      [BigInt(4), "Amy", "Smith", BigInt(73)],
    ]);
  });

  test("serialize should returns Uint8Array", () => {
    const { data, index, columns } = table.serialize();

    expect(data).toBeInstanceOf(Uint8Array);
    expect(index).toBeInstanceOf(Uint8Array);
    expect(columns).toBeInstanceOf(Uint8Array);

    const new_table = new ArrowTable(data, index, columns);
    expect(new_table.rows).toEqual(6);
    expect(new_table.columns).toEqual(4);
    expect(new_table.headerRows).toEqual(1);
    expect(new_table.headerColumns).toEqual(1);
  });
});
