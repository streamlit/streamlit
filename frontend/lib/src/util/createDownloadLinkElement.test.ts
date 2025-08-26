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

import createDownloadLinkElement from "./createDownloadLinkElement"

describe("download attribute", () => {
  const url = "/media/mockDownloadURL"

  it("sets download attribute with empty filename", () => {
    const link = createDownloadLinkElement({
      enforceDownloadInNewTab: false,
      url: url,
      filename: "",
    })
    expect(link.getAttribute("download")).toBe("")
  })

  it("sets download attribute with filename", () => {
    const link = createDownloadLinkElement({
      enforceDownloadInNewTab: false,
      url: url,
      filename: "test.pdf",
    })
    expect(link.getAttribute("download")).toBe("test.pdf")
  })

  it("omits download attribute for service worker compatibility in Chromium browsers", () => {
    // Mock the global streamlit object with DOWNLOAD_ASSETS_BASE_URL
    const originalStreamlit = window.__streamlit
    window.__streamlit = {
      ...window.__streamlit,
      DOWNLOAD_ASSETS_BASE_URL: "https://download.streamlit.app",
    }

    // Mock user agent to be a Chromium-based browser (not Firefox)
    const originalUserAgent = Object.getOwnPropertyDescriptor(
      window.navigator,
      "userAgent"
    )
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      configurable: true,
    })

    try {
      const link = createDownloadLinkElement({
        enforceDownloadInNewTab: false,
        url: "https://download.streamlit.app/file.pdf",
        filename: "test.pdf",
      })
      expect(link.getAttribute("download")).toBeNull()
    } finally {
      // Cleanup
      window.__streamlit = originalStreamlit
      if (originalUserAgent) {
        Object.defineProperty(window.navigator, "userAgent", originalUserAgent)
      }
    }
  })

  it("sets download attribute in Firefox even with DOWNLOAD_ASSETS_BASE_URL", () => {
    // Mock the global streamlit object with DOWNLOAD_ASSETS_BASE_URL
    const originalStreamlit = window.__streamlit
    window.__streamlit = {
      ...window.__streamlit,
      DOWNLOAD_ASSETS_BASE_URL: "https://download.streamlit.app",
    }

    // Mock user agent to be Firefox
    const originalUserAgent = Object.getOwnPropertyDescriptor(
      window.navigator,
      "userAgent"
    )
    Object.defineProperty(window.navigator, "userAgent", {
      value:
        "Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.0",
      configurable: true,
    })

    try {
      const link = createDownloadLinkElement({
        enforceDownloadInNewTab: false,
        url: "https://download.streamlit.app/file.pdf",
        filename: "test.pdf",
      })
      expect(link.getAttribute("download")).toBe("test.pdf")
    } finally {
      // Cleanup
      window.__streamlit = originalStreamlit
      if (originalUserAgent) {
        Object.defineProperty(window.navigator, "userAgent", originalUserAgent)
      }
    }
  })

  it("sets download attribute when URL does not match DOWNLOAD_ASSETS_BASE_URL", () => {
    // Mock the global streamlit object with DOWNLOAD_ASSETS_BASE_URL
    const originalStreamlit = window.__streamlit
    window.__streamlit = {
      ...window.__streamlit,
      DOWNLOAD_ASSETS_BASE_URL: "https://download.streamlit.app",
    }

    try {
      const link = createDownloadLinkElement({
        enforceDownloadInNewTab: false,
        url: "https://different-domain.com/file.pdf",
        filename: "test.pdf",
      })
      expect(link.getAttribute("download")).toBe("test.pdf")
    } finally {
      // Cleanup
      window.__streamlit = originalStreamlit
    }
  })
})
