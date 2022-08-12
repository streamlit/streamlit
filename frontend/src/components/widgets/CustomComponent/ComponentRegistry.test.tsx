import { BaseUriParts } from "src/lib/UriUtil"
import { ComponentRegistry } from "./ComponentRegistry"

const MOCK_SERVER_URI = {
  host: "streamlit.mock",
  port: 80,
  basePath: "",
}

describe("ComponentRegistry", () => {
  test("Constructs component URLs", () => {
    const registry = new ComponentRegistry(() => MOCK_SERVER_URI)
    const url = registry.getComponentURL("foo", "index.html")
    expect(url).toEqual("http://streamlit.mock:80/component/foo/index.html")
  })

  test("Caches server URI", () => {
    // If we never connect to a server, getComponentURL will fail:
    let serverURI: BaseUriParts | undefined
    const registry = new ComponentRegistry(() => serverURI)
    expect(() => registry.getComponentURL("foo", "index.html")).toThrow()

    // But if we connect once, and then disconnect, our original URI should
    // be cached.

    // "Connect" to the server
    serverURI = MOCK_SERVER_URI
    expect(registry.getComponentURL("foo", "index.html")).toEqual(
      "http://streamlit.mock:80/component/foo/index.html"
    )

    // "Disconnect" from the server, and call getComponentURL again;
    // it should return a URL constructed from the cached server URI.
    serverURI = undefined
    expect(registry.getComponentURL("bar", "index.html")).toEqual(
      "http://streamlit.mock:80/component/bar/index.html"
    )
  })

  test("Dispatches messages to listeners", () => {
    const registry = new ComponentRegistry(() => MOCK_SERVER_URI)
    // @ts-ignore
    const { onMessageEvent } = registry

    // Create some mocks
    const msgSource1: any = {}
    const msgSource2: any = {}
    const msgListener1 = jest.fn()
    const msgListener2 = jest.fn()

    // This should not error (and will not be handled).
    onMessageEvent(new MessageEvent("message", { source: msgSource1 }))

    // Register a listener for message events from the window.
    registry.registerListener(msgSource1, msgListener1)

    // Send a message to the registry. It should be re-dispatched
    // to our listener.
    const messageData = {
      isStreamlitMessage: true,
      type: "setComponentValue",
    }
    onMessageEvent(
      new MessageEvent("message", { source: msgSource1, data: messageData })
    )
    expect(msgListener1).toBeCalledWith(messageData.type, messageData)

    // Send a message that's missing data. It should *not* be re-dispatched.
    msgListener1.mockReset()
    onMessageEvent(new MessageEvent("message", { source: msgSource1 }))
    expect(msgListener1).not.toBeCalled()

    // De-register our listener. Messages should not be re-dispatched.
    msgListener1.mockReset()
    registry.deregisterListener(msgSource1)
    onMessageEvent(
      new MessageEvent("message", { source: msgSource1, data: messageData })
    )
    expect(msgListener1).not.toBeCalled()

    // Ensure that listeners only receive messages for their own source.
    registry.registerListener(msgSource1, msgListener1)
    registry.registerListener(msgSource2, msgListener2)

    msgListener1.mockReset()
    msgListener2.mockReset()
    onMessageEvent(
      new MessageEvent("message", { source: msgSource1, data: messageData })
    )
    expect(msgListener1).toBeCalledWith(messageData.type, messageData)
    expect(msgListener2).not.toBeCalled()

    msgListener1.mockReset()
    msgListener2.mockReset()
    onMessageEvent(
      new MessageEvent("message", { source: msgSource2, data: messageData })
    )
    expect(msgListener1).not.toBeCalled()
    expect(msgListener2).toBeCalledWith(messageData.type, messageData)
  })
})
