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

import type { ConnectionState } from "./ConnectionState"

/**
 * Placeholder logged when the close frame has no usable reason string.
 * Distinguishes "the server sent nothing" from a redacted sensitive value.
 */
export const MISSING_WEBSOCKET_CLOSE_REASON = "(no close reason)"

const REDACTED_CLOSE_REASON = "[redacted]"

/** RFC 6455 normal closure. */
export const WEBSOCKET_NORMAL_CLOSURE_CODE = 1000

/** RFC 6455 close-code labels for browser-console diagnostics. */
const WEBSOCKET_CLOSE_CODE_LABELS: Record<number, string> = {
  1000: "normal closure",
  1001: "going away",
  1002: "protocol error",
  1003: "unsupported data",
  1005: "no status received",
  1006: "abnormal closure",
  1007: "invalid frame payload",
  1008: "policy violation",
  1009: "message too big",
  1010: "mandatory extension",
  1011: "internal server error",
  1012: "service restart",
  1013: "try again later",
  1014: "bad gateway",
  1015: "TLS handshake failure",
}

const CONTROL_CHARS_RE = /\p{Cc}+/gu
const URL_RE = /\b(?:https?|wss?):\/\/\S+/gi
const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
/** Compact JWT form starts with a base64url `{"` header (`eyJ`). */
const JWT_RE = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g
const LONG_TOKEN_RE = /\b[A-Za-z0-9+/=_-]{32,}/g

/**
 * True when the close is a clean RFC 6455 normal closure (code 1000 with wasClean).
 */
export function isNormalWebsocketClosure(
  code: number,
  wasClean: boolean
): boolean {
  return code === WEBSOCKET_NORMAL_CLOSURE_CODE && wasClean
}

/**
 * Redact a close reason before writing it to the browser console:
 * - Empty reasons become {@link MISSING_WEBSOCKET_CLOSE_REASON}
 * - URLs, UUIDs, JWTs, and long token-like strings are replaced with "[redacted]"
 * - Double quotes are rewritten so the reason="..." field stays intact
 */
export function sanitizeWebsocketCloseReason(reason: string): string {
  const sanitized = reason
    .replace(CONTROL_CHARS_RE, "")
    .replace(URL_RE, REDACTED_CLOSE_REASON)
    .replace(UUID_RE, REDACTED_CLOSE_REASON)
    .replace(JWT_RE, REDACTED_CLOSE_REASON)
    .replace(LONG_TOKEN_RE, REDACTED_CLOSE_REASON)
    .replaceAll('"', "'")
    .trim()

  return sanitized === "" ? MISSING_WEBSOCKET_CLOSE_REASON : sanitized
}

/** RFC 6455 label for `code`, or "unknown" when the code is unrecognized. */
export function getWebsocketCloseCodeLabel(code: number): string {
  return WEBSOCKET_CLOSE_CODE_LABELS[code] ?? "unknown"
}

/**
 * Format a WebSocket close summary for the browser console only.
 * Callers must not forward this string through sendClientError or telemetry.
 */
export function formatWebsocketCloseLog(
  event: Pick<CloseEvent, "code" | "reason" | "wasClean">,
  connectionState: ConnectionState
): string {
  const { code, reason, wasClean } = event
  const label = getWebsocketCloseCodeLabel(code)
  const sanitizedReason = sanitizeWebsocketCloseReason(reason)
  return (
    `WebSocket onclose: code=${code} (${label}), ` +
    `reason="${sanitizedReason}", wasClean=${wasClean}, ` +
    `state=${connectionState}`
  )
}
