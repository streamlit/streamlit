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
