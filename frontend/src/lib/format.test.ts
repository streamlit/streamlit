/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

import * as format from "./format"

test("class Duration constructor", () => {
  const duration = new format.Duration(1234)
  expect(duration.getTime()).toBe(1234)
})

test("class toFormattedString function with exponential notation", () => {
  expect(format.toFormattedString(4.2e-9)).toBe("0.0000")
  expect(format.toFormattedString(4.2657457627118644e-9)).toBe("0.0000")
})
