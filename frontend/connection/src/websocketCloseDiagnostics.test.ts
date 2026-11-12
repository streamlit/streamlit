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

import { ConnectionState } from "./ConnectionState"
import {
  formatWebsocketCloseLog,
  getWebsocketCloseCodeLabel,
  isNormalWebsocketClosure,
  MISSING_WEBSOCKET_CLOSE_REASON,
  sanitizeWebsocketCloseReason,
  WEBSOCKET_NORMAL_CLOSURE_CODE,
} from "./websocketCloseDiagnostics"

describe("isNormalWebsocketClosure", () => {
  it("is true only for a clean RFC 6455 normal closure", () => {
    expect(isNormalWebsocketClosure(WEBSOCKET_NORMAL_CLOSURE_CODE, true)).toBe(
      true
    )
    expect(
      isNormalWebsocketClosure(WEBSOCKET_NORMAL_CLOSURE_CODE, false)
    ).toBe(false)
    expect(isNormalWebsocketClosure(1006, true)).toBe(false)
    expect(isNormalWebsocketClosure(1006, false)).toBe(false)
  })
})

describe("getWebsocketCloseCodeLabel", () => {
  it.each([
    [1000, "normal closure"],
    [1002, "protocol error"],
    [1006, "abnormal closure"],
    [1009, "message too big"],
    [1011, "internal server error"],
  ])("labels %i as %s", (code, label) => {
    expect(getWebsocketCloseCodeLabel(code)).toBe(label)
  })

  it("labels unrecognized codes as unknown", () => {
    expect(getWebsocketCloseCodeLabel(3999)).toBe("unknown")
  })
})

describe("sanitizeWebsocketCloseReason", () => {
  it.each(["", "   ", "\n\t", "\u0000"])(
    "uses a placeholder when the reason is empty or not printable (%j)",
    reason => {
      expect(sanitizeWebsocketCloseReason(reason)).toBe(
        MISSING_WEBSOCKET_CLOSE_REASON
      )
    }
  )

  it("keeps a human-readable server reason", () => {
    expect(sanitizeWebsocketCloseReason("Internal server error")).toBe(
      "Internal server error"
    )
  })

  it("replaces control characters with spaces instead of joining words", () => {
    expect(sanitizeWebsocketCloseReason("Going\naway")).toBe("Going away")
  })

  it("redacts a URL even when a newline precedes the scheme", () => {
    const sanitized = sanitizeWebsocketCloseReason(
      "see\nhttps://secret.example/a"
    )
    expect(sanitized).toBe("see [redacted]")
    expect(sanitized).not.toContain("secret.example")
  })

  it("redacts a JWT even when a newline precedes the token", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.signaturevalue"
    const sanitized = sanitizeWebsocketCloseReason(`auth\n${jwt}`)
    expect(sanitized).toBe("auth [redacted]")
    expect(sanitized).not.toContain(jwt)
    expect(sanitized).not.toContain("eyJzdWIiOiIxMjM0In0")
  })

  it("rewrites double quotes so the reason log field stays intact", () => {
    expect(sanitizeWebsocketCloseReason('say "hi"')).toBe("say 'hi'")
  })

  it("redacts URLs so full connection locations never reach the console", () => {
    const sanitized = sanitizeWebsocketCloseReason(
      "failed at https://app.example.com/_stcore/stream?token=secret"
    )
    expect(sanitized).toContain("[redacted]")
    expect(sanitized).not.toContain("https://")
    expect(sanitized).not.toContain("app.example.com")
    expect(sanitized).not.toContain("secret")
  })

  it("redacts session IDs, JWTs, and long token-like strings", () => {
    const sessionId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.signaturevalue"
    const token = "a".repeat(40)
    const sanitized = sanitizeWebsocketCloseReason(
      `session=${sessionId} auth=${jwt} token=${token}`
    )

    expect(sanitized).toContain("[redacted]")
    expect(sanitized).not.toContain(sessionId)
    expect(sanitized).not.toContain(jwt)
    expect(sanitized).not.toContain(token)
  })

  it("preserves version numbers and dotted diagnostic text", () => {
    expect(
      sanitizeWebsocketCloseReason("Unsupported protocol version 1.2.3")
    ).toBe("Unsupported protocol version 1.2.3")
    expect(sanitizeWebsocketCloseReason("failed.to.connect")).toBe(
      "failed.to.connect"
    )
    expect(sanitizeWebsocketCloseReason("host.example.com")).toBe(
      "host.example.com"
    )
    expect(sanitizeWebsocketCloseReason("connection.reset.by.peer")).toBe(
      "connection.reset.by.peer"
    )
  })

  it("redacts long tokens that end in base64 padding", () => {
    const paddedOnce = `${"a".repeat(31)}=`
    const paddedTwice = `${"a".repeat(30)}==`
    const sanitized = sanitizeWebsocketCloseReason(
      `token=${paddedOnce} other=${paddedTwice}`
    )

    expect(sanitized).toContain("[redacted]")
    expect(sanitized).not.toContain(paddedOnce)
    expect(sanitized).not.toContain(paddedTwice)
  })

  it("redacts long tokens that start with a non-word character", () => {
    const leadingPlus = `+${"a".repeat(31)}`
    const leadingSlash = `/${"a".repeat(31)}`
    const sanitized = sanitizeWebsocketCloseReason(
      `token=${leadingPlus} other=${leadingSlash}`
    )

    expect(sanitized).toContain("[redacted]")
    expect(sanitized).not.toContain(leadingPlus)
    expect(sanitized).not.toContain(leadingSlash)
  })
})

describe("formatWebsocketCloseLog", () => {
  it("includes close code, sanitized reason, wasClean, and connection state", () => {
    const message = formatWebsocketCloseLog(
      { code: 1006, reason: "", wasClean: false },
      ConnectionState.CONNECTED
    )

    expect(message).toBe(
      `WebSocket onclose: code=1006 (abnormal closure), ` +
        `reason="${MISSING_WEBSOCKET_CLOSE_REASON}", wasClean=false, ` +
        `state=${ConnectionState.CONNECTED}`
    )
  })

  it("formats a clean normal closure with the same field layout", () => {
    const message = formatWebsocketCloseLog(
      {
        code: WEBSOCKET_NORMAL_CLOSURE_CODE,
        reason: "Going away",
        wasClean: true,
      },
      ConnectionState.CONNECTING
    )

    expect(message).toBe(
      `WebSocket onclose: code=1000 (normal closure), ` +
        `reason="Going away", wasClean=true, ` +
        `state=${ConnectionState.CONNECTING}`
    )
  })
})
