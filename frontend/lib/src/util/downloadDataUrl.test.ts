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

import { downloadDataUrl } from "./downloadDataUrl"

describe("downloadDataUrl", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("downloads with a local-time chart filename", () => {
    vi.useFakeTimers()
    // Construct the pinned time via local-time components (not a UTC ISO string)
    // so the expected filename matches regardless of the runner's timezone.
    vi.setSystemTime(new Date(2026, 6, 2, 16, 1, 0))

    let downloadFilename: string | null = null
    let downloadHref: string | null = null
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadFilename = this.download
        downloadHref = this.href
      })

    downloadDataUrl("data:image/png;base64,AAA", "png")

    expect(downloadFilename).toBe("2026-07-02T16-01_chart.png")
    expect(downloadHref).toContain("data:image/png;base64,AAA")
    clickSpy.mockRestore()
  })
})
