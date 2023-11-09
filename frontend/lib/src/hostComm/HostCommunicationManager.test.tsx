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

import HostCommunicationManager, {
  HOST_COMM_VERSION,
} from "@streamlit/lib/src/hostComm/HostCommunicationManager"

// Mocking "message" event listeners on the window;
// returns function to establish a listener
function mockEventListeners(): (type: string, event: any) => void {
  const listeners: { [name: string]: ((event: Event) => void)[] } = {}

  window.addEventListener = jest.fn((event: string, cb: any) => {
    listeners[event] = listeners[event] || []
    listeners[event].push(cb)
  })

  return (type: string, event: Event): void =>
    listeners[type].forEach(cb => cb(event))
}

describe("HostCommunicationManager messaging", () => {
  let hostCommunicationMgr: HostCommunicationManager

  let dispatchEvent: (type: string, event: Event) => void
  let originalHash: string

  let setAllowedOriginsFunc: jest.SpyInstance
  let openCommFunc: jest.SpyInstance
  let sendMessageToHostFunc: jest.SpyInstance

  beforeEach(() => {
    hostCommunicationMgr = new HostCommunicationManager({
      themeChanged: jest.fn(),
      sendRerunBackMsg: jest.fn(),
      pageChanged: jest.fn(),
      closeModal: jest.fn(),
      stopScript: jest.fn(),
      rerunScript: jest.fn(),
      clearCache: jest.fn(),
      isOwnerChanged: jest.fn(),
      hostMenuItemsChanged: jest.fn(),
      hostToolbarItemsChanged: jest.fn(),
      hostHideSidebarNavChanged: jest.fn(),
      sidebarChevronDownshiftChanged: jest.fn(),
      pageLinkBaseUrlChanged: jest.fn(),
      queryParamsChanged: jest.fn(),
      deployedAppMetadataChanged: jest.fn(),
    })

    originalHash = window.location.hash
    dispatchEvent = mockEventListeners()

    setAllowedOriginsFunc = jest.spyOn(
      hostCommunicationMgr,
      "setAllowedOrigins"
    )
    openCommFunc = jest.spyOn(hostCommunicationMgr, "openHostCommunication")
    sendMessageToHostFunc = jest.spyOn(
      hostCommunicationMgr,
      "sendMessageToHost"
    )

    hostCommunicationMgr.setAllowedOrigins({
      allowedOrigins: ["https://devel.streamlit.test"],
      useExternalAuthToken: false,
    })
  })

  afterEach(() => {
    window.location.hash = originalHash
  })

  it("sets allowedOrigins properly & opens HostCommunication", () => {
    expect(setAllowedOriginsFunc).toHaveBeenCalledWith({
      allowedOrigins: ["https://devel.streamlit.test"],
      useExternalAuthToken: false,
    })
    // @ts-expect-error
    expect(hostCommunicationMgr.allowedOrigins).toEqual([
      "https://devel.streamlit.test",
    ])
    expect(openCommFunc).toHaveBeenCalledWith()
  })

  it("host should receive a GUEST_READY message", () => {
    expect(sendMessageToHostFunc).toHaveBeenCalledWith({ type: "GUEST_READY" })
  })

  it("can process a received CLOSE_MODAL message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "CLOSE_MODAL",
        },
        origin: "https://devel.streamlit.test",
      })
    )
    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.closeModal).toHaveBeenCalledWith()
  })

  it("can process a received STOP_SCRIPT message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "STOP_SCRIPT",
        },
        origin: "https://devel.streamlit.test",
      })
    )
    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.stopScript).toHaveBeenCalledWith()
  })

  it("can process a received RERUN_SCRIPT message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "RERUN_SCRIPT",
        },
        origin: "https://devel.streamlit.test",
      })
    )
    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.rerunScript).toHaveBeenCalledWith()
  })

  it("can process a received CLEAR_CACHE message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "CLEAR_CACHE",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.clearCache).toHaveBeenCalledWith()
  })

  it("can process a received REQUEST_PAGE_CHANGE message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "REQUEST_PAGE_CHANGE",
          pageScriptHash: "hash1",
        },
        origin: "https://devel.streamlit.test",
      })
    )
    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.pageChanged).toHaveBeenCalledWith(
      "hash1"
    )
  })

  it("should respond to SET_IS_OWNER message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_IS_OWNER",
          isOwner: true,
        },
        origin: "https://devel.streamlit.test",
      })
    )
    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.isOwnerChanged).toHaveBeenCalledWith(
      true
    )
  })

  it("should respond to SET_MENU_ITEMS message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_MENU_ITEMS",
          items: [{ type: "separator" }],
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.hostMenuItemsChanged
    ).toHaveBeenCalledWith([{ type: "separator" }])
  })

  it("should respond to SET_METADATA message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_METADATA",
          metadata: { hostedAt: "maya", owner: "corgi", repo: "streamlit" },
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.deployedAppMetadataChanged
    ).toHaveBeenCalledWith({
      hostedAt: "maya",
      owner: "corgi",
      repo: "streamlit",
    })
  })

  it("can process a received SET_PAGE_LINK_BASE_URL message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_PAGE_LINK_BASE_URL",
          pageLinkBaseUrl: "https://share.streamlit.io/vdonato/foo/bar",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.pageLinkBaseUrlChanged
    ).toHaveBeenCalledWith("https://share.streamlit.io/vdonato/foo/bar")
  })

  it("can process a received SET_SIDEBAR_CHEVRON_DOWNSHIFT message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_SIDEBAR_CHEVRON_DOWNSHIFT",
          sidebarChevronDownshift: 50,
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.sidebarChevronDownshiftChanged
    ).toHaveBeenCalledWith(50)
  })

  it("can process a received SET_SIDEBAR_NAV_VISIBILITY message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_SIDEBAR_NAV_VISIBILITY",
          hidden: true,
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.hostHideSidebarNavChanged
    ).toHaveBeenCalledWith(true)
  })

  it("can process a received SET_TOOLBAR_ITEMS message", () => {
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
        origin: "https://devel.streamlit.test",
      })
    )

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.hostToolbarItemsChanged
    ).toHaveBeenCalledWith([
      {
        borderless: true,
        icon: "star.svg",
        key: "favorite",
        label: "",
      },
    ])
  })

  it("should respond to UPDATE_HASH message", () => {
    expect(window.location.hash).toEqual("")

    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "UPDATE_HASH",
          hash: "#somehash",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(window.location.hash).toEqual("#somehash")
  })

  it("can process a received UPDATE_FROM_QUERY_PARAMS message", () => {
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "UPDATE_FROM_QUERY_PARAMS",
          queryParams: "foo=bar",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.queryParamsChanged).toHaveBeenCalledWith(
      "foo=bar"
    )
    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.sendRerunBackMsg).toHaveBeenCalledWith()
  })

  it("can process a received SET_CUSTOM_THEME_CONFIG message", async () => {
    const mockCustomThemeConfig = {
      primaryColor: "#1A6CE7",
      backgroundColor: "#FFFFFF",
      secondaryBackgroundColor: "#F5F5F5",
      textColor: "#1A1D21",
      widgetBackgroundColor: "#FFFFFF",
      widgetBorderColor: "#D3DAE8",
    }
    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_CUSTOM_THEME_CONFIG",
          themeInfo: mockCustomThemeConfig,
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.themeChanged
    ).toHaveBeenCalledWith(mockCustomThemeConfig)
  })
})

describe("Test different origins", () => {
  let hostCommunicationMgr: HostCommunicationManager
  let dispatchEvent: any

  beforeEach(() => {
    hostCommunicationMgr = new HostCommunicationManager({
      themeChanged: jest.fn(),
      sendRerunBackMsg: jest.fn(),
      pageChanged: jest.fn(),
      closeModal: jest.fn(),
      stopScript: jest.fn(),
      rerunScript: jest.fn(),
      clearCache: jest.fn(),
      isOwnerChanged: jest.fn(),
      hostMenuItemsChanged: jest.fn(),
      hostToolbarItemsChanged: jest.fn(),
      hostHideSidebarNavChanged: jest.fn(),
      sidebarChevronDownshiftChanged: jest.fn(),
      pageLinkBaseUrlChanged: jest.fn(),
      queryParamsChanged: jest.fn(),
      deployedAppMetadataChanged: jest.fn(),
    })

    dispatchEvent = mockEventListeners()
  })

  afterEach(() => {
    window.location.hash = ""
  })

  it("exact pattern", () => {
    hostCommunicationMgr.setAllowedOrigins({
      allowedOrigins: ["http://share.streamlit.io"],
      useExternalAuthToken: false,
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
    hostCommunicationMgr.setAllowedOrigins({
      allowedOrigins: ["http://*.streamlitapp.com"],
      useExternalAuthToken: false,
    })

    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "UPDATE_HASH",
          hash: "#otherhash",
        },
        origin: "http://cool-cucumber-fa9ds9f.streamlitapp.com",
      })
    )

    expect(window.location.hash).toEqual("#otherhash")
  })

  it("ignores non-matching origins", () => {
    hostCommunicationMgr.setAllowedOrigins({
      allowedOrigins: ["http://share.streamlit.io"],
      useExternalAuthToken: false,
    })

    dispatchEvent(
      "message",
      new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "UPDATE_HASH",
          hash: "#corgi",
        },
        origin: "http://example.com",
      })
    )

    expect(window.location.hash).toEqual("")
  })
})

describe("HostCommunicationManager external auth token handling", () => {
  let hostCommunicationMgr: HostCommunicationManager

  beforeEach(() => {
    hostCommunicationMgr = new HostCommunicationManager({
      themeChanged: jest.fn(),
      sendRerunBackMsg: jest.fn(),
      pageChanged: jest.fn(),
      closeModal: jest.fn(),
      stopScript: jest.fn(),
      rerunScript: jest.fn(),
      clearCache: jest.fn(),
      isOwnerChanged: jest.fn(),
      hostMenuItemsChanged: jest.fn(),
      hostToolbarItemsChanged: jest.fn(),
      hostHideSidebarNavChanged: jest.fn(),
      sidebarChevronDownshiftChanged: jest.fn(),
      pageLinkBaseUrlChanged: jest.fn(),
      queryParamsChanged: jest.fn(),
      deployedAppMetadataChanged: jest.fn(),
    })
  })

  it("resolves promise to undefined immediately if useExternalAuthToken is false", async () => {
    const setAllowedOriginsFunc = jest.spyOn(
      hostCommunicationMgr,
      "setAllowedOrigins"
    )

    hostCommunicationMgr.setAllowedOrigins({
      allowedOrigins: ["http://devel.streamlit.test"],
      useExternalAuthToken: false,
    })

    expect(setAllowedOriginsFunc).toHaveBeenCalled()
    // @ts-expect-error - deferredAuthToken is private
    await expect(hostCommunicationMgr.deferredAuthToken.promise).resolves.toBe(
      undefined
    )
  })

  it("waits to receive SET_AUTH_TOKEN message before resolving promise if useExternalAuthToken is true", async () => {
    const dispatchEvent = mockEventListeners()

    hostCommunicationMgr.setAllowedOrigins({
      allowedOrigins: ["http://devel.streamlit.test"],
      useExternalAuthToken: true,
    })
    // Asynchronously send a SET_AUTH_TOKEN message to the
    // HostCommunicationManager, which won't proceed past the `await`
    // statement below until the message is received and handled.
    setTimeout(() => {
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

    // @ts-expect-error - deferredAuthToken is private
    await expect(hostCommunicationMgr.deferredAuthToken.promise).resolves.toBe(
      "i am an auth token"
    )

    // Reset the auth token and do everything again to confirm that we don't
    // incorrectly resolve to an old value after resetAuthToken is called.
    hostCommunicationMgr.resetAuthToken()

    // Simulate the browser tab disconnecting and reconnecting, which from the
    // HostCommunication's perspective is only seen as a new call to
    // setAllowedOrigins.
    hostCommunicationMgr.setAllowedOrigins({
      allowedOrigins: ["http://devel.streamlit.test"],
      useExternalAuthToken: true,
    })

    setTimeout(() => {
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

    // @ts-expect-error - deferredAuthToken is private
    await expect(hostCommunicationMgr.deferredAuthToken.promise).resolves.toBe(
      "i am a NEW auth token"
    )
  })
})
