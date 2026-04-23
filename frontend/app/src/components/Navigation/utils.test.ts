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

import { describe, expect, it } from "vitest"

import { IAppPage } from "@streamlit/protobuf"

import {
  filterVisiblePages,
  getExternalPageUrl,
  groupPagesBySection,
  hasNonEmptySections,
  isExternalPage,
  processNavigationStructure,
  shouldShowNavigation,
} from "./utils"

describe("shouldShowNavigation", () => {
  it("returns false when there is only one page", () => {
    const appPages: IAppPage[] = [
      { pageName: "page1", pageScriptHash: "hash1" },
    ]

    expect(shouldShowNavigation(appPages)).toBe(false)
  })

  it("returns false when there is one section with one page", () => {
    const appPages: IAppPage[] = [
      {
        pageName: "page1",
        pageScriptHash: "hash1",
        sectionHeader: "Section1",
      },
    ]

    expect(shouldShowNavigation(appPages)).toBe(false)
  })

  it("returns true when there are multiple pages without sections", () => {
    const appPages: IAppPage[] = [
      { pageName: "page1", pageScriptHash: "hash1" },
      { pageName: "page2", pageScriptHash: "hash2" },
    ]

    expect(shouldShowNavigation(appPages)).toBe(true)
  })

  it("returns true when there is one section with multiple pages", () => {
    const appPages: IAppPage[] = [
      {
        pageName: "page1",
        pageScriptHash: "hash1",
        sectionHeader: "Section1",
      },
      {
        pageName: "page2",
        pageScriptHash: "hash2",
        sectionHeader: "Section1",
      },
    ]

    expect(shouldShowNavigation(appPages)).toBe(true)
  })

  it("returns true when there are multiple sections", () => {
    const appPages: IAppPage[] = [
      {
        pageName: "page1",
        pageScriptHash: "hash1",
        sectionHeader: "Section1",
      },
      {
        pageName: "page2",
        pageScriptHash: "hash2",
        sectionHeader: "Section2",
      },
    ]

    expect(shouldShowNavigation(appPages)).toBe(true)
  })

  it("returns true when there are multiple sections with multiple pages each", () => {
    const appPages: IAppPage[] = [
      {
        pageName: "page1",
        pageScriptHash: "hash1",
        sectionHeader: "Section1",
      },
      {
        pageName: "page2",
        pageScriptHash: "hash2",
        sectionHeader: "Section1",
      },
      {
        pageName: "page3",
        pageScriptHash: "hash3",
        sectionHeader: "Section2",
      },
      {
        pageName: "page4",
        pageScriptHash: "hash4",
        sectionHeader: "Section2",
      },
    ]

    expect(shouldShowNavigation(appPages)).toBe(true)
  })

  it("returns false when there are no pages", () => {
    const appPages: IAppPage[] = []

    expect(shouldShowNavigation(appPages)).toBe(false)
  })

  describe("with hidden pages", () => {
    it("returns false when there is 1 visible page and multiple hidden pages", () => {
      const appPages: IAppPage[] = [
        { pageName: "visible", pageScriptHash: "hash1", isHidden: false },
        { pageName: "hidden1", pageScriptHash: "hash2", isHidden: true },
        { pageName: "hidden2", pageScriptHash: "hash3", isHidden: true },
      ]

      expect(shouldShowNavigation(appPages)).toBe(false)
    })

    it("returns false when all pages are hidden", () => {
      const appPages: IAppPage[] = [
        { pageName: "hidden1", pageScriptHash: "hash1", isHidden: true },
        { pageName: "hidden2", pageScriptHash: "hash2", isHidden: true },
      ]

      expect(shouldShowNavigation(appPages)).toBe(false)
    })

    it("returns true when there are multiple visible pages with some hidden", () => {
      const appPages: IAppPage[] = [
        { pageName: "visible1", pageScriptHash: "hash1", isHidden: false },
        { pageName: "visible2", pageScriptHash: "hash2", isHidden: false },
        { pageName: "hidden", pageScriptHash: "hash3", isHidden: true },
      ]

      expect(shouldShowNavigation(appPages)).toBe(true)
    })

    it("returns false when only 1 visible page in a section with hidden pages", () => {
      const appPages: IAppPage[] = [
        {
          pageName: "visible",
          pageScriptHash: "hash1",
          sectionHeader: "Section1",
          isHidden: false,
        },
        {
          pageName: "hidden",
          pageScriptHash: "hash2",
          sectionHeader: "Section1",
          isHidden: true,
        },
      ]

      expect(shouldShowNavigation(appPages)).toBe(false)
    })

    it("returns true when multiple visible pages in sections with hidden pages", () => {
      const appPages: IAppPage[] = [
        {
          pageName: "visible1",
          pageScriptHash: "hash1",
          sectionHeader: "Section1",
          isHidden: false,
        },
        {
          pageName: "visible2",
          pageScriptHash: "hash2",
          sectionHeader: "Section2",
          isHidden: false,
        },
        {
          pageName: "hidden",
          pageScriptHash: "hash3",
          sectionHeader: "Section1",
          isHidden: true,
        },
      ]

      expect(shouldShowNavigation(appPages)).toBe(true)
    })

    it("ignores sections where all pages are hidden", () => {
      const appPages: IAppPage[] = [
        {
          pageName: "visible1",
          pageScriptHash: "hash1",
          sectionHeader: "VisibleSection",
          isHidden: false,
        },
        {
          pageName: "visible2",
          pageScriptHash: "hash2",
          sectionHeader: "VisibleSection",
          isHidden: false,
        },
        {
          pageName: "hidden1",
          pageScriptHash: "hash3",
          sectionHeader: "HiddenSection",
          isHidden: true,
        },
        {
          pageName: "hidden2",
          pageScriptHash: "hash4",
          sectionHeader: "HiddenSection",
          isHidden: true,
        },
      ]

      // Should show nav because there are 2 visible pages in VisibleSection
      expect(shouldShowNavigation(appPages)).toBe(true)
    })
  })
})

describe("groupPagesBySection", () => {
  it("groups pages by section header", () => {
    const appPages: IAppPage[] = [
      { pageName: "page1", pageScriptHash: "hash1", sectionHeader: "Admin" },
      { pageName: "page2", pageScriptHash: "hash2", sectionHeader: "Admin" },
      { pageName: "page3", pageScriptHash: "hash3", sectionHeader: "Reports" },
      { pageName: "page4", pageScriptHash: "hash4" }, // No section header
    ]

    const result = groupPagesBySection(appPages)

    expect(result).toEqual({
      Admin: [
        { pageName: "page1", pageScriptHash: "hash1", sectionHeader: "Admin" },
        { pageName: "page2", pageScriptHash: "hash2", sectionHeader: "Admin" },
      ],
      Reports: [
        {
          pageName: "page3",
          pageScriptHash: "hash3",
          sectionHeader: "Reports",
        },
      ],
      "": [{ pageName: "page4", pageScriptHash: "hash4" }],
    })
  })

  it("handles all pages with empty sections", () => {
    const appPages: IAppPage[] = [
      { pageName: "page1", pageScriptHash: "hash1" },
      { pageName: "page2", pageScriptHash: "hash2" },
    ]

    const result = groupPagesBySection(appPages)

    expect(result).toEqual({
      "": [
        { pageName: "page1", pageScriptHash: "hash1" },
        { pageName: "page2", pageScriptHash: "hash2" },
      ],
    })
  })

  it("normalizes missing section headers to the empty section key", () => {
    const appPages: IAppPage[] = [
      { pageName: "page1", pageScriptHash: "hash1", sectionHeader: undefined },
      { pageName: "page2", pageScriptHash: "hash2", sectionHeader: null },
    ]

    const result = groupPagesBySection(appPages)

    expect(result).toHaveProperty("")
    expect(result).not.toHaveProperty("undefined")
    expect(result[""]).toHaveLength(2)
  })

  it('preserves a literal "undefined" section name', () => {
    const appPages: IAppPage[] = [
      {
        pageName: "page1",
        pageScriptHash: "hash1",
        sectionHeader: "undefined",
      },
    ]

    const result = groupPagesBySection(appPages)

    expect(result).toEqual({
      undefined: [
        {
          pageName: "page1",
          pageScriptHash: "hash1",
          sectionHeader: "undefined",
        },
      ],
    })
  })
})

describe("hasNonEmptySections", () => {
  it("returns true when there are named sections", () => {
    const navSections = {
      "": [{ pageName: "page1", pageScriptHash: "hash1" }],
      Admin: [{ pageName: "page2", pageScriptHash: "hash2" }],
    }

    expect(hasNonEmptySections(navSections)).toBe(true)
  })

  it("returns false when all sections are empty", () => {
    const navSections = {
      "": [
        { pageName: "page1", pageScriptHash: "hash1" },
        { pageName: "page2", pageScriptHash: "hash2" },
      ],
    }

    expect(hasNonEmptySections(navSections)).toBe(false)
  })

  it("returns false when there are no sections", () => {
    const navSections = {}

    expect(hasNonEmptySections(navSections)).toBe(false)
  })
})

describe("processNavigationStructure", () => {
  it("separates individual pages from sections when mixed", () => {
    const navSections = {
      "": [
        { pageName: "Home", pageScriptHash: "hash1" },
        { pageName: "Dashboard", pageScriptHash: "hash2" },
      ],
      Admin: [
        { pageName: "Settings", pageScriptHash: "hash3" },
        { pageName: "Users", pageScriptHash: "hash4" },
      ],
      Reports: [{ pageName: "Analytics", pageScriptHash: "hash5" }],
    }

    const result = processNavigationStructure(navSections)

    expect(result).toEqual({
      individualPages: [
        { pageName: "Home", pageScriptHash: "hash1" },
        { pageName: "Dashboard", pageScriptHash: "hash2" },
      ],
      sections: {
        Admin: [
          { pageName: "Settings", pageScriptHash: "hash3" },
          { pageName: "Users", pageScriptHash: "hash4" },
        ],
        Reports: [{ pageName: "Analytics", pageScriptHash: "hash5" }],
      },
    })
  })

  it("returns all pages as individual when no named sections", () => {
    const navSections = {
      "": [
        { pageName: "page1", pageScriptHash: "hash1" },
        { pageName: "page2", pageScriptHash: "hash2" },
        { pageName: "page3", pageScriptHash: "hash3" },
      ],
    }

    const result = processNavigationStructure(navSections)

    expect(result).toEqual({
      individualPages: [
        { pageName: "page1", pageScriptHash: "hash1" },
        { pageName: "page2", pageScriptHash: "hash2" },
        { pageName: "page3", pageScriptHash: "hash3" },
      ],
      sections: {},
    })
  })

  it("handles only named sections with no empty sections", () => {
    const navSections = {
      Admin: [{ pageName: "Settings", pageScriptHash: "hash1" }],
      Reports: [{ pageName: "Analytics", pageScriptHash: "hash2" }],
    }

    const result = processNavigationStructure(navSections)

    expect(result).toEqual({
      individualPages: [],
      sections: {
        Admin: [{ pageName: "Settings", pageScriptHash: "hash1" }],
        Reports: [{ pageName: "Analytics", pageScriptHash: "hash2" }],
      },
    })
  })

  it('keeps sections named "undefined" when mixed with empty sections', () => {
    const navSections = {
      "": [{ pageName: "Home", pageScriptHash: "hash1" }],
      undefined: [
        {
          pageName: "Settings",
          pageScriptHash: "hash2",
          sectionHeader: "undefined",
        },
      ],
    }

    const result = processNavigationStructure(navSections)

    expect(result).toEqual({
      individualPages: [{ pageName: "Home", pageScriptHash: "hash1" }],
      sections: {
        undefined: [
          {
            pageName: "Settings",
            pageScriptHash: "hash2",
            sectionHeader: "undefined",
          },
        ],
      },
    })
  })
})

describe("filterVisiblePages", () => {
  it.each([
    {
      name: "returns all pages when none are hidden",
      pages: [
        { pageName: "page1", pageScriptHash: "hash1", isHidden: false },
        { pageName: "page2", pageScriptHash: "hash2", isHidden: false },
      ],
      expectedLength: 2,
      expectedNames: ["page1", "page2"],
    },
    {
      name: "filters out hidden pages",
      pages: [
        { pageName: "page1", pageScriptHash: "hash1", isHidden: false },
        { pageName: "page2", pageScriptHash: "hash2", isHidden: true },
        { pageName: "page3", pageScriptHash: "hash3", isHidden: false },
      ],
      expectedLength: 2,
      expectedNames: ["page1", "page3"],
    },
    {
      name: "returns empty array when all pages are hidden",
      pages: [
        { pageName: "page1", pageScriptHash: "hash1", isHidden: true },
        { pageName: "page2", pageScriptHash: "hash2", isHidden: true },
      ],
      expectedLength: 0,
      expectedNames: [],
    },
    {
      name: "handles empty array",
      pages: [],
      expectedLength: 0,
      expectedNames: [],
    },
    {
      name: "treats undefined isHidden as visible",
      pages: [
        { pageName: "page1", pageScriptHash: "hash1" },
        { pageName: "page2", pageScriptHash: "hash2", isHidden: true },
      ],
      expectedLength: 1,
      expectedNames: ["page1"],
    },
  ])("$name", ({ pages, expectedLength, expectedNames }) => {
    const result = filterVisiblePages(pages)

    expect(result).toHaveLength(expectedLength)
    expect(result.map(p => p.pageName)).toEqual(expectedNames)
  })
})

describe("external destination helpers", () => {
  it("detects external pages and returns their destination URL", () => {
    const page: IAppPage = {
      pageName: "docs",
      pageScriptHash: "hash",
      externalUrl: "https://docs.streamlit.io",
    }

    expect(isExternalPage(page)).toBe(true)
    expect(getExternalPageUrl(page)).toBe("https://docs.streamlit.io")
  })

  it("treats pages with an empty external URL as external", () => {
    const page: IAppPage = {
      pageName: "docs",
      pageScriptHash: "hash",
      externalUrl: "",
    }

    expect(isExternalPage(page)).toBe(true)
    expect(getExternalPageUrl(page)).toBe("")
  })

  it("treats internal pages as non-external with no URL", () => {
    const page: IAppPage = {
      pageName: "internal",
      pageScriptHash: "hash",
    }

    expect(isExternalPage(page)).toBe(false)
    expect(getExternalPageUrl(page)).toBeUndefined()
  })
})
