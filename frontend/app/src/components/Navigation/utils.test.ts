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

import { describe, expect, it } from "vitest"

import { IAppPage } from "@streamlit/protobuf"

import {
  groupPagesBySection,
  hasNonEmptySections,
  processNavigationStructure,
  shouldShowNavigation,
} from "./utils"

describe("shouldShowNavigation", () => {
  it("returns false when there is only one page", () => {
    const appPages: IAppPage[] = [
      { pageName: "page1", pageScriptHash: "hash1" },
    ]
    const navSections: string[] = []

    expect(shouldShowNavigation(appPages, navSections)).toBe(false)
  })

  it("returns false when there is one section with one page", () => {
    const appPages: IAppPage[] = [
      {
        pageName: "page1",
        pageScriptHash: "hash1",
        sectionHeader: "Section1",
      },
    ]
    const navSections: string[] = ["Section1"]

    expect(shouldShowNavigation(appPages, navSections)).toBe(false)
  })

  it("returns true when there are multiple pages without sections", () => {
    const appPages: IAppPage[] = [
      { pageName: "page1", pageScriptHash: "hash1" },
      { pageName: "page2", pageScriptHash: "hash2" },
    ]
    const navSections: string[] = []

    expect(shouldShowNavigation(appPages, navSections)).toBe(true)
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
    const navSections: string[] = ["Section1"]

    expect(shouldShowNavigation(appPages, navSections)).toBe(true)
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
    const navSections: string[] = ["Section1", "Section2"]

    expect(shouldShowNavigation(appPages, navSections)).toBe(true)
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
    const navSections: string[] = ["Section1", "Section2"]

    expect(shouldShowNavigation(appPages, navSections)).toBe(true)
  })

  it("returns false when there are no pages", () => {
    const appPages: IAppPage[] = []
    const navSections: string[] = []

    expect(shouldShowNavigation(appPages, navSections)).toBe(false)
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
})
