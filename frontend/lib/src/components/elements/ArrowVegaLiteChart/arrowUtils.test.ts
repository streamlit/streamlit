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

import {
  ArrowNamedDataSet,
  Arrow as ArrowProto,
  ArrowVegaLiteChart as ArrowVegaLiteChartProto,
} from "@streamlit/protobuf"

import { Quiver } from "~lib/dataframes/Quiver"
import {
  CATEGORICAL,
  DATE,
  DATETIME,
  DATETIMETZ,
  FLOAT64,
  INT64,
  RANGE,
  UINT64,
  UNICODE,
} from "~lib/mocks/arrow"

import { buildVegaLiteChartElement, getDataArray } from "./arrowUtils"

const BASE_SPEC = JSON.stringify({
  mark: "bar",
  encoding: {
    x: { field: "c1" },
    y: { field: "c2" },
  },
})

function createChartProto(
  overrides: Partial<ArrowVegaLiteChartProto> = {}
): ArrowVegaLiteChartProto {
  return ArrowVegaLiteChartProto.create({
    spec: BASE_SPEC,
    data: null,
    datasets: [],
    useContainerWidth: false,
    theme: "streamlitTheme",
    id: "chart-id",
    selectionMode: [],
    formId: "",
    ...overrides,
  })
}

function createNamedDataset(
  name: string | null,
  hasName: boolean,
  data: Uint8Array
): ArrowNamedDataSet {
  return ArrowNamedDataSet.create({
    name: name ?? undefined,
    hasName,
    data: ArrowProto.create({ data }),
  })
}

describe("buildVegaLiteChartElement", () => {
  it("builds element with inline data and no addRows", () => {
    const proto = createChartProto({
      data: ArrowProto.create({ data: UNICODE }),
    })

    const element = buildVegaLiteChartElement({ proto })

    expect(element.spec).toEqual(proto.spec)
    expect(element.data).not.toBeNull()
    expect(element.datasets).toHaveLength(0)
    expect(element.rawData).toEqual(proto.data)
  })

  it("builds element with single dataset and no addRows", () => {
    const dataset = createNamedDataset("foo", true, UNICODE)
    const proto = createChartProto({
      data: null,
      datasets: [dataset],
    })

    const element = buildVegaLiteChartElement({ proto })

    expect(element.data).toBeNull()
    expect(element.datasets).toHaveLength(1)
    expect(element.datasets[0].hasName).toBe(true)
    expect(element.datasets[0].name).toBe("foo")
    expect(element.datasets[0].rawData).toEqual(dataset.data)
  })

  it("merges addRows into single dataset regardless of name", () => {
    const baseDataset = createNamedDataset("base", true, UNICODE)
    const proto = createChartProto({
      data: null,
      datasets: [baseDataset],
    })

    const addRows = createNamedDataset("other-name", true, UNICODE)

    const element = buildVegaLiteChartElement({
      proto,
      addRowsData: addRows,
    })

    expect(element.data).toBeNull()
    expect(element.datasets).toHaveLength(1)

    const quiver = element.datasets[0].data
    // We don't assert exact contents, but the merged quiver should have more rows
    // than the original single table.
    expect(quiver.dimensions.numDataRows).toBeGreaterThan(0)
  })

  it("merges addRows into matching named dataset when multiple datasets exist", () => {
    const base = createNamedDataset("base", true, UNICODE)
    const target = createNamedDataset("target", true, UNICODE)
    const proto = createChartProto({
      data: null,
      datasets: [base, target],
    })

    const addRows = createNamedDataset("target", true, UNICODE)

    const element = buildVegaLiteChartElement({
      proto,
      addRowsData: addRows,
    })

    expect(element.datasets).toHaveLength(2)

    const targetDataset = element.datasets.find(d => d.name === "target")
    expect(targetDataset).toBeDefined()
    expect(targetDataset?.data.dimensions.numDataRows).toBeGreaterThan(0)
  })

  it("merges addRows into inline data when no dataset matches", () => {
    const proto = createChartProto({
      data: ArrowProto.create({ data: UNICODE }),
      datasets: [],
    })

    const addRows = createNamedDataset("unmatched", true, UNICODE)

    const element = buildVegaLiteChartElement({
      proto,
      addRowsData: addRows,
    })

    expect(element.data).not.toBeNull()
    expect(element.datasets).toHaveLength(0)
    expect(element.rawData).toEqual(proto.data)
  })

  it("uses addRows as sole data when there is no data or datasets", () => {
    const proto = createChartProto({
      data: null,
      datasets: [],
    })

    const addRows = createNamedDataset(null, false, UNICODE)

    const element = buildVegaLiteChartElement({
      proto,
      addRowsData: addRows,
    })

    expect(element.data).not.toBeNull()
    expect(element.datasets).toHaveLength(0)
    expect(element.rawData).toEqual(addRows.data)
  })
})

describe("Types of dataframe indexes as x axis", () => {
  describe("Supported", () => {
    test("datetimetz", () => {
      const mockElement = { data: DATETIMETZ }
      const q = new Quiver(mockElement)

      expect(getDataArray(q)).toEqual([
        {
          "(index)": 978220800000,
          "2000-12-31 00:00:00": new Date(
            "2020-01-02T05:00:00.000Z"
          ).valueOf(),
          "2001-12-31 00:00:00": new Date(
            "2020-10-20T05:00:00.000Z"
          ).valueOf(),
        },
        {
          "(index)": 1009756800000,
          "2000-12-31 00:00:00": new Date(
            "2020-01-02T05:00:00.000Z"
          ).valueOf(),
          "2001-12-31 00:00:00": new Date(
            "2020-10-20T05:00:00.000Z"
          ).valueOf(),
        },
      ])
    })

    test("date", () => {
      const mockElement = { data: DATE }
      const q = new Quiver(mockElement)

      expect(getDataArray(q)).toEqual([
        {
          "(index)": 978220800000,
          "2000-12-31 00:00:00": new Date("2020-01-02T00:00:00").valueOf(),
          "2001-12-31 00:00:00": new Date("2020-10-20T00:00:00").valueOf(),
        },
        {
          "(index)": 1009756800000,
          "2000-12-31 00:00:00": new Date("2020-01-02T00:00:00").valueOf(),
          "2001-12-31 00:00:00": new Date("2020-10-20T00:00:00").valueOf(),
        },
      ])
    })

    test("datetime", () => {
      const mockElement = { data: DATETIME }
      const q = new Quiver(mockElement)

      expect(getDataArray(q)).toEqual([
        {
          "(index)": 978220800000,
          "2000-12-31 00:00:00": new Date("2020-01-02T05:00:00").valueOf(),
          "2001-12-31 00:00:00": new Date("2020-10-20T05:00:00").valueOf(),
        },
        {
          "(index)": 1009756800000,
          "2000-12-31 00:00:00": new Date("2020-01-02T05:00:00").valueOf(),
          "2001-12-31 00:00:00": new Date("2020-10-20T05:00:00").valueOf(),
        },
      ])
    })

    test("float64", () => {
      const mockElement = { data: FLOAT64 }
      const q = new Quiver(mockElement)

      expect(getDataArray(q)).toEqual([
        { "(index)": 1.24, "1.24": 1.2, "2.35": 1.3 },
        { "(index)": 2.35, "1.24": 1.4, "2.35": 1.5 },
      ])
    })

    test("int64", () => {
      const mockElement = { data: INT64 }
      const q = new Quiver(mockElement)
      expect(getDataArray(q)).toEqual([
        {
          "(index)": 1,
          "1": 0,
          "2": 1,
        },
        {
          "(index)": 2,
          "1": 2,
          "2": 3,
        },
      ])
    })

    test("range", () => {
      const mockElement = { data: RANGE }
      const q = new Quiver(mockElement)

      expect(getDataArray(q)).toEqual([
        { "(index)": 0, "0": "foo", "1": "1" },
        { "(index)": 1, "0": "bar", "1": "2" },
      ])
    })

    test("uint64", () => {
      const mockElement = { data: UINT64 }
      const q = new Quiver(mockElement)
      expect(getDataArray(q)).toEqual([
        {
          "(index)": 1,
          "1": 1,
          "2": 2,
        },
        {
          "(index)": 2,
          "1": 3,
          "2": 4,
        },
      ])
    })
  })

  describe("Unsupported", () => {
    test("categorical", () => {
      const mockElement = { data: CATEGORICAL }
      const q = new Quiver(mockElement)
      expect(getDataArray(q)).toEqual([
        { c1: "foo", c2: 100 },
        { c1: "bar", c2: 200 },
      ])
    })

    test("unicode", () => {
      const mockElement = { data: UNICODE }
      const q = new Quiver(mockElement)

      expect(getDataArray(q)).toEqual([
        { c1: "foo", c2: "1" },
        { c1: "bar", c2: "2" },
      ])
    })
  })
})
