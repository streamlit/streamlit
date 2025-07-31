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

import { getCrossOriginAttribute, isValidOrigin } from "./UriUtil"

describe("isValidOrigin", () => {
  it("returns false if allowedOrigin is invalid", () => {
    // allowedOrigin doesn't have a protocol
    expect(
      isValidOrigin("devel.streamlit.io", "http://devel.streamlit.io")
    ).toBe(false)
  })

  it("returns false if testOrigin is invalid", () => {
    // testOrigin doesn't have a protocol
    expect(
      isValidOrigin("http://devel.streamlit.io", "devel.streamlit.io")
    ).toBe(false)
  })

  it("returns true if testUrl's hostname is localhost w/ various ports", () => {
    expect(
      isValidOrigin(
        "http://localhost",
        // Example of localhost url used for manual testing
        "http://localhost:8000"
      )
    ).toBe(true)

    expect(
      isValidOrigin(
        "http://localhost",
        // Example of localhost url used by e2e test
        "http://localhost:35475"
      )
    ).toBe(true)
  })

  it("returns false if testUrl's hostname is localhost but protocol doesn't match", () => {
    expect(isValidOrigin("http://localhost", "https://localhost")).toBe(false)

    expect(
      isValidOrigin("https://localhost:8000", "http://localhost:8000")
    ).toBe(false)

    expect(
      isValidOrigin(
        "https:localhost",
        // Example of localhost url used for manual testing
        "http://localhost:8000"
      )
    ).toBe(false)

    expect(
      isValidOrigin(
        "http://localhost",
        // Example of localhost url used by e2e test
        "https://localhost:35475"
      )
    ).toBe(false)
  })

  it("returns false if protocols don't match", () => {
    expect(
      isValidOrigin("https://devel.streamlit.io", "http://devel.streamlit.io")
    ).toBe(false)
  })

  it("returns false if ports don't match", () => {
    expect(
      isValidOrigin(
        "https://devel.streamlit.io:8080",
        "https://devel.streamlit.io"
      )
    ).toBe(false)
  })

  it("returns true when the pattern and url are the same", () => {
    expect(
      isValidOrigin("http://devel.streamlit.io", "http://devel.streamlit.io")
    ).toBe(true)
  })

  it("returns true when the pattern and url are the same for localhost", () => {
    expect(
      isValidOrigin("http://localhost:3000", "http://localhost:3000")
    ).toBe(true)
  })

  it("should recognize wildcards in Firefox", () => {
    // In Firefox, the URL constructor crashes on URLs containing `*`,
    // for example `new URL("https://*.streamlit.app"). This used to not
    // allow to receive messages from Cloud Community apps. Make sure this
    // issue is fixed.
    const OrigURL = globalThis.URL
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      globalThis.URL = function (url: string, ...rest: any[]) {
        if (url.includes("*")) {
          throw new Error("Invalid URL")
        }
        return new OrigURL(url, ...rest)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      } as any
      expect(
        isValidOrigin(
          "https://*.streamlit.app",
          "https://example.streamlit.app"
        )
      ).toBe(true)
    } finally {
      globalThis.URL = OrigURL
    }
  })

  describe("pattern matching", () => {
    it("handles the '*.' pattern", () => {
      expect(isValidOrigin("https://*.com", "https://a.com")).toBe(true)
      expect(isValidOrigin("https://*.a.com", "https://asd.a.com")).toBe(true)
      expect(
        isValidOrigin("https://www.*.a.com", "https://www.asd.a.com")
      ).toBe(true)
      expect(
        isValidOrigin("https://abc.*.*.a.com", "https://abc.def.xyz.a.com")
      ).toBe(true)
      expect(
        isValidOrigin("https://*.com", "https://example.example.com")
      ).toBe(true)

      expect(isValidOrigin("https://*.b.com", "https://www.c.com")).toBe(false)
    })

    it("handles the '{*.}?' pattern", () => {
      expect(
        isValidOrigin("https://{*.}?example.com", "https://cdn.example.com")
      ).toBe(true)
      expect(
        isValidOrigin("https://{*.}?example.com", "https://example.com")
      ).toBe(true)

      expect(
        isValidOrigin("https://{*.}?example.com", "https://www-example.com")
      ).toBe(false)
    })

    it("handles the '{cdn.}?' pattern", () => {
      expect(
        isValidOrigin("https://{cdn.}?example.com", "https://cdn.example.com")
      ).toBe(true)
      expect(
        isValidOrigin("https://{cdn.}?example.com", "https://example.com")
      ).toBe(true)

      expect(
        isValidOrigin("https://{cdn.}?example.com", "https://www.example.com")
      ).toBe(false)
      expect(
        isValidOrigin("https://{cdn.}?example.com", "https://cdn-example.com")
      ).toBe(false)
    })

    it("handles the '{www.cdn.}?' pattern", () => {
      expect(
        isValidOrigin(
          "https://{www.cdn.}?example.com",
          "https://www.cdn.example.com"
        )
      ).toBe(true)
      expect(
        isValidOrigin("https://{www.cdn.}?example.com", "https://example.com")
      ).toBe(true)

      expect(
        isValidOrigin(
          "https://{www.cdn.}?example.com",
          "https://cdn.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin(
          "https://{www.cdn.}?example.com",
          "https://www.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin(
          "https://{www.cdn.}?example.com",
          "https://www.cdn-example.com"
        )
      ).toBe(false)
    })

    it("handles the 'cdn-*' pattern", () => {
      expect(
        isValidOrigin(
          "https://cdn-*.example.com",
          "https://cdn-123.example.com"
        )
      ).toBe(true)
      expect(
        isValidOrigin("https://cdn-*.example.com", "https://cdn-.example.com")
      ).toBe(true)

      expect(
        isValidOrigin(
          "https://cdn-*.example.com",
          "https://cdn.123.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin("https://cdn-*.example.com", "https://cdn.example.com")
      ).toBe(false)
    })

    it("handles the ':id' pattern", () => {
      expect(
        isValidOrigin(
          "https://cdn-:id.example.com",
          "https://cdn-123.example.com"
        )
      ).toBe(true)

      expect(
        isValidOrigin(
          "https://cdn-:id.example.com",
          "https://cdn-.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin(
          "https://cdn-:id.example.com",
          "https://cdn.123.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin("https://cdn-:id.example.com", "https://cdn.example.com")
      ).toBe(false)
    })

    it("handles regex patterns", () => {
      expect(
        isValidOrigin(
          "https://(cdn|www).example.com",
          "https://cdn.example.com"
        )
      ).toBe(true)
      expect(
        isValidOrigin(
          "https://(cdn|www).example.com",
          "https://www.example.com"
        )
      ).toBe(true)
      expect(isValidOrigin("https://(\\w+).com", "https://example.com")).toBe(
        true
      )

      expect(
        isValidOrigin(
          "https://(cdn|www).example.com",
          "https://dev.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin(
          "https://(cdn|www).example.com",
          "https://ww.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin(
          "https://(cdn|www).example.com",
          "https://cdn.123.example.com"
        )
      ).toBe(false)
      expect(
        isValidOrigin("https://(\\w+).com", "https://example.example.com")
      ).toBe(false)
    })

    it("handles patterns in the protocol part", () => {
      expect(
        isValidOrigin("https://example.com:*", "https://example.com")
      ).toBe(true)
      expect(
        isValidOrigin("https://example.com:*", "https://example.com:8080")
      ).toBe(true)
      expect(
        isValidOrigin("https://example.com:80*", "https://example.com:8080")
      ).toBe(true)
      expect(
        isValidOrigin("https://example.com:80*", "https://example.com:8091")
      ).toBe(true)
      expect(
        isValidOrigin("https://example.com:80*", "https://example.com:80")
      ).toBe(true)

      expect(
        isValidOrigin("https://example.com:*", "https://example.www.com:8080")
      ).toBe(false)
      expect(
        isValidOrigin("https://example.com:80*", "https://example.com:3000")
      ).toBe(false)
      expect(
        isValidOrigin("https://example.com:80*", "https://example.com:91")
      ).toBe(false)
    })
  })
})

describe("getCrossOriginAttribute", () => {
  let originalStreamlit: typeof window.__streamlit

  beforeEach(() => {
    // Save the original window.__streamlit
    originalStreamlit = window.__streamlit
  })

  afterEach(() => {
    // Restore the original window.__streamlit
    window.__streamlit = originalStreamlit
  })

  describe("when no URL is provided", () => {
    it("returns undefined regardless of resourceCrossOriginMode", () => {
      expect(getCrossOriginAttribute("anonymous")).toBe(undefined)
      expect(getCrossOriginAttribute("use-credentials")).toBe(undefined)
      expect(getCrossOriginAttribute(undefined)).toBe(undefined)
    })
  })

  describe("when URL is an absolute URL", () => {
    describe("when window.__streamlit.BACKEND_BASE_URL is set", () => {
      beforeEach(() => {
        window.__streamlit = {
          BACKEND_BASE_URL: "https://backend.example.com",
        } as typeof window.__streamlit
      })

      it("returns resourceCrossOriginMode when URL has same origin as BACKEND_BASE_URL", () => {
        expect(
          getCrossOriginAttribute(
            "anonymous",
            "https://backend.example.com/image.png"
          )
        ).toBe("anonymous")
        expect(
          getCrossOriginAttribute(
            "use-credentials",
            "https://backend.example.com/api/data"
          )
        ).toBe("use-credentials")
        expect(
          getCrossOriginAttribute(
            undefined,
            "https://backend.example.com/resource"
          )
        ).toBe(undefined)
      })

      it("returns undefined when URL has different origin than BACKEND_BASE_URL", () => {
        expect(
          getCrossOriginAttribute(
            "anonymous",
            "https://different.example.com/image.png"
          )
        ).toBe(undefined)
        expect(
          getCrossOriginAttribute(
            "use-credentials",
            "https://backend.different.com/api/data"
          )
        ).toBe(undefined)
        expect(
          getCrossOriginAttribute("anonymous", "https://example.com/resource")
        ).toBe(undefined)
      })

      it("handles URLs with different ports correctly", () => {
        expect(
          getCrossOriginAttribute(
            "anonymous",
            "https://backend.example.com:8080/image.png"
          )
        ).toBe(undefined)

        // Same port as BACKEND_BASE_URL (default HTTPS port)
        expect(
          getCrossOriginAttribute(
            "anonymous",
            "https://backend.example.com:443/image.png"
          )
        ).toBe("anonymous")
      })

      it("handles URLs with different protocols correctly", () => {
        expect(
          getCrossOriginAttribute(
            "anonymous",
            "http://backend.example.com/image.png"
          )
        ).toBe(undefined)
      })
    })

    describe("when window.__streamlit.BACKEND_BASE_URL has explicit port", () => {
      beforeEach(() => {
        window.__streamlit = {
          BACKEND_BASE_URL: "https://backend.example.com:8080",
        } as typeof window.__streamlit
      })

      it("matches URLs with the same explicit port", () => {
        expect(
          getCrossOriginAttribute(
            "anonymous",
            "https://backend.example.com:8080/image.png"
          )
        ).toBe("anonymous")
      })

      it("does not match URLs without port or with different port", () => {
        expect(
          getCrossOriginAttribute(
            "anonymous",
            "https://backend.example.com/image.png"
          )
        ).toBe(undefined)
        expect(
          getCrossOriginAttribute(
            "anonymous",
            "https://backend.example.com:3000/image.png"
          )
        ).toBe(undefined)
      })
    })

    describe("when window.__streamlit is not set", () => {
      beforeEach(() => {
        window.__streamlit = undefined as unknown as typeof window.__streamlit
      })

      it("returns undefined for any absolute URL", () => {
        expect(
          getCrossOriginAttribute("anonymous", "https://example.com/image.png")
        ).toBe(undefined)
        expect(
          getCrossOriginAttribute(
            "use-credentials",
            "https://backend.example.com/api/data"
          )
        ).toBe(undefined)
      })
    })

    describe("when window.__streamlit.BACKEND_BASE_URL is not set", () => {
      beforeEach(() => {
        window.__streamlit = {} as typeof window.__streamlit
      })

      it("returns undefined for any absolute URL", () => {
        expect(
          getCrossOriginAttribute("anonymous", "https://example.com/image.png")
        ).toBe(undefined)
        expect(
          getCrossOriginAttribute(
            "use-credentials",
            "https://backend.example.com/api/data"
          )
        ).toBe(undefined)
      })
    })
  })

  describe("when URL is a relative URL or invalid", () => {
    describe("when window.__streamlit.BACKEND_BASE_URL is set", () => {
      beforeEach(() => {
        window.__streamlit = {
          BACKEND_BASE_URL: "https://backend.example.com",
        } as typeof window.__streamlit
      })

      it("returns resourceCrossOriginMode for relative URLs", () => {
        expect(getCrossOriginAttribute("anonymous", "/image.png")).toBe(
          "anonymous"
        )
        expect(getCrossOriginAttribute("use-credentials", "./api/data")).toBe(
          "use-credentials"
        )
        expect(getCrossOriginAttribute(undefined, "../resource")).toBe(
          undefined
        )
        expect(getCrossOriginAttribute("anonymous", "image.png")).toBe(
          "anonymous"
        )
      })

      it("returns resourceCrossOriginMode for URLs without scheme", () => {
        expect(
          getCrossOriginAttribute("anonymous", "www.example.com/image.png")
        ).toBe("anonymous")
        expect(
          getCrossOriginAttribute("use-credentials", "//example.com/api/data")
        ).toBe("use-credentials")
      })

      it("returns resourceCrossOriginMode for invalid URLs", () => {
        expect(getCrossOriginAttribute("anonymous", "not a url")).toBe(
          "anonymous"
        )
        expect(getCrossOriginAttribute("use-credentials", "http://")).toBe(
          "use-credentials"
        )
      })
    })

    describe("when window.__streamlit.BACKEND_BASE_URL is not set", () => {
      beforeEach(() => {
        window.__streamlit = {} as typeof window.__streamlit
      })

      it("returns undefined for relative URLs", () => {
        expect(getCrossOriginAttribute("anonymous", "/image.png")).toBe(
          undefined
        )
        expect(getCrossOriginAttribute("use-credentials", "./api/data")).toBe(
          undefined
        )
        expect(getCrossOriginAttribute("anonymous", "../resource")).toBe(
          undefined
        )
        expect(getCrossOriginAttribute("anonymous", "image.png")).toBe(
          undefined
        )
      })

      it("returns undefined for URLs without scheme", () => {
        expect(
          getCrossOriginAttribute("anonymous", "www.example.com/image.png")
        ).toBe(undefined)
        expect(
          getCrossOriginAttribute("use-credentials", "//example.com/api/data")
        ).toBe(undefined)
      })

      it("returns undefined for invalid URLs", () => {
        expect(getCrossOriginAttribute("anonymous", "not a url")).toBe(
          undefined
        )
        expect(getCrossOriginAttribute("use-credentials", "http://")).toBe(
          undefined
        )
      })
    })

    describe("when window.__streamlit is not set", () => {
      beforeEach(() => {
        window.__streamlit = undefined as unknown as typeof window.__streamlit
      })

      it("returns undefined for relative URLs", () => {
        expect(getCrossOriginAttribute("anonymous", "/image.png")).toBe(
          undefined
        )
        expect(getCrossOriginAttribute("use-credentials", "./api/data")).toBe(
          undefined
        )
        expect(getCrossOriginAttribute("anonymous", "image.png")).toBe(
          undefined
        )
      })
    })
  })

  describe("edge cases", () => {
    it("handles empty string URL", () => {
      window.__streamlit = {
        BACKEND_BASE_URL: "https://backend.example.com",
      } as typeof window.__streamlit

      // Empty string is falsy, so the function returns undefined
      expect(getCrossOriginAttribute("anonymous", "")).toBe(undefined)
    })

    it("handles malformed BACKEND_BASE_URL", () => {
      window.__streamlit = {
        BACKEND_BASE_URL: "not a valid url",
      } as typeof window.__streamlit

      // Should not throw and should return resourceCrossOriginMode for relative URLs
      expect(getCrossOriginAttribute("anonymous", "/image.png")).toBe(
        "anonymous"
      )
      // When parsing the absolute URL succeeds but comparing with malformed BACKEND_BASE_URL fails,
      // the error is caught and the function treats it as a parsing failure,
      // returning resourceCrossOriginMode since BACKEND_BASE_URL is set
      expect(
        getCrossOriginAttribute("anonymous", "https://example.com/image.png")
      ).toBe("anonymous")
    })
  })
})
