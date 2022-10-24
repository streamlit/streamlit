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

import React, { ReactElement } from "react"
import { act } from "react-dom/test-utils"

import { shallow, mount } from "src/lib/test_util"

import withHostCommunication, {
  HostCommunicationHOC,
  HOST_COMM_VERSION,
} from "./withHostCommunication"

const TestComponentNaked = (props: {
  hostCommunication: HostCommunicationHOC
}): ReactElement => {
  return <div>test</div>
}

const TestComponent = withHostCommunication(TestComponentNaked)

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
    const wrapper = shallow(<TestComponent />)

    expect(wrapper.html()).not.toBeNull()
  })

  it("wrapped component should have hostCommunication prop", () => {
    const wrapper = shallow(<TestComponent />)
    expect(
      wrapper.find(TestComponentNaked).prop("hostCommunication")
    ).toBeDefined()
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

    const wrapper = mount(<TestComponent />)
    const hostCommunication: any = wrapper
      .find(TestComponentNaked)
      .prop("hostCommunication")

    act(() => {
      hostCommunication.setAllowedOrigins(["https://devel.streamlit.test"])
    })
  })
})

describe("withHostCommunication HOC receiving messages", () => {
  let dispatchEvent: any
  let originalHash: any
  let wrapper: any
  let hostCommunication: any

  beforeEach(() => {
    // We need to save and restore window.location.hash for each test because
    // its value persists between tests otherwise, which may cause tests to
    // interfere with each other.
    originalHash = window.location.hash
    dispatchEvent = mockEventListeners()
    wrapper = mount(<TestComponent />)

    hostCommunication = wrapper
      .find(TestComponentNaked)
      .prop("hostCommunication")

    act(() => {
      hostCommunication.setAllowedOrigins(["http://devel.streamlit.test"])
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

    const props = wrapper.find(TestComponentNaked).prop("hostCommunication")
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

    const props = wrapper.find(TestComponentNaked).prop("hostCommunication")
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

    const props = wrapper.find(TestComponentNaked).prop("hostCommunication")
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

    const innerComponent = wrapper.find(TestComponentNaked)
    const props = innerComponent.prop("hostCommunication")
    expect(props.currentState.requestedPageScriptHash).toBe("hash1")

    act(() => {
      innerComponent.prop("hostCommunication").onPageChanged()
    })
    wrapper.update()

    const innerComponent2 = wrapper.find(TestComponentNaked)
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

    const props = wrapper.find(TestComponentNaked).prop("hostCommunication")
    expect(props.currentState.pageLinkBaseUrl).toBe(
      "https://share.streamlit.io/vdonato/foo/bar"
    )
  })

  it("can process a received SET_AUTH_TOKEN message", () => {
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

    wrapper.update()

    const props = wrapper.find(TestComponentNaked).prop("hostCommunication")
    expect(props.currentState.authToken).toBe("i am an auth token")
  })

  describe("Test different origins", () => {
    it("exact pattern", () => {
      act(() => {
        hostCommunication.setAllowedOrigins(["http://share.streamlit.io"])
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
      act(() => {
        hostCommunication.setAllowedOrigins(["http://*.streamlitapp.com"])
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
      act(() => {
        hostCommunication.setAllowedOrigins(["http://share.streamlit.io"])
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
