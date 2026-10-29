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

import fs from "fs"
import path from "path"

/** Where the agent API describes itself, relative to the app's root. */
const AGENT_API_DESCRIPTION = "_stcore/agent/openapi.json"

// Load index.html into JSDOM for assertions.
const HTML = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8")
document.documentElement.innerHTML = HTML

describe("index.html", () => {
  it("links the agent API's description relative to the page", () => {
    const links = document.querySelectorAll<HTMLLinkElement>(
      "link[rel='service-desc']"
    )

    expect(links).toHaveLength(1)
    // Relative, so it resolves under a base URL path or a hosting prefix.
    expect(links[0].getAttribute("href")).toBe(`./${AGENT_API_DESCRIPTION}`)
  })

  it("tells a reader without JavaScript where the agent API starts", () => {
    const noscript = document.querySelector("noscript")
    const text = noscript?.textContent ?? ""

    expect(text).toContain("You need to enable JavaScript to run this app.")
    // Spelled out, since many HTML-to-text extractors drop link targets.
    expect(text).toContain(AGENT_API_DESCRIPTION)
    expect(noscript?.innerHTML).toContain(`href="./${AGENT_API_DESCRIPTION}"`)
    // The one operation is named too, so a reader can start without first
    // fetching the description.
    expect(text).toContain("POST _stcore/agent/interact")
    // So is the MCP server, which AI applications add by URL.
    expect(text).toContain("MCP server")
    expect(text).toContain("_stcore/agent/mcp")
  })
})
