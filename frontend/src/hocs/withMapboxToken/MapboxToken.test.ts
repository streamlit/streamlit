import axios from "axios"
import { SessionInfo } from "src/lib/SessionInfo"
import AxiosMockAdapter from "axios-mock-adapter"
import { MapboxToken, TOKENS_URL } from "src/hocs/withMapboxToken/MapboxToken"

function setSessionInfo(
  userMapboxToken = "",
  commandLine = "streamlit hello"
): void {
  SessionInfo.current = new SessionInfo({
    appId: "aid",
    sessionId: "mockSessionId",
    streamlitVersion: "sv",
    pythonVersion: "pv",
    installationId: "iid",
    installationIdV3: "iid3",
    authorEmail: "ae",
    maxCachedMessageAge: 2,
    commandLine,
    userMapboxToken,
  })
}

describe("MapboxToken", () => {
  let axiosMock: AxiosMockAdapter

  beforeEach(() => {
    window.location.hostname = "localhost"
    axiosMock = new AxiosMockAdapter(axios)
    setSessionInfo("")
  })

  afterEach(() => {
    axiosMock.restore()
    MapboxToken.token = undefined
    MapboxToken.commandLine = undefined
    SessionInfo.clearSession()
  })

  test("Returns cached token if defined", async () => {
    MapboxToken.token = "cached"
    MapboxToken.commandLine = "streamlit hello"

    await expect(MapboxToken.get()).resolves.toEqual("cached")
  })

  test("Returns userMapboxToken if non-empty", async () => {
    const userToken = "nonEmptyToken"

    setSessionInfo(userToken)
    await expect(MapboxToken.get()).resolves.toEqual(userToken)

    // The token should also be cached.
    expect(MapboxToken.token).toEqual(userToken)
  })

  test("Fetches remote token if userMapboxToken is empty", async () => {
    const remoteToken = "remoteMapboxToken"

    // axiosMock.onGet(TOKENS_URL).reply(200, { "mapbox-localhost": remoteToken })
    axiosMock.onGet(TOKENS_URL).reply(200, { mapbox: remoteToken })

    await expect(MapboxToken.get()).resolves.toEqual(remoteToken)

    // The token should also be cached.
    expect(MapboxToken.token).toEqual(remoteToken)
  })

  test("Errors if remote token is missing", async () => {
    axiosMock.onGet(TOKENS_URL).replyOnce(200, { ohNo: "noTokenHere" })

    await expect(MapboxToken.get()).rejects.toEqual(
      new Error(`Missing token "mapbox" (${TOKENS_URL})`)
    )

    // No cached token after failure.
    expect(MapboxToken.token).toBeUndefined()

    axiosMock.onGet(TOKENS_URL).replyOnce(404, {})
    await expect(MapboxToken.get()).rejects.toEqual(
      new Error(`Request failed with status code 404 (${TOKENS_URL})`)
    )

    // No cached token after failure.
    expect(MapboxToken.token).toBeUndefined()
  })

  xit("Errors if not localhost and missing token", async () => {
    window.location = { hostname: "https://streamlit.io" } as Location
    setSessionInfo("")

    await expect(MapboxToken.get()).rejects.toThrow("No Mapbox token provided")
  })

  xit("Errors if not hello.py and missing token", async () => {
    setSessionInfo("", "streamlit run example.py")

    await expect(MapboxToken.get()).rejects.toThrow("No Mapbox token provided")
  })

  it("Should reload token if command line has changed", async () => {
    setSessionInfo()

    const remoteToken = "remoteMapboxToken"

    // axiosMock.onGet(TOKENS_URL).reply(200, { "mapbox-localhost": remoteToken })
    axiosMock.onGet(TOKENS_URL).reply(200, { mapbox: remoteToken })

    await expect(MapboxToken.get()).resolves.toEqual(remoteToken)

    setSessionInfo("password", "streamlit run test.py")

    await expect(MapboxToken.get()).resolves.toEqual("password")
  })
})
