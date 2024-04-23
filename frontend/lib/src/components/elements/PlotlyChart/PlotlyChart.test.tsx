/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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
import React from "react"
import "@testing-library/jest-dom"

import { parseLassoPath, parseBoxSelection } from "./PlotlyChart"

describe("parsePlotlySelections", () => {
  describe("parseLassoPath", () => {
    it("parses a simple lasso path string into x and y coordinates", () => {
      const pathData = "M100,150L200,250L300,350Z"
      const result = parseLassoPath(pathData)
      expect(result).toEqual({
        x: [100, 200, 300],
        y: [150, 250, 350],
      })
    })

    it("does not error with an empty string", () => {
      const result = parseLassoPath("")
      expect(result).toEqual({
        x: [],
        y: [],
      })
    })

    it("handles path with only one point", () => {
      const pathData = "M100,150Z"
      const result = parseLassoPath(pathData)
      expect(result).toEqual({
        x: [100],
        y: [150],
      })
    })
  })

  describe("parseBoxSelection", () => {
    it("parses a box selection into x and y ranges", () => {
      const selection = { x0: 100, y0: 150, x1: 200, y1: 250 }
      const result = parseBoxSelection(selection)
      expect(result).toEqual({
        x: [100, 200],
        y: [150, 250],
      })
    })

    it("returns an object of empty x and y", () => {
      const selection = {}
      const result = parseBoxSelection(selection)
      expect(result).toEqual({
        x: [],
        y: [],
      })
    })
  })
})
