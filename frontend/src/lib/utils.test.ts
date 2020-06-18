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

import { getCookie, flattenElements } from "./utils"
import { BlockElement } from "lib/DeltaParser"
import { List, Set as ImmutableSet, Map as ImmutableMap } from "immutable"

describe("flattenElements", () => {
  const simpleElement1 = ImmutableMap({ key1: "value1", key2: "value2" })
  const simpleElement2 = ImmutableMap({ key3: "value3", key4: "value4" })
  const simpleElement3 = ImmutableMap({ key5: "value5", key6: "value6" })
  const simpleBlockElement: BlockElement = List([
    ImmutableMap({
      element: simpleElement1,
    }),
    ImmutableMap({
      element: simpleElement2,
    }),
  ])
  const nestedBlockElement: BlockElement = List([
    ImmutableMap({
      element: List(simpleBlockElement),
    }),
    ImmutableMap({
      element: simpleElement3,
    }),
  ])

  it("should walk down a simple BlockElement", () => {
    const elements = flattenElements(simpleBlockElement)
    expect(elements).toEqual(ImmutableSet([simpleElement1, simpleElement2]))
  })

  it("should walk down a simple BlockElement", () => {
    const elements = flattenElements(nestedBlockElement)
    expect(elements).toEqual(
      ImmutableSet([simpleElement1, simpleElement2, simpleElement3])
    )
  })
})

describe("getCookie", () => {
  afterEach(() => {
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT"
    })
  })

  it("get existing cookie", () => {
    document.cookie = "flavor=chocolatechip"
    const cookie = getCookie("flavor")
    expect(cookie).toEqual("chocolatechip")
  })

  it("get missing cookie", () => {
    document.cookie = "sweetness=medium;"
    document.cookie = "flavor=chocolatechip;"
    document.cookie = "type=darkchocolate;"
    const cookie = getCookie("recipe")
    expect(cookie).toEqual(undefined)
  })

  it("find cookie in the front", () => {
    document.cookie = "flavor=chocolatechip;"
    document.cookie = "sweetness=medium;"
    document.cookie = "type=darkchocolate;"
    console.log(document.cookie)
    const cookie = getCookie("flavor")
    expect(cookie).toEqual("chocolatechip")
  })

  it("find cookie in the middle", () => {
    document.cookie = "sweetness=medium;"
    document.cookie = "flavor=chocolatechip;"
    document.cookie = "type=darkchocolate;"
    const cookie = getCookie("flavor")
    expect(cookie).toEqual("chocolatechip")
  })

  it("find cookie in the end", () => {
    document.cookie = "sweetness=medium;"
    document.cookie = "type=darkchocolate;"
    document.cookie = "flavor=chocolatechip;"
    const cookie = getCookie("flavor")
    expect(cookie).toEqual("chocolatechip")
  })
})
