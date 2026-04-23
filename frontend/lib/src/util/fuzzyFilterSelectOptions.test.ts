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

import { streamlit } from "@streamlit/protobuf"

import {
  filterSelectOptions,
  fuzzyFilterSelectOptions,
  getSelectFilterMode,
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

  it("filters by case-insensitive substring in contains mode", () => {
    const options = [
      { label: "alice@example.com", value: "" },
      { label: "bob@company.com", value: "" },
      { label: "carol@example.com", value: "" },
    ]

    const results = filterSelectOptions(
      options,
      "EXAMPLE",
      streamlit.SelectWidgetFilterMode.FILTER_MODE_CONTAINS
    )

    expect(results.map(it => it.label)).toEqual([
      "alice@example.com",
      "carol@example.com",
    ])
  })

  it("filters by case-insensitive prefix in prefix mode", () => {
    const options = [
      { label: "A123", value: "" },
      { label: "A1234", value: "" },
      { label: "BA123", value: "" },
    ]

    const results = filterSelectOptions(
      options,
      "a123",
      streamlit.SelectWidgetFilterMode.FILTER_MODE_PREFIX
    )

    expect(results.map(it => it.label)).toEqual(["A123", "A1234"])
  })

  it("returns all options unchanged when filtering is disabled", () => {
    const options = [
      { label: "Alpha", value: "" },
      { label: "Beta", value: "" },
    ]

    const results = filterSelectOptions(
      options,
      "be",
      streamlit.SelectWidgetFilterMode.FILTER_MODE_NONE
    )

    expect(results.map(it => it.label)).toEqual(["Alpha", "Beta"])
  })

  it("falls back to fuzzy mode when the proto value is missing", () => {
    expect(getSelectFilterMode(undefined)).toBe(
      streamlit.SelectWidgetFilterMode.FILTER_MODE_FUZZY
    )
    expect(
      getSelectFilterMode(
        streamlit.SelectWidgetFilterMode.FILTER_MODE_CONTAINS
      )
    ).toBe(streamlit.SelectWidgetFilterMode.FILTER_MODE_CONTAINS)
  })
})
