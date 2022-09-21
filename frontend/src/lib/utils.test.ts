/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import { getCookie, setCookie } from "./utils"

describe("getCookie", () => {
  afterEach(() => {
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`
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

describe("setCookie", () => {
  afterEach(() => {
    /*
      Setting a cookie with document.cookie = "key=value" will append or modify "key"
      with "value". It does not overwrite the existing list of cookies in document.cookie.
      In order to delete the cookie, give the cookie an expiration date that has passed.
      This cleanup ensures that we delete all cookies after each test.
    */
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`
    })
  })

  it("set new cookie", () => {
    setCookie("flavor", "chocolatechip")
    expect(document.cookie).toEqual("flavor=chocolatechip")
  })

  it("update existing cookie", () => {
    document.cookie = "flavor=chocolatechip"
    setCookie("flavor", "sugar")
    expect(document.cookie).toEqual("flavor=sugar")
  })

  it("remove cookie", () => {
    document.cookie = "flavor=chocolatechip"
    setCookie("flavor")
    expect(document.cookie).toEqual("")
  })
})
