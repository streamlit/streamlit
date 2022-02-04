/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
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

import React, { ReactElement } from "react"
import { act } from "react-dom/test-utils"

import { shallow, mount } from "src/lib/test_util"

import withS4ACommunication, {
  S4ACommunicationHOC,
  S4A_COMM_VERSION,
} from "./withS4ACommunication"

const TestComponentNaked = (props: {
  s4aCommunication: S4ACommunicationHOC
}): ReactElement => {
  props.s4aCommunication.connect()

  return <div>test</div>
}

const TestComponent = withS4ACommunication(TestComponentNaked)

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

describe("withS4ACommunication HOC", () => {
  it("renders without crashing", () => {
    const wrapper = shallow(<TestComponent />)

    expect(wrapper.html()).not.toBeNull()
  })

  it("wrapped component should have s4aCommunication prop", () => {
    const wrapper = shallow(<TestComponent />)
    expect(
      wrapper.find(TestComponentNaked).prop("s4aCommunication")
    ).toBeDefined()
  })

  it("s4a should receive a GUEST_READY message", done => {
    shallow(<TestComponent />)

    const listener = (event: MessageEvent): void => {
      expect(event.data).toStrictEqual({
        stCommVersion: S4A_COMM_VERSION,
        type: "GUEST_READY",
      })

      window.removeEventListener("message", listener)
      done()
    }

    window.addEventListener("message", listener)
  })

  it("should respond to UPDATE_HASH message", () => {
    const dispatchEvent = mockEventListeners()

    mount(<TestComponent />)

    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: S4A_COMM_VERSION,
          type: "UPDATE_HASH",
          hash: "#somehash",
        },
        origin: "http://devel.streamlit.test",
      })
    )

    expect(window.location.hash).toEqual("#somehash")
  })

  it("can process a received SET_TOOLBAR_ITEMS message", () => {
    const dispatchEvent = mockEventListeners()
    const wrapper = mount(<TestComponent />)

    act(() => {
      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: S4A_COMM_VERSION,
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

    const props = wrapper.find(TestComponentNaked).prop("s4aCommunication")
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
    const dispatchEvent = mockEventListeners()
    const wrapper = mount(<TestComponent />)

    act(() => {
      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: S4A_COMM_VERSION,
            type: "SET_SIDEBAR_CHEVRON_DOWNSHIFT",
            sidebarChevronDownshift: 50,
          },
          origin: "http://devel.streamlit.test",
        })
      )
    })

    wrapper.update()

    const props = wrapper.find(TestComponentNaked).prop("s4aCommunication")
    expect(props.currentState.sidebarChevronDownshift).toBe(50)
  })

  describe("Test different origins", () => {
    it("exact pattern", () => {
      const dispatchEvent = mockEventListeners()

      mount(<TestComponent />)

      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: S4A_COMM_VERSION,
            type: "UPDATE_HASH",
            hash: "#somehash",
          },
          origin: "http://share.streamlit.io",
        })
      )

      expect(window.location.hash).toEqual("#somehash")
    })
    it("wildcard pattern", () => {
      const dispatchEvent = mockEventListeners()

      mount(<TestComponent />)

      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: S4A_COMM_VERSION,
            type: "UPDATE_HASH",
            hash: "#somehash",
          },
          origin: "http://cool-cucumber-fa9ds9f.streamlitapp.com",
        })
      )

      expect(window.location.hash).toEqual("#somehash")
    })
  })
})
