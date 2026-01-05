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

/**
 * Tests for the shared EVENT_DELIM constant used within BidiComponent helpers.
 */

import { describe, expect, it } from "vitest"

import {
  ARROW_REF_KEY,
  EVENT_DELIM,
} from "~lib/components/widgets/BidiComponent/constants"

describe("EVENT_DELIM constant", () => {
  it("should be defined", () => {
    expect(EVENT_DELIM).toBe("__")
  })
})

describe("ARROW_REF_KEY constant", () => {
  it("should be defined and equal '__streamlit_arrow_ref__'", () => {
    expect(ARROW_REF_KEY).toBe("__streamlit_arrow_ref__")
  })
})
