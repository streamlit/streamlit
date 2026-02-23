/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { shuffle } from "lodash-es"

import {
  containsFilterSelectOptions,
  exactFilterSelectOptions,
  fuzzyFilterSelectOptions,
  startsWithFilterSelectOptions,
} from "~lib/util/fuzzyFilterSelectOptions"

describe("fuzzyFilterSelectOptions", () => {
  it("fuzzy filters options correctly", () => {
    // This test just makes sure the filter algorithm works correctly. The e2e
    // test actually types something in the selectbox and makes sure that it
    // shows the right options.

    const options = [
      { label: "e2e/scripts/components_iframe.py", value: "" },
      { label: "e2e/scripts/st_warning.py", value: "" },
      { label: "e2e/scripts/st_container.py", value: "" },
      { label: "e2e/scripts/st_dataframe_sort_column.py", value: "" },
      { label: "e2e/scripts/app_hotkeys.py", value: "" },
      { label: "e2e/scripts/st_info.py", value: "" },
      { label: "e2e/scripts/st_echo.py", value: "" },
      { label: "e2e/scripts/st_json.py", value: "" },
      { label: "e2e/scripts/st_query_params.py", value: "" },
      { label: "e2e/scripts/st_markdown.py", value: "" },
      { label: "e2e/scripts/st_color_picker.py", value: "" },
      { label: "e2e/scripts/st_expander.py", value: "" },
    ]

    const results1 = fuzzyFilterSelectOptions(options, "esstm")
    expect(results1.map(it => it.label)).toEqual([
      "e2e/scripts/st_markdown.py",
      "e2e/scripts/st_query_params.py",
      "e2e/scripts/st_dataframe_sort_column.py",
      "e2e/scripts/components_iframe.py",
    ])

    const results2 = fuzzyFilterSelectOptions(options, "esqu")
    expect(results2.map(it => it.label)).toEqual([
      "e2e/scripts/st_query_params.py",
    ])
  })

  it("prioritizes matches well with case insensitivity", () => {
    const options = [
      { label: "Streamlit", value: "" },
      { label: "Another streamlit", value: "" },
      { label: "Yet another streamlit", value: "" },
      { label: "Some estreamlit", value: "" },
      { label: "mistreamlit", value: "" },
    ]

    const results1 = fuzzyFilterSelectOptions(options, "stre")
    expect(results1.map(it => it.label)).toEqual([
      "Streamlit",
      "Another streamlit",
      "Yet another streamlit",
      "mistreamlit",
      "Some estreamlit",
    ])

    // Randomize options to ensure order is not hiding an issue
    const randomizedOptions = shuffle(options)
    const results2 = fuzzyFilterSelectOptions(randomizedOptions, "stre")
    expect(results2.map(it => it.label)).toEqual([
      "Streamlit",
      "Another streamlit",
      "Yet another streamlit",
      "mistreamlit",
      "Some estreamlit",
    ])
  })
})

const SIMPLE_OPTIONS = [
  { label: "Apple", value: "apple" },
  { label: "Banana", value: "banana" },
  { label: "Pineapple", value: "pineapple" },
  { label: "Grape", value: "grape" },
  { label: "Apricot", value: "apricot" },
]

describe("exactFilterSelectOptions", () => {
  it("returns all options when pattern is empty", () => {
    expect(exactFilterSelectOptions(SIMPLE_OPTIONS, "")).toEqual(
      SIMPLE_OPTIONS
    )
  })

  it("matches only exact label (case-insensitive)", () => {
    const results = exactFilterSelectOptions(SIMPLE_OPTIONS, "apple")
    expect(results.map(it => it.label)).toEqual(["Apple"])
  })

  it("is case-insensitive", () => {
    const results = exactFilterSelectOptions(SIMPLE_OPTIONS, "BANANA")
    expect(results.map(it => it.label)).toEqual(["Banana"])
  })

  it("returns empty for partial matches", () => {
    const results = exactFilterSelectOptions(SIMPLE_OPTIONS, "app")
    expect(results).toEqual([])
  })

  it("returns empty when no match exists", () => {
    const results = exactFilterSelectOptions(SIMPLE_OPTIONS, "mango")
    expect(results).toEqual([])
  })
})

describe("containsFilterSelectOptions", () => {
  it("returns all options when pattern is empty", () => {
    expect(containsFilterSelectOptions(SIMPLE_OPTIONS, "")).toEqual(
      SIMPLE_OPTIONS
    )
  })

  it("matches options containing the substring", () => {
    const results = containsFilterSelectOptions(SIMPLE_OPTIONS, "apple")
    expect(results.map(it => it.label)).toEqual(["Apple", "Pineapple"])
  })

  it("is case-insensitive", () => {
    const results = containsFilterSelectOptions(SIMPLE_OPTIONS, "GRAPE")
    expect(results.map(it => it.label)).toEqual(["Grape"])
  })

  it("matches substring in the middle", () => {
    const results = containsFilterSelectOptions(SIMPLE_OPTIONS, "ana")
    expect(results.map(it => it.label)).toEqual(["Banana"])
  })

  it("preserves original order", () => {
    const results = containsFilterSelectOptions(SIMPLE_OPTIONS, "ap")
    expect(results.map(it => it.label)).toEqual([
      "Apple",
      "Pineapple",
      "Grape",
      "Apricot",
    ])
  })

  it("returns empty when no match exists", () => {
    const results = containsFilterSelectOptions(SIMPLE_OPTIONS, "mango")
    expect(results).toEqual([])
  })
})

describe("startsWithFilterSelectOptions", () => {
  it("returns all options when pattern is empty", () => {
    expect(startsWithFilterSelectOptions(SIMPLE_OPTIONS, "")).toEqual(
      SIMPLE_OPTIONS
    )
  })

  it("matches options starting with the pattern", () => {
    const results = startsWithFilterSelectOptions(SIMPLE_OPTIONS, "ap")
    expect(results.map(it => it.label)).toEqual(["Apple", "Apricot"])
  })

  it("is case-insensitive", () => {
    const results = startsWithFilterSelectOptions(SIMPLE_OPTIONS, "BAN")
    expect(results.map(it => it.label)).toEqual(["Banana"])
  })

  it("does not match mid-string occurrences", () => {
    const results = startsWithFilterSelectOptions(SIMPLE_OPTIONS, "apple")
    expect(results.map(it => it.label)).toEqual(["Apple"])
    // "Pineapple" should NOT match (contains "apple" but doesn't start with it)
  })

  it("returns empty when no match exists", () => {
    const results = startsWithFilterSelectOptions(SIMPLE_OPTIONS, "mango")
    expect(results).toEqual([])
  })
})
