/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { extractCssProperty } from "./DataFrameCells"

test("extractCssProperty should extract the correct property value", () => {
  const cssStyle1 = `
  #T_f116e_row10_col0, #T_f116e_row10_col1, #T_f116e_row10_col3 { color: red }
  #T_f116e_row0_col1, #T_f116e_row1_col0 { color: white; background-color: pink }
  #T_f116e_row0_col2 { color: red; opacity: 20% }
  #T_f116e_row2_col2, #T_f116e_row5_col1 { opacity: 20% }
  #T_f116e_row3_col3, #T_f116e_row12_col1 { color: white; background-color: darkblue; color: white; background-color: pink }`

  const cssStyle2 = `
  #T_7e5cc_row6_col0 { background-color: #f8fcc9; color: #000000 }
  #T_7e5cc_row7_col1 { background-color: #1c2d81; color: #f1f1f1 }
  #T_7e5cc_row8_col0 { background-color: #289cc1; color: #f1f1f1 }
  #T_7e5cc_row8_col1 { background-color: #2165ab; color: #f1f1f1 }
  #T_7e5cc_row9_col0 { background-color: #f0f9b8; color: #000000 }`

  // Badly Formatted
  const cssStyle3 = `
  #T_f116e_row10_col0,#T_7e5cc_row6_col0   {   background-color: #f8fcc9;     color: #000000 }
  #T_7e5cc_row7_col1{ background-color:#1c2d81; color: #f1f1f1 }
  #T_7e5cc_row8_col0{background-color: #289cc1;color: #f1f1f1}`

  expect(extractCssProperty("#T_f116e_row10_col1", "color", cssStyle1)).toBe(
    "red"
  )
  expect(
    extractCssProperty("#T_f116e_row12_col1", "background-color", cssStyle1)
  ).toBe("pink")
  expect(extractCssProperty("#T_f116e_row5_col1", "color", cssStyle1)).toBe(
    undefined
  )
  expect(extractCssProperty("foo", "color", cssStyle1)).toBe(undefined)
  expect(extractCssProperty("#T_f116e_row0_col2", "color", cssStyle1)).toBe(
    "red"
  )

  expect(
    extractCssProperty("#T_7e5cc_row6_col0", "background-color", cssStyle2)
  ).toBe("#f8fcc9")
  expect(extractCssProperty("#T_7e5cc_row9_col0", "color", cssStyle2)).toBe(
    "#000000"
  )

  expect(
    extractCssProperty("#T_f116e_row10_col0", "background-color", cssStyle3)
  ).toBe("#f8fcc9")
  expect(
    extractCssProperty("#T_7e5cc_row8_col0", "background-color", cssStyle3)
  ).toBe("#289cc1")
  expect(extractCssProperty("#T_7e5cc_row8_col0", "color", cssStyle3)).toBe(
    "#f1f1f1"
  )
})
