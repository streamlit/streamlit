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

import { isMobile } from "./isMobile"

describe("isMobile", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    {
      label: "a mobile phone",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1",
      expected: true,
    },
    {
      label: "an Android tablet",
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36 Chrome/123.0 Safari/537.36",
      expected: false,
    },
    {
      label: "a desktop browser",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/123.0 Safari/537.36",
      expected: false,
    },
  ])("returns $expected for $label", ({ userAgent, expected }) => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(userAgent)

    expect(isMobile()).toBe(expected)
  })
})
