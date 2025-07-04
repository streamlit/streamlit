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
import { Quiver } from "~lib/dataframes/Quiver"

import { getDataArray } from "./arrowUtils"

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
