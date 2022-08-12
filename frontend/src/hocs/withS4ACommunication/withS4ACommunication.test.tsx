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

  it("can process a received SET_SIDEBAR_NAV_VISIBILITY message", () => {
    const dispatchEvent = mockEventListeners()
    const wrapper = mount(<TestComponent />)

    act(() => {
      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: S4A_COMM_VERSION,
            type: "SET_SIDEBAR_NAV_VISIBILITY",
            hidden: true,
          },
          origin: "http://devel.streamlit.test",
        })
      )
    })

    wrapper.update()

    const props = wrapper.find(TestComponentNaked).prop("s4aCommunication")
    expect(props.currentState.hideSidebarNav).toBe(true)
  })

  it("can process a received REQUEST_PAGE_CHANGE message", () => {
    const dispatchEvent = mockEventListeners()
    const wrapper = mount(<TestComponent />)

    act(() => {
      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: S4A_COMM_VERSION,
            type: "REQUEST_PAGE_CHANGE",
            pageScriptHash: "hash1",
          },
          origin: "http://devel.streamlit.test",
        })
      )
    })
    wrapper.update()

    const innerComponent = wrapper.find(TestComponentNaked)
    const props = innerComponent.prop("s4aCommunication")
    expect(props.currentState.requestedPageScriptHash).toBe("hash1")

    act(() => {
      innerComponent.prop("s4aCommunication").onPageChanged()
    })
    wrapper.update()

    const innerComponent2 = wrapper.find(TestComponentNaked)
    const props2 = innerComponent2.prop("s4aCommunication")
    expect(props2.currentState.requestedPageScriptHash).toBe(null)
  })

  it("can process a received SET_PAGE_LINK_BASE_URL message", () => {
    const dispatchEvent = mockEventListeners()
    const wrapper = mount(<TestComponent />)

    act(() => {
      dispatchEvent(
        "message",
        new MessageEvent("message", {
          data: {
            stCommVersion: S4A_COMM_VERSION,
            type: "SET_PAGE_LINK_BASE_URL",
            pageLinkBaseUrl: "https://share.streamlit.io/vdonato/foo/bar",
          },
          origin: "http://devel.streamlit.test",
        })
      )
    })

    wrapper.update()

    const props = wrapper.find(TestComponentNaked).prop("s4aCommunication")
    expect(props.currentState.pageLinkBaseUrl).toBe(
      "https://share.streamlit.io/vdonato/foo/bar"
    )
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
