import { SessionInfo } from "src/lib/SessionInfo"
import { NewSession } from "src/autogen/proto"

test("Throws an error when used before initialization", () => {
  expect(() => SessionInfo.current).toThrow()
})

test("Clears session info", () => {
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
    userMapboxToken: "mpt",
  })
  expect(SessionInfo.isSet()).toBe(true)

  SessionInfo.clearSession()
  expect(SessionInfo.isSet()).toBe(false)
})

test("Can be initialized from a protobuf", () => {
  const MESSAGE = new NewSession({
    config: {
      gatherUsageStats: false,
      maxCachedMessageAge: 31,
      mapboxToken: "mapboxToken",
      allowRunOnSave: false,
    },
    initialize: {
      userInfo: {
        installationId: "installationId",
        installationIdV3: "installationIdV3",
        email: "email",
      },
      environmentInfo: {
        streamlitVersion: "streamlitVersion",
        pythonVersion: "pythonVersion",
      },
      sessionState: {
        runOnSave: false,
        scriptIsRunning: false,
      },
      sessionId: "sessionId",
      commandLine: "commandLine",
    },
  })

  const si = SessionInfo.fromNewSessionMessage(MESSAGE)
  expect(si.sessionId).toEqual("sessionId")
  expect(si.streamlitVersion).toEqual("streamlitVersion")
  expect(si.pythonVersion).toEqual("pythonVersion")
  expect(si.installationId).toEqual("installationId")
  expect(si.installationIdV3).toEqual("installationIdV3")
  expect(si.authorEmail).toEqual("email")
  expect(si.maxCachedMessageAge).toEqual(31)
  expect(si.commandLine).toEqual("commandLine")
})
