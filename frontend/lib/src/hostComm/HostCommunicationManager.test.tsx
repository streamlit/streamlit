/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import "../../../utils/src/polyfills/index"

import { getLogger } from "loglevel"
import { MockInstance } from "vitest"

import HostCommunicationManager, {
  HOST_COMM_VERSION,
  IS_GUEST_TO_HOST_ECHO,
} from "~lib/hostComm/HostCommunicationManager"

interface MockEventListenersResult {
  dispatchEvent: (type: string, event: Event) => void
  getListenerCount: (type: string) => number
}

// Mocking "message" event listeners on the window;
// returns helpers to dispatch events and inspect listener counts
function mockEventListeners(): MockEventListenersResult {
  const listeners: { [name: string]: ((event: Event) => void)[] } = {}

  window.addEventListener = vi.fn(
    (event: string, cb: EventListenerOrEventListenerObject) => {
      listeners[event] = listeners[event] || []
      listeners[event].push(cb as EventListener)
    }
  )

  window.removeEventListener = vi.fn(
    (event: string, cb: EventListenerOrEventListenerObject) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(fn => fn !== cb)
      }
    }
  )

  return {
    dispatchEvent: (type: string, event: Event): void =>
      listeners[type]?.forEach(cb => cb(event)),
    getListenerCount: (type: string): number => listeners[type]?.length ?? 0,
  }
}

/**
 * Builds a trusted host `MessageEvent` originating from the direct parent
 * frame, matching what the browser delivers for legitimate host messages.
 *
 * `isTrusted` is intentionally hard-coded and is not part of
 * `MessageEventInit`, so callers cannot override it via `init`. Tests that
 * need an untrusted (script-dispatched) event construct `new MessageEvent(...)`
 * directly instead.
 */
function newHostMessageEvent(init: MessageEventInit): MessageEvent {
  return {
    origin: "",
    source: window.parent,
    ...init,
    isTrusted: true,
  } as unknown as MessageEvent
}

/**
 * Runs `fn` with `window.parent` replaced by a stub so `receiveHostMessage`
 * treats the app as embedded in a third-party iframe (`window !== window.parent`),
 * then restores the original `window.parent`. This mirrors the environment in
 * which an in-iframe embed preamble delivers host messages via a same-window
 * self-post (`event.source === window`). Supports both synchronous and async
 * `fn`, keeping the stub in place until an async `fn` settles.
 */
async function withEmbeddedWindow(
  fn: () => void | Promise<void>
): Promise<void> {
  const originalParent = window.parent
  Object.defineProperty(window, "parent", {
    value: { postMessage: vi.fn() },
    configurable: true,
  })
  try {
    await fn()
  } finally {
    Object.defineProperty(window, "parent", {
      value: originalParent,
      configurable: true,
    })
  }
}

describe("HostCommunicationManager messaging", () => {
  let hostCommunicationMgr: HostCommunicationManager

  let dispatchEvent: (type: string, event: Event) => void
  let getListenerCount: (type: string) => number
  let originalHash: string

  let setAllowedOriginsFunc: MockInstance
  let openCommFunc: MockInstance
  let sendMessageToHostFunc: MockInstance

  const countHostMessages = (type: string): number =>
    sendMessageToHostFunc.mock.calls.filter(
      (call: unknown[]) => (call[0] as { type: string }).type === type
    ).length

  beforeEach(() => {
    hostCommunicationMgr = new HostCommunicationManager({
      streamlitExecutionStartedAt: 100,
      themeChanged: vi.fn(),
      sendRerunBackMsg: vi.fn(),
      pageChanged: vi.fn(),
      closeModal: vi.fn(),
      stopScript: vi.fn(),
      rerunScript: vi.fn(),
      clearCache: vi.fn(),
      sendAppHeartbeat: vi.fn(),
      setInputsDisabled: vi.fn(),
      isOwnerChanged: vi.fn(),
      fileUploadClientConfigChanged: vi.fn(),
      hostMenuItemsChanged: vi.fn(),
      hostToolbarItemsChanged: vi.fn(),
      hostHideSidebarNavChanged: vi.fn(),
      sidebarChevronDownshiftChanged: vi.fn(),
      pageLinkBaseUrlChanged: vi.fn(),
      queryParamsChanged: vi.fn(),
      deployedAppMetadataChanged: vi.fn(),
      restartWebsocketConnection: vi.fn(),
      terminateWebsocketConnection: vi.fn(),
      printApp: vi.fn(),
    })

    originalHash = window.location.hash
    ;({ dispatchEvent, getListenerCount } = mockEventListeners())

    setAllowedOriginsFunc = vi.spyOn(hostCommunicationMgr, "setAllowedOrigins")
    openCommFunc = vi.spyOn(hostCommunicationMgr, "openHostCommunication")
    sendMessageToHostFunc = vi.spyOn(hostCommunicationMgr, "sendMessageToHost")

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
    expect(openCommFunc).toHaveBeenCalled()
  })

  it("host should receive a GUEST_READY message", () => {
    expect(sendMessageToHostFunc).toHaveBeenCalled()

    const guestReadyMessage = sendMessageToHostFunc.mock.calls[0][0]
    expect(guestReadyMessage).toHaveProperty("type", "GUEST_READY")
    expect(guestReadyMessage).toHaveProperty("streamlitExecutionStartedAt")
    expect(guestReadyMessage).toHaveProperty(
      "guestReadyAt",
      expect.any(Number)
    )
  })

  describe("GUEST_READY echo on open", () => {
    let postMessageSpy: MockInstance
    const originalParent = window.parent

    beforeEach(() => {
      postMessageSpy = vi.spyOn(window, "postMessage")
    })

    afterEach(() => {
      postMessageSpy.mockRestore()
      Object.defineProperty(window, "parent", {
        value: originalParent,
        configurable: true,
      })
    })

    it("dispatches on own window when embedded in an iframe", () => {
      const fakeParent = { postMessage: vi.fn() } as unknown as Window
      Object.defineProperty(window, "parent", {
        value: fakeParent,
        configurable: true,
      })

      hostCommunicationMgr.closeHostCommunication()
      postMessageSpy.mockClear()

      hostCommunicationMgr.setAllowedOrigins({
        allowedOrigins: ["https://devel.streamlit.test"],
        useExternalAuthToken: false,
      })

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          stCommVersion: HOST_COMM_VERSION,
          type: "GUEST_READY",
          streamlitExecutionStartedAt: expect.any(Number),
          guestReadyAt: expect.any(Number),
          [IS_GUEST_TO_HOST_ECHO]: true,
        }),
        "/"
      )
    })

    it("does not dispatch when not embedded (top-level window)", () => {
      hostCommunicationMgr.closeHostCommunication()
      postMessageSpy.mockClear()

      hostCommunicationMgr.setAllowedOrigins({
        allowedOrigins: ["https://devel.streamlit.test"],
        useExternalAuthToken: false,
      })

      const selfDispatchCalls = postMessageSpy.mock.calls.filter(
        ([, targetOrigin]) => targetOrigin === "/"
      )
      expect(selfDispatchCalls).toHaveLength(0)
    })

    it("does not dispatch when already open", () => {
      const fakeParent = { postMessage: vi.fn() } as unknown as Window
      Object.defineProperty(window, "parent", {
        value: fakeParent,
        configurable: true,
      })
      postMessageSpy.mockClear()

      hostCommunicationMgr.setAllowedOrigins({
        allowedOrigins: ["https://devel.streamlit.test"],
        useExternalAuthToken: false,
      })

      expect(postMessageSpy).not.toHaveBeenCalled()
    })

    it("re-dispatches after close and reopen", () => {
      const fakeParent = { postMessage: vi.fn() } as unknown as Window
      Object.defineProperty(window, "parent", {
        value: fakeParent,
        configurable: true,
      })

      hostCommunicationMgr.closeHostCommunication()
      postMessageSpy.mockClear()

      hostCommunicationMgr.setAllowedOrigins({
        allowedOrigins: ["https://devel.streamlit.test"],
        useExternalAuthToken: false,
      })

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GUEST_READY",
          [IS_GUEST_TO_HOST_ECHO]: true,
        }),
        "/"
      )
    })
  })

  it("only sends GUEST_READY once when setAllowedOrigins is called multiple times", () => {
    expect(countHostMessages("GUEST_READY")).toBe(1)
    expect(getListenerCount("message")).toBe(1)

    hostCommunicationMgr.setAllowedOrigins({
      allowedOrigins: ["https://devel.streamlit.test"],
      useExternalAuthToken: false,
    })

    expect(countHostMessages("GUEST_READY")).toBe(1)
    expect(getListenerCount("message")).toBe(1)
  })

  it("re-sends GUEST_READY after closeHostCommunication and a new setAllowedOrigins", () => {
    expect(countHostMessages("GUEST_READY")).toBe(1)
    expect(getListenerCount("message")).toBe(1)

    hostCommunicationMgr.closeHostCommunication()
    expect(getListenerCount("message")).toBe(0)

    hostCommunicationMgr.setAllowedOrigins({
      allowedOrigins: ["https://devel.streamlit.test"],
      useExternalAuthToken: false,
    })

    expect(countHostMessages("GUEST_READY")).toBe(2)
    expect(getListenerCount("message")).toBe(1)
  })

  describe("same-window guest-to-host echo", () => {
    let postMessageSpy: MockInstance

    beforeEach(() => {
      postMessageSpy = vi.spyOn(window, "postMessage")
    })

    afterEach(() => {
      postMessageSpy.mockRestore()
    })

    it("echoes guest messages to the app window when embedded", async () => {
      await withEmbeddedWindow(() => {
        postMessageSpy.mockClear()

        hostCommunicationMgr.sendMessageToHost({
          type: "SET_PAGE_TITLE",
          title: "Embedded title",
        })

        expect(window.parent.postMessage).toHaveBeenCalledWith(
          {
            stCommVersion: HOST_COMM_VERSION,
            type: "SET_PAGE_TITLE",
            title: "Embedded title",
          },
          "*"
        )
        expect(postMessageSpy).toHaveBeenCalledWith(
          {
            stCommVersion: HOST_COMM_VERSION,
            type: "SET_PAGE_TITLE",
            title: "Embedded title",
            [IS_GUEST_TO_HOST_ECHO]: true,
          },
          "/"
        )
      })
    })

    it("does not echo guest messages when not embedded", () => {
      postMessageSpy.mockClear()

      hostCommunicationMgr.sendMessageToHost({
        type: "SET_PAGE_TITLE",
        title: "Top-level title",
      })

      const sameWindowEchoCalls = postMessageSpy.mock.calls.filter(
        ([, targetOrigin]) => targetOrigin === "/"
      )
      expect(sameWindowEchoCalls).toHaveLength(0)
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_PAGE_TITLE",
          title: "Top-level title",
        },
        "*"
      )
    })

    it("does not echo same-origin guest messages when not embedded", () => {
      postMessageSpy.mockClear()

      hostCommunicationMgr.sendMessageToSameOriginHost({
        type: "REDIRECT_TO_URL",
        url: "https://example.com/next",
      })

      expect(postMessageSpy).toHaveBeenCalledTimes(1)
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          stCommVersion: HOST_COMM_VERSION,
          type: "REDIRECT_TO_URL",
          url: "https://example.com/next",
        },
        window.location.origin
      )
    })

    it("echoes same-origin guest messages to the app window when embedded", async () => {
      await withEmbeddedWindow(() => {
        postMessageSpy.mockClear()

        hostCommunicationMgr.sendMessageToSameOriginHost({
          type: "REDIRECT_TO_URL",
          url: "https://example.com/next",
        })

        expect(window.parent.postMessage).toHaveBeenCalledWith(
          {
            stCommVersion: HOST_COMM_VERSION,
            type: "REDIRECT_TO_URL",
            url: "https://example.com/next",
          },
          window.location.origin
        )
        expect(postMessageSpy).toHaveBeenCalledWith(
          {
            stCommVersion: HOST_COMM_VERSION,
            type: "REDIRECT_TO_URL",
            url: "https://example.com/next",
            [IS_GUEST_TO_HOST_ECHO]: true,
          },
          "/"
        )
      })
    })

    it("still echoes when posting to the parent throws", async () => {
      await withEmbeddedWindow(() => {
        postMessageSpy.mockClear()
        vi.mocked(window.parent.postMessage).mockImplementation(() => {
          throw new SyntaxError(
            "Failed to execute 'postMessage' on 'Window': Invalid target origin 'null'"
          )
        })

        expect(() => {
          hostCommunicationMgr.sendMessageToSameOriginHost({
            type: "REDIRECT_TO_URL",
            url: "https://example.com/next",
          })
        }).toThrow(SyntaxError)

        expect(postMessageSpy).toHaveBeenCalledWith(
          {
            stCommVersion: HOST_COMM_VERSION,
            type: "REDIRECT_TO_URL",
            url: "https://example.com/next",
            [IS_GUEST_TO_HOST_ECHO]: true,
          },
          "/"
        )
      })
    })

    it("does not execute an echoed UPDATE_HASH as a host command", async () => {
      await withEmbeddedWindow(() => {
        window.location.hash = "#unchanged"
        dispatchEvent(
          "message",
          newHostMessageEvent({
            data: {
              stCommVersion: HOST_COMM_VERSION,
              type: "UPDATE_HASH",
              hash: "#from-guest-echo",
              [IS_GUEST_TO_HOST_ECHO]: true,
            },
            origin: "https://devel.streamlit.test",
            source: window,
          })
        )

        expect(window.location.hash).toEqual("#unchanged")
      })
    })

    it("executes an untagged UPDATE_HASH self-post as a host command", async () => {
      await withEmbeddedWindow(() => {
        dispatchEvent(
          "message",
          newHostMessageEvent({
            data: {
              stCommVersion: HOST_COMM_VERSION,
              type: "UPDATE_HASH",
              hash: "#from-host-preamble",
            },
            origin: "https://devel.streamlit.test",
            source: window,
          })
        )

        expect(window.location.hash).toEqual("#from-host-preamble")
      })
    })

    it("executes a parent UPDATE_HASH even if the echo marker is set", async () => {
      await withEmbeddedWindow(() => {
        dispatchEvent(
          "message",
          newHostMessageEvent({
            data: {
              stCommVersion: HOST_COMM_VERSION,
              type: "UPDATE_HASH",
              hash: "#from-parent",
              [IS_GUEST_TO_HOST_ECHO]: true,
            },
            origin: "https://devel.streamlit.test",
          })
        )

        expect(window.location.hash).toEqual("#from-parent")
      })
    })

    it("executes a self-post when the echo marker is not boolean true", async () => {
      await withEmbeddedWindow(() => {
        dispatchEvent(
          "message",
          newHostMessageEvent({
            data: {
              stCommVersion: HOST_COMM_VERSION,
              type: "UPDATE_HASH",
              hash: "#truthy-flag",
              [IS_GUEST_TO_HOST_ECHO]: "true",
            },
            origin: "https://devel.streamlit.test",
            source: window,
          })
        )

        expect(window.location.hash).toEqual("#truthy-flag")
      })
    })

    it("executes a self-post when the echo marker is only inherited", async () => {
      await withEmbeddedWindow(() => {
        const data = Object.create({ [IS_GUEST_TO_HOST_ECHO]: true }) as {
          stCommVersion: number
          type: string
          hash: string
        }
        data.stCommVersion = HOST_COMM_VERSION
        data.type = "UPDATE_HASH"
        data.hash = "#inherited-flag"

        dispatchEvent(
          "message",
          newHostMessageEvent({
            data,
            origin: "https://devel.streamlit.test",
            source: window,
          })
        )

        expect(window.location.hash).toEqual("#inherited-flag")
      })
    })

    it("ignores an echoed SET_FILE_UPLOAD_CLIENT_CONFIG self-post", async () => {
      await withEmbeddedWindow(() => {
        dispatchEvent(
          "message",
          newHostMessageEvent({
            data: {
              stCommVersion: HOST_COMM_VERSION,
              type: "SET_FILE_UPLOAD_CLIENT_CONFIG",
              prefix: "https://evil.example/upload/",
              headers: {
                "X-Xsrftoken": "exfiltrated-token",
              },
              [IS_GUEST_TO_HOST_ECHO]: true,
            },
            origin: "https://devel.streamlit.test",
            source: window,
          })
        )

        expect(
          // @ts-expect-error - props are private
          hostCommunicationMgr.props.fileUploadClientConfigChanged
        ).not.toHaveBeenCalled()
      })
    })

    it("ignores a child-frame host command even if the echo marker is set", async () => {
      const iframe = document.createElement("iframe")
      document.body.appendChild(iframe)
      const childWindow = iframe.contentWindow
      if (!childWindow) {
        throw new Error("Expected iframe contentWindow")
      }

      try {
        await withEmbeddedWindow(() => {
          dispatchEvent(
            "message",
            newHostMessageEvent({
              data: {
                stCommVersion: HOST_COMM_VERSION,
                type: "SET_FILE_UPLOAD_CLIENT_CONFIG",
                prefix: "https://evil.example/upload/",
                headers: {
                  "X-Xsrftoken": "exfiltrated-token",
                },
                [IS_GUEST_TO_HOST_ECHO]: true,
              },
              origin: "https://devel.streamlit.test",
              source: childWindow,
            })
          )

          expect(
            // @ts-expect-error - props are private
            hostCommunicationMgr.props.fileUploadClientConfigChanged
          ).not.toHaveBeenCalled()
        })
      } finally {
        iframe.remove()
      }
    })
  })

  it("can process a received CLOSE_MODAL message", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "CLOSE_MODAL",
        },
        origin: "https://devel.streamlit.test",
      })
    )
    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.closeModal).toHaveBeenCalled()
  })

  it("can process a received STOP_SCRIPT message", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "STOP_SCRIPT",
        },
        origin: "https://devel.streamlit.test",
      })
    )
    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.stopScript).toHaveBeenCalled()
  })

  it("can process a received RERUN_SCRIPT message", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "RERUN_SCRIPT",
        },
        origin: "https://devel.streamlit.test",
      })
    )
    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.rerunScript).toHaveBeenCalled()
  })

  it("can process a received CLEAR_CACHE message", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "CLEAR_CACHE",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.clearCache).toHaveBeenCalled()
  })

  it("can process a received PRINT_APP message", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "PRINT_APP",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.printApp).toHaveBeenCalled()
  })

  it("can process a received REQUEST_PAGE_CHANGE message", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
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

  it("can process a received SEND_APP_HEARTBEAT message without ackTimeoutMilliseconds", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SEND_APP_HEARTBEAT",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.sendAppHeartbeat).toHaveBeenCalledWith(0)
  })

  it("can process a received SEND_APP_HEARTBEAT message with ackTimeoutMilliseconds", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SEND_APP_HEARTBEAT",
          ackTimeoutMilliseconds: 59000,
        },
        origin: "https://devel.streamlit.test",
      })
    )

    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.sendAppHeartbeat).toHaveBeenCalledWith(
      59000
    )
  })

  it("treats negative ackTimeoutMilliseconds as 0", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SEND_APP_HEARTBEAT",
          ackTimeoutMilliseconds: -1000,
        },
        origin: "https://devel.streamlit.test",
      })
    )

    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.sendAppHeartbeat).toHaveBeenCalledWith(0)
  })

  it("can process a received SET_INPUTS_DISABLED message", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_INPUTS_DISABLED",
          disabled: true,
        },
        origin: "https://devel.streamlit.test",
      })
    )

    // @ts-expect-error - props are private
    expect(hostCommunicationMgr.props.setInputsDisabled).toHaveBeenCalledWith(
      true
    )
  })

  it("should respond to SET_IS_OWNER message", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
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
      newHostMessageEvent({
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
      newHostMessageEvent({
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
      newHostMessageEvent({
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
      newHostMessageEvent({
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
      newHostMessageEvent({
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
      newHostMessageEvent({
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
      newHostMessageEvent({
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
      newHostMessageEvent({
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
    expect(hostCommunicationMgr.props.sendRerunBackMsg).toHaveBeenCalled()
  })

  it("can process a received SET_CUSTOM_THEME_CONFIG message", () => {
    const mockCustomThemeConfig = {
      primaryColor: "#1A6CE7",
      backgroundColor: "#FFFFFF",
      secondaryBackgroundColor: "#F5F5F5",
      textColor: "#1A1D21",
    }
    dispatchEvent(
      "message",
      newHostMessageEvent({
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
    ).toHaveBeenCalledWith(undefined, mockCustomThemeConfig)
  })

  it("can process a received SET_CUSTOM_THEME_CONFIG message with a dark theme name", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_CUSTOM_THEME_CONFIG",
          themeName: "Dark",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.themeChanged
    ).toHaveBeenCalledWith("Dark", undefined)
  })

  it("can process a received SET_CUSTOM_THEME_CONFIG message with a light theme name", () => {
    dispatchEvent(
      "message",
      newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_CUSTOM_THEME_CONFIG",
          themeName: "Light",
        },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.themeChanged
    ).toHaveBeenCalledWith("Light", undefined)
  })

  it("can process a received SET_FILE_UPLOAD_CLIENT_CONFIG message", () => {
    const message = newHostMessageEvent({
      data: {
        stCommVersion: HOST_COMM_VERSION,
        type: "SET_FILE_UPLOAD_CLIENT_CONFIG",
        prefix: "https://someprefix.com/hello/",
        headers: {
          header1: "header1value",
          header2: "header2value",
        },
      },
      origin: "https://devel.streamlit.test",
    })
    dispatchEvent("message", message)

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.fileUploadClientConfigChanged
    ).toHaveBeenCalledWith({
      prefix: "https://someprefix.com/hello/",
      headers: {
        header1: "header1value",
        header2: "header2value",
      },
    })
  })

  it("ignores messages from non-parent frames even when origin is allowed", () => {
    const iframe = document.createElement("iframe")
    document.body.appendChild(iframe)
    const childWindow = iframe.contentWindow

    if (!childWindow) {
      throw new Error("Expected iframe contentWindow")
    }

    try {
      const message = newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_FILE_UPLOAD_CLIENT_CONFIG",
          prefix: "https://evil.example/upload/",
          headers: {
            "X-Xsrftoken": "exfiltrated-token",
          },
        },
        origin: "https://devel.streamlit.test",
        source: childWindow,
      })
      dispatchEvent("message", message)

      expect(
        // @ts-expect-error - props are private
        hostCommunicationMgr.props.fileUploadClientConfigChanged
      ).not.toHaveBeenCalled()
    } finally {
      iframe.remove()
    }
  })

  it("processes messages from a genuine same-window self-post (in-iframe embed preamble)", async () => {
    // When embedded, window.parent is an untrusted third-party page, so the
    // in-iframe embed preamble delivers host messages by posting to this
    // window itself (event.source === window). Unlike a child frame (whose
    // source is the child's own window), a same-window self-post is a
    // legitimate delivery path and must be processed.
    await withEmbeddedWindow(() => {
      const message = newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_FILE_UPLOAD_CLIENT_CONFIG",
          prefix: "https://someprefix.com/hello/",
          headers: {
            header1: "header1value",
          },
        },
        origin: "https://devel.streamlit.test",
        source: window,
      })
      dispatchEvent("message", message)

      expect(
        // @ts-expect-error - props are private
        hostCommunicationMgr.props.fileUploadClientConfigChanged
      ).toHaveBeenCalledWith({
        prefix: "https://someprefix.com/hello/",
        headers: {
          header1: "header1value",
        },
      })
    })
  })

  it("ignores script-dispatched (untrusted) self-posts even when embedded", async () => {
    // The self-post exception must still be gated by event.isTrusted: a
    // synthetic (dispatchEvent) event with source === window must be rejected
    // so injected scripts cannot fabricate host commands.
    await withEmbeddedWindow(() => {
      const message = new MessageEvent("message", {
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_FILE_UPLOAD_CLIENT_CONFIG",
          prefix: "https://evil.example/upload/",
          headers: {
            "X-Xsrftoken": "exfiltrated-token",
          },
        },
        origin: "https://devel.streamlit.test",
        source: window,
      })
      // Guard the precondition so the test can only pass via the isTrusted
      // check: a natively constructed event is untrusted while its source is a
      // genuine same-window self-post and its origin is allowed.
      expect(message.isTrusted).toBe(false)
      dispatchEvent("message", message)

      expect(
        // @ts-expect-error - props are private
        hostCommunicationMgr.props.fileUploadClientConfigChanged
      ).not.toHaveBeenCalled()
    })
  })

  it("ignores self-posts from a disallowed origin even when embedded", async () => {
    // The self-post exception must not bypass the allowedOrigins check.
    await withEmbeddedWindow(() => {
      const message = newHostMessageEvent({
        data: {
          stCommVersion: HOST_COMM_VERSION,
          type: "SET_FILE_UPLOAD_CLIENT_CONFIG",
          prefix: "https://evil.example/upload/",
          headers: {
            "X-Xsrftoken": "exfiltrated-token",
          },
        },
        origin: "https://not-allowed.example",
        source: window,
      })
      dispatchEvent("message", message)

      expect(
        // @ts-expect-error - props are private
        hostCommunicationMgr.props.fileUploadClientConfigChanged
      ).not.toHaveBeenCalled()
    })
  })

  it("ignores script-dispatched host messages even when source and origin match", () => {
    const message = new MessageEvent("message", {
      data: {
        stCommVersion: HOST_COMM_VERSION,
        type: "SET_FILE_UPLOAD_CLIENT_CONFIG",
        prefix: "https://evil.example/upload/",
        headers: {
          "X-Xsrftoken": "exfiltrated-token",
        },
      },
      origin: "https://devel.streamlit.test",
      source: window.parent,
    })
    // Guard the test preconditions so it can only pass by exercising the
    // `!event.isTrusted` check: a natively constructed event is untrusted while
    // its source and origin are otherwise valid.
    expect(message.isTrusted).toBe(false)
    expect(message.source).toBe(window.parent)
    dispatchEvent("message", message)

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.fileUploadClientConfigChanged
    ).not.toHaveBeenCalled()
  })

  it("ignores host messages with a null source even when origin is allowed", () => {
    const message = newHostMessageEvent({
      data: {
        stCommVersion: HOST_COMM_VERSION,
        type: "SET_FILE_UPLOAD_CLIENT_CONFIG",
        prefix: "https://evil.example/upload/",
        headers: {
          "X-Xsrftoken": "exfiltrated-token",
        },
      },
      origin: "https://devel.streamlit.test",
      source: null,
    })
    dispatchEvent("message", message)

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.fileUploadClientConfigChanged
    ).not.toHaveBeenCalled()
  })

  it("logs a debug message when a genuine host message is rejected by the guards", () => {
    const debugSpy = vi
      .spyOn(getLogger("HostCommunicationManager"), "debug")
      .mockImplementation(() => {})

    const message = new MessageEvent("message", {
      data: {
        stCommVersion: HOST_COMM_VERSION,
        type: "SET_FILE_UPLOAD_CLIENT_CONFIG",
        prefix: "https://evil.example/upload/",
        headers: {
          "X-Xsrftoken": "exfiltrated-token",
        },
      },
      origin: "https://devel.streamlit.test",
      source: window.parent,
    })
    dispatchEvent("message", message)

    // Args mirror the LOG.debug call: isTrusted, sourceIsParent, selfPost,
    // allowedOrigin, origin. The event is untrusted (script-constructed) but
    // its source is the parent (not a self-post) and its origin is allowed, so
    // only the isTrusted guard fails.
    expect(debugSpy).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("Ignoring host message"),
      false,
      true,
      false,
      true,
      "https://devel.streamlit.test"
    )
    debugSpy.mockRestore()
  })

  it("does not log a debug message for non-host postMessages", () => {
    const debugSpy = vi
      .spyOn(getLogger("HostCommunicationManager"), "debug")
      .mockImplementation(() => {})

    dispatchEvent(
      "message",
      newHostMessageEvent({
        data: { some: "unrelated-message" },
        origin: "https://devel.streamlit.test",
      })
    )

    expect(debugSpy).not.toHaveBeenCalled()
    debugSpy.mockRestore()
  })

  it("does not log a debug message for tagged guest-to-host echoes", async () => {
    const debugSpy = vi
      .spyOn(getLogger("HostCommunicationManager"), "debug")
      .mockImplementation(() => {})

    try {
      await withEmbeddedWindow(() => {
        dispatchEvent(
          "message",
          newHostMessageEvent({
            data: {
              stCommVersion: HOST_COMM_VERSION,
              type: "SET_PAGE_TITLE",
              title: "echo",
              [IS_GUEST_TO_HOST_ECHO]: true,
            },
            origin: "https://devel.streamlit.test",
            source: window,
          })
        )

        expect(debugSpy).not.toHaveBeenCalled()
      })
    } finally {
      debugSpy.mockRestore()
    }
  })

  it("logs a debug message for a dropped untagged self-post", async () => {
    const debugSpy = vi
      .spyOn(getLogger("HostCommunicationManager"), "debug")
      .mockImplementation(() => {})

    try {
      // A dropped same-window self-post that is not a tagged guest-to-host echo
      // (here a SET_AUTH_TOKEN from a disallowed origin) must still be logged so
      // an in-iframe embed preamble's delivery problems remain diagnosable.
      await withEmbeddedWindow(() => {
        dispatchEvent(
          "message",
          newHostMessageEvent({
            data: {
              stCommVersion: HOST_COMM_VERSION,
              type: "SET_AUTH_TOKEN",
              authToken: "dropped token",
            },
            origin: "https://not-allowed.example",
            source: window,
          })
        )

        expect(debugSpy).toHaveBeenCalled()
      })
    } finally {
      debugSpy.mockRestore()
    }
  })

  it("can process a received RESTART_WEBSOCKET_CONNECTION message", () => {
    const message = newHostMessageEvent({
      data: {
        stCommVersion: HOST_COMM_VERSION,
        type: "RESTART_WEBSOCKET_CONNECTION",
      },
      origin: "https://devel.streamlit.test",
    })
    dispatchEvent("message", message)

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.restartWebsocketConnection
    ).toHaveBeenCalled()
  })

  it("can process a received TERMINATE_WEBSOCKET_CONNECTION message", () => {
    const message = newHostMessageEvent({
      data: {
        stCommVersion: HOST_COMM_VERSION,
        type: "TERMINATE_WEBSOCKET_CONNECTION",
      },
      origin: "https://devel.streamlit.test",
    })
    dispatchEvent("message", message)

    expect(
      // @ts-expect-error - props are private
      hostCommunicationMgr.props.terminateWebsocketConnection
    ).toHaveBeenCalled()
  })
})

describe("Test different origins", () => {
  let hostCommunicationMgr: HostCommunicationManager
  let dispatchEvent: MockEventListenersResult["dispatchEvent"]

  beforeEach(() => {
    hostCommunicationMgr = new HostCommunicationManager({
      streamlitExecutionStartedAt: 100,
      themeChanged: vi.fn(),
      sendRerunBackMsg: vi.fn(),
      pageChanged: vi.fn(),
      closeModal: vi.fn(),
      stopScript: vi.fn(),
      rerunScript: vi.fn(),
      clearCache: vi.fn(),
      sendAppHeartbeat: vi.fn(),
      setInputsDisabled: vi.fn(),
      fileUploadClientConfigChanged: vi.fn(),
      isOwnerChanged: vi.fn(),
      hostMenuItemsChanged: vi.fn(),
      hostToolbarItemsChanged: vi.fn(),
      hostHideSidebarNavChanged: vi.fn(),
      sidebarChevronDownshiftChanged: vi.fn(),
      pageLinkBaseUrlChanged: vi.fn(),
      queryParamsChanged: vi.fn(),
      deployedAppMetadataChanged: vi.fn(),
      restartWebsocketConnection: vi.fn(),
      terminateWebsocketConnection: vi.fn(),
      printApp: vi.fn(),
    })
    ;({ dispatchEvent } = mockEventListeners())
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
      newHostMessageEvent({
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
      newHostMessageEvent({
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
      newHostMessageEvent({
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
      streamlitExecutionStartedAt: 100,
      themeChanged: vi.fn(),
      sendRerunBackMsg: vi.fn(),
      pageChanged: vi.fn(),
      closeModal: vi.fn(),
      stopScript: vi.fn(),
      rerunScript: vi.fn(),
      clearCache: vi.fn(),
      sendAppHeartbeat: vi.fn(),
      setInputsDisabled: vi.fn(),
      fileUploadClientConfigChanged: vi.fn(),
      isOwnerChanged: vi.fn(),
      hostMenuItemsChanged: vi.fn(),
      hostToolbarItemsChanged: vi.fn(),
      hostHideSidebarNavChanged: vi.fn(),
      sidebarChevronDownshiftChanged: vi.fn(),
      pageLinkBaseUrlChanged: vi.fn(),
      queryParamsChanged: vi.fn(),
      deployedAppMetadataChanged: vi.fn(),
      restartWebsocketConnection: vi.fn(),
      terminateWebsocketConnection: vi.fn(),
      printApp: vi.fn(),
    })
  })

  it("resolves promise to undefined immediately if useExternalAuthToken is false", async () => {
    const setAllowedOriginsFunc = vi.spyOn(
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
    const { dispatchEvent } = mockEventListeners()

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
        newHostMessageEvent({
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
        newHostMessageEvent({
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

  it("resolves the auth token from a genuine same-window self-post when embedded (in-iframe embed preamble)", async () => {
    const { dispatchEvent } = mockEventListeners()

    // Simulate being embedded in a third-party page: window.parent is not a
    // trusted relay, so the in-iframe embed preamble delivers SET_AUTH_TOKEN
    // by posting to this window itself (event.source === window).
    await withEmbeddedWindow(async () => {
      hostCommunicationMgr.setAllowedOrigins({
        allowedOrigins: ["http://devel.streamlit.test"],
        useExternalAuthToken: true,
      })

      setTimeout(() => {
        dispatchEvent(
          "message",
          newHostMessageEvent({
            data: {
              stCommVersion: HOST_COMM_VERSION,
              type: "SET_AUTH_TOKEN",
              authToken: "self-posted auth token",
            },
            origin: "http://devel.streamlit.test",
            source: window,
          })
        )
      })

      await expect(
        // @ts-expect-error - deferredAuthToken is private
        hostCommunicationMgr.deferredAuthToken.promise
      ).resolves.toBe("self-posted auth token")
    })
  })
})
