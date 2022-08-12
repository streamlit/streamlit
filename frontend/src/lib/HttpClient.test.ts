import axios from "axios"
import HttpClient from "src/lib/HttpClient"
import { SessionInfo } from "src/lib/SessionInfo"
import { buildHttpUri } from "src/lib/UriUtil"

const MOCK_SERVER_URI = {
  host: "streamlit.mock",
  port: 80,
  basePath: "",
}

describe("HttpClient", () => {
  const spyRequest = jest.spyOn(axios, "request")

  beforeEach(() => {
    SessionInfo.current = new SessionInfo({
      appId: "aid",
      sessionId: "sessionId",
      streamlitVersion: "sv",
      pythonVersion: "pv",
      installationId: "iid",
      installationIdV3: "iid3",
      authorEmail: "ae",
      maxCachedMessageAge: 2,
      commandLine: "command line",
      userMapboxToken: "mockUserMapboxToken",
    })
  })

  afterEach(() => {
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`
    })
  })

  test("has xsrf enabled", () => {
    document.cookie = "_xsrf=cookie;"
    const client = new HttpClient(() => MOCK_SERVER_URI, true)

    client.request("url", {})

    expect(spyRequest).toHaveBeenCalledWith({
      headers: { "X-Xsrftoken": "cookie" },
      withCredentials: true,
      url: buildHttpUri(MOCK_SERVER_URI, `url`),
    })
  })

  test("has xsrf disabled", () => {
    const client = new HttpClient(() => MOCK_SERVER_URI, false)

    client.request("url", {})
    expect(spyRequest).toHaveBeenCalledWith({
      url: buildHttpUri(MOCK_SERVER_URI, `url`),
    })
  })
})
