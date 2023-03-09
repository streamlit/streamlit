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

import React, { PureComponent, ReactElement } from "react"
import { act } from "react-dom/test-utils"

import { shallow, mount } from "src/lib/test_util"

import withHostCommunication, {
  HostCommunicationHOC,
  HOST_COMM_VERSION,
} from "./withHostCommunication"

interface TestProps {
  hostCommunication: HostCommunicationHOC
  label: string
}

class TestComponent extends PureComponent<TestProps> {
  public render = (): ReactElement => <div>test</div>
}

const WrappedTestComponent = withHostCommunication(TestComponent)

function mockEventListeners(): (type: string, event: any) => void {
  const listeners: { [name: string]: ((event: Event) => void)[] } = {}

  window.addEventListener = jest.fn((event: string, cb: any) => {
    listeners[event] = listeners[event] || []
    listeners[event].push(cb)
  })

  const dispatchEvent = (type: string, event: Event): void =>
    listeners[type].forEach(cb => cb(event))
  return dispatchEvent
}

describe("withHostCommunication HOC", () => {
  it("renders without crashing", () => {
    const wrapper = shallow(<WrappedTestComponent label={"mockLabel"} />)

    expect(wrapper.html()).not.toBeNull()
  })

  it("wrapped component should have hostCommunication prop", () => {
    const wrapper = shallow(<WrappedTestComponent label={"mockLabel"} />)
    expect(wrapper.find(TestComponent).prop("hostCommunication")).toBeDefined()
  })

  it("passes other props to wrapped component", () => {
    const wrapper = shallow(<WrappedTestComponent label={"mockLabel"} />)
    expect(wrapper.find(TestComponent).props().label).toBe("mockLabel")
  })

  it("defines displayName", () => {
    expect(WrappedTestComponent.displayName).toBe(
      "withHostCommunication(TestComponent)"
    )
  })

  it("host should receive a GUEST_READY message", done => {
    const listener = (event: MessageEvent): void => {
      expect(event.data).toStrictEqual({
        stCommVersion: HOST_COMM_VERSION,
        type: "GUEST_READY",
      })

      window.removeEventListener("message", listener)
      done()
    }

    window.addEventListener("message", listener)

    const wrapper = mount(<WrappedTestComponent label={"mockLabel"} />)
    const hostCommunication: any = wrapper
      .find(TestComponent)
      .prop("hostCommunication")

    act(() => {
      hostCommunication.setAllowedOriginsResp({
        allowedOrigins: ["https://devel.streamlit.test"],
        useExternalAuthToken: false,
      })
    })
  })
})

describe("withHostCommunication HOC receiving messages", () => {
  let dispatchEvent: any
  let originalHash: any
  let wrapper: any

  beforeEach(() => {
    // We need to save and restore window.location.hash for each test because
    // its value persists between tests otherwise, which may cause tests to
    // interfere with each other.
    originalHash = window.location.hash
    dispatchEvent = mockEventListeners()
    wrapper = mount(<WrappedTestComponent label={"mockLabel"} />)

    const hostCommunication = wrapper
      .find(TestComponent)
      .prop("hostCommunication")

    act(() => {
      hostCommunication.setAllowedOriginsResp({
        allowedOrigins: ["http://devel.streamlit.test"],
        useExternalAuthToken: false,
      })
    })
  })

  afterEach(() => {
    window.location.hash = originalHash
  })

  it("should respond to UPDATE_HASH message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "UPDATE_HASH",
          hash: "#somehash",
        },
        origin: "http://devel.streamlit.test",
      })
    )

    expect(window.location.hash).toEqual("#somehash")
  })

  it("can process a received SET_TOOLBAR_ITEMS message", () => {
    act(() => {
      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: HOST_COMM_VERSION,
            type: "SET_TOOLBAR_ITEMS",
            items: [
              {
                borderless: true,
                label: "",
                icon: "star.svg",
                key: "favorite",
              },
            ],
          },
          origin: "http://devel.streamlit.test",
        })
      )
    })

    wrapper.update()

    const props = wrapper.find(TestComponent).prop("hostCommunication")
    expect(props.currentState.toolbarItems).toEqual([
      {
        borderless: true,
        icon: "star.svg",
        key: "favorite",
        label: "",
      },
    ])
  })

  it("can process a received SET_SIDEBAR_CHEVRON_DOWNSHIFT message", () => {
    act(() => {
      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: HOST_COMM_VERSION,
            type: "SET_SIDEBAR_CHEVRON_DOWNSHIFT",
            sidebarChevronDownshift: 50,
          },
          origin: "http://devel.streamlit.test",
        })
      )
    })

    wrapper.update()

    const props = wrapper.find(TestComponent).prop("hostCommunication")
    expect(props.currentState.sidebarChevronDownshift).toBe(50)
  })

  it("can process a received SET_SIDEBAR_NAV_VISIBILITY message", () => {
    act(() => {
      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: HOST_COMM_VERSION,
            type: "SET_SIDEBAR_NAV_VISIBILITY",
            hidden: true,
          },
          origin: "http://devel.streamlit.test",
        })
      )
    })

    wrapper.update()

    const props = wrapper.find(TestComponent).prop("hostCommunication")
    expect(props.currentState.hideSidebarNav).toBe(true)
  })

  it("can process a received REQUEST_PAGE_CHANGE message", () => {
    act(() => {
      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: HOST_COMM_VERSION,
            type: "REQUEST_PAGE_CHANGE",
            pageScriptHash: "hash1",
          },
          origin: "http://devel.streamlit.test",
        })
      )
    })
    wrapper.update()

    const innerComponent = wrapper.find(TestComponent)
    const props = innerComponent.prop("hostCommunication")
    expect(props.currentState.requestedPageScriptHash).toBe("hash1")

    act(() => {
      innerComponent.prop("hostCommunication").onPageChanged()
    })
    wrapper.update()

    const innerComponent2 = wrapper.find(TestComponent)
    const props2 = innerComponent2.prop("hostCommunication")
    expect(props2.currentState.requestedPageScriptHash).toBe(null)
  })

  it("can process a received SET_PAGE_LINK_BASE_URL message", () => {
    act(() => {
      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: HOST_COMM_VERSION,
            type: "SET_PAGE_LINK_BASE_URL",
            pageLinkBaseUrl: "https://share.streamlit.io/vdonato/foo/bar",
          },
          origin: "http://devel.streamlit.test",
        })
      )
    })

    wrapper.update()

    const props = wrapper.find(TestComponent).prop("hostCommunication")
    expect(props.currentState.pageLinkBaseUrl).toBe(
      "https://share.streamlit.io/vdonato/foo/bar"
    )
  })

  describe("Test different origins", () => {
    it("exact pattern", () => {
      const hostCommunication = wrapper
        .find(TestComponent)
        .prop("hostCommunication")

      act(() => {
        hostCommunication.setAllowedOriginsResp({
          allowedOrigins: ["http://share.streamlit.io"],
          useExternalAuthToken: false,
        })
      })

      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: HOST_COMM_VERSION,
            type: "UPDATE_HASH",
            hash: "#somehash",
          },
          origin: "http://share.streamlit.io",
        })
      )

      expect(window.location.hash).toEqual("#somehash")
    })

    it("wildcard pattern", () => {
      const hostCommunication = wrapper
        .find(TestComponent)
        .prop("hostCommunication")

      act(() => {
        hostCommunication.setAllowedOriginsResp({
          allowedOrigins: ["http://*.streamlitapp.com"],
          useExternalAuthToken: false,
        })
      })

      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: HOST_COMM_VERSION,
            type: "UPDATE_HASH",
            hash: "#somehash",
          },
          origin: "http://cool-cucumber-fa9ds9f.streamlitapp.com",
        })
      )

      expect(window.location.hash).toEqual("#somehash")
    })

    it("ignores non-matching origins", () => {
      const hostCommunication = wrapper
        .find(TestComponent)
        .prop("hostCommunication")

      act(() => {
        hostCommunication.setAllowedOriginsResp({
          allowedOrigins: ["http://share.streamlit.io"],
          useExternalAuthToken: false,
        })
      })

      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: HOST_COMM_VERSION,
            type: "UPDATE_HASH",
            hash: "#somehash",
          },
          origin: "http://example.com",
        })
      )

      expect(window.location.hash).toEqual("")
    })
  })
})

describe("withHostCommunication HOC external auth token handling", () => {
  it("resolves promise to undefined immediately if useExternalAuthToken is false", async () => {
    const wrapper = mount(<WrappedTestComponent label={"mockLabel"} />)

    const hostCommunication = wrapper
      .find(TestComponent)
      .prop("hostCommunication")

    act(() => {
      hostCommunication.setAllowedOriginsResp({
        allowedOrigins: ["http://devel.streamlit.test"],
        useExternalAuthToken: false,
      })
    })

    await expect(
      hostCommunication.currentState.authTokenPromise
    ).resolves.toBe(undefined)
  })

  it("waits to receive SET_AUTH_TOKEN message before resolving promise if useExternalAuthToken is true", async () => {
    const dispatchEvent = mockEventListeners()
    const wrapper = mount(<WrappedTestComponent label={"mockLabel"} />)

    let hostCommunication = wrapper
      .find(TestComponent)
      .prop("hostCommunication")

    // Simulate receiving a response from the Streamlit server's
    // `/st-allowed-message-origins` endpoint. Notably, the
    // useExternalAuthToken field in the response body is set to true, which
    // signals that the withHostCommunication hoc should wait to receive a
    // SET_AUTH_TOKEN message before resolving authTokenPromise to the token
    // in the message payload.
    act(() => {
      hostCommunication.setAllowedOriginsResp({
        allowedOrigins: ["http://devel.streamlit.test"],
        useExternalAuthToken: true,
      })
    })

    // Asynchronously send a SET_AUTH_TOKEN message to the
    // withHostCommunication hoc, which won't proceed past the `await`
    // statement below until the message is received and handled.
    setTimeout(() => {
      act(() => {
        dispatchEvent(
          "message",
          new MessageEvent("message", {
            data: {
              stCommVersion: HOST_COMM_VERSION,
              type: "SET_AUTH_TOKEN",
              authToken: "i am an auth token",
            },
            origin: "http://devel.streamlit.test",
          })
        )
      })
    })

    await expect(
      hostCommunication.currentState.authTokenPromise
    ).resolves.toBe("i am an auth token")

    // Reset the auth token and do everything again to confirm that we don't
    // incorrectly resolve to an old value after resetAuthToken is called.
    act(() => {
      hostCommunication.resetAuthToken()
    })
    wrapper.update()

    hostCommunication = wrapper.find(TestComponent).prop("hostCommunication")

    // Simulate the browser tab disconnecting and reconnecting, which from the
    // withHostCommunication hoc's perspective is only seen as a new call to
    // setAllowedOriginsResp.
    act(() => {
      hostCommunication.setAllowedOriginsResp({
        allowedOrigins: ["http://devel.streamlit.test"],
        useExternalAuthToken: true,
      })
    })

    setTimeout(() => {
      act(() => {
        dispatchEvent(
          "message",
          new MessageEvent("message", {
            data: {
              stCommVersion: HOST_COMM_VERSION,
              type: "SET_AUTH_TOKEN",
              authToken: "i am a NEW auth token",
            },
            origin: "http://devel.streamlit.test",
          })
        )
      })
    })

    await expect(
      hostCommunication.currentState.authTokenPromise
    ).resolves.toBe("i am a NEW auth token")
  })
})
