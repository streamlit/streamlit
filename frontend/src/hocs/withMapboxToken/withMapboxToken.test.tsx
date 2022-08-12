import React from "react"
import { shallow } from "src/lib/test_util"
import { SessionInfo } from "src/lib/SessionInfo"
import { MapboxToken } from "./MapboxToken"

import withMapboxToken from "./withMapboxToken"

interface TestProps {
  label: string
  mapboxToken: string
}

class TestComponent extends React.PureComponent<TestProps> {}

function waitOneTick(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve)
  })
}

describe("withMapboxToken", () => {
  const token = "mockToken"
  const commandLine = "streamlit run test.py"

  function getProps(): Record<string, unknown> {
    return { label: "label" }
  }

  beforeAll(() => {
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
      userMapboxToken: token,
    })
  })

  // Install a mock token in our token fetcher so that we don't hit
  // the network.
  beforeEach(() => {
    MapboxToken.token = token
    MapboxToken.commandLine = commandLine
  })

  afterEach(() => {
    MapboxToken.token = undefined
    MapboxToken.commandLine = undefined
  })

  it("renders without crashing", async () => {
    const props = getProps()
    const WrappedComponent = withMapboxToken("st.test")(TestComponent)
    const wrapper = shallow(<WrappedComponent {...props} />)

    expect(wrapper.find("Alert").exists()).toBe(true)
  })

  it("passes mapboxToken to wrapped component", async () => {
    const props = getProps()
    const WrappedComponent = withMapboxToken("st.test")(TestComponent)
    const wrapper = shallow(<WrappedComponent {...props} />)

    // Wait one tick for our MapboxToken promise to resolve
    await waitOneTick()

    expect(wrapper.props().label).toBe("label")
    expect(wrapper.props().mapboxToken).toBe("mockToken")
  })
})
