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

import React from "react"
import { shallow } from "enzyme"
import { MapboxToken } from "./MapboxToken"
import { SessionInfo } from "lib/SessionInfo"

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

  function getProps(): object {
    return { label: "label" }
  }

  beforeAll(() => {
    SessionInfo.current = new SessionInfo({
      sessionId: "mockSessionId",
      streamlitVersion: "sv",
      pythonVersion: "pv",
      installationId: "iid",
      authorEmail: "ae",
      maxCachedMessageAge: 2,
      commandLine,
      userMapboxToken: token,
    })
  })

  // Install a mock token in our token fetcher so that we don't hit
  // the network.
  beforeEach(() => {
    MapboxToken["token"] = token
    MapboxToken["commandLine"] = commandLine
  })

  afterEach(() => {
    MapboxToken["token"] = undefined
    MapboxToken["commandLine"] = undefined
  })

  it("renders without crashing", async () => {
    const props = getProps()
    const WrappedComponent = withMapboxToken("st.test")(TestComponent)
    const wrapper = shallow(<WrappedComponent {...props} />)

    expect(wrapper.html()).not.toBeNull()
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
