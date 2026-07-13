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

import { getLogger } from "loglevel"
import { v4 as uuidv4 } from "uuid"

import {
  BackendOperationRequest,
  IBackendOperationRequest,
  IBackendOperationResponse,
} from "@streamlit/protobuf"

const LOG = getLogger("BackendOperationClient")

/** Default timeout for backend operation requests (30 seconds). */
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

/** Timeout for deferred file requests (3 minutes). */
const DEFERRED_FILE_REQUEST_TIMEOUT_MS = 180_000

/**
 * Timeout for skills-install requests (3 minutes).
 *
 * The default 30s is too short here: a project-mode install is fast (it just
 * creates symlinks), but `streamlit skills` falls back to downloading the
 * skills archive from GitHub when symlinks aren't supported (e.g. Windows
 * without Developer Mode). That download can exceed 30s on a slow network,
 * which would surface a spurious "install failed" in the toast while the
 * server keeps installing. We use the same generous budget as deferred files.
 */
const INSTALL_SKILLS_REQUEST_TIMEOUT_MS = 180_000

/**
 * Rejection message used when pending requests are cleaned up on
 * disconnect/session reset. Exported so callers can match on it (e.g. App's
 * skills-install retry copy) without duplicating the literal.
 */
export const CONNECTION_CLOSED_MESSAGE = "Connection closed"

/** Rejection message used when a request exceeds its timeout. */
export const REQUEST_TIMED_OUT_MESSAGE = "Request timed out"

/**
 * Error a backend operation rejects with when the server returns a failure.
 * Carries the server's machine-readable `reason` (e.g. the skills-install
 * failure cause) alongside the human-readable message, so callers can route it
 * to telemetry without parsing the message text. Not exported: it is thrown
 * from within this module and consumers read the `reason` property structurally
 * (`(error as { reason?: string }).reason`) rather than via `instanceof`.
 */
class BackendOperationError extends Error {
  public readonly reason?: string

  constructor(message: string, reason?: string) {
    super(message)
    this.name = "BackendOperationError"
    this.reason = reason || undefined
  }
}

/** Information about a pending request. */
interface PendingRequest<T> {
  resolver: PromiseWithResolvers<T>
  timeoutId: ReturnType<typeof setTimeout>
  requestType: string
}

export interface BackendOperationClientProps {
  /** Function to send the request via BackMsg. */
  sendRequest: (request: BackendOperationRequest) => void

  /** Returns the current session ID. */
  getSessionId: () => string

  /** Optional default timeout in milliseconds. */
  timeoutMs?: number
}

/**
 * Client for managing backend operation request/response cycles.
 *
 * Handles server-side operations that don't require a script rerun,
 * such as lazy dataframe loading, server-side validation, and autocompletion.
 */
export class BackendOperationClient {
  private readonly sendRequest: (request: BackendOperationRequest) => void

  private readonly getSessionId: () => string

  private readonly timeoutMs: number

  /** Map of request ID to pending request data. */
  private readonly pendingRequests = new Map<string, PendingRequest<unknown>>()

  public constructor(props: BackendOperationClientProps) {
    this.sendRequest = props.sendRequest
    this.getSessionId = props.getSessionId
    this.timeoutMs = props.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  }

  /**
   * Send a backend operation request to the server.
   */
  public request<TResponse>(
    payloadField: keyof Pick<
      IBackendOperationRequest,
      "deferredFile" | "installSkills" | "dismissSkillsNudge"
    >,
    payload: IBackendOperationRequest[typeof payloadField],
    timeoutMs?: number
  ): Promise<TResponse> {
    const requestId = uuidv4()
    const effectiveTimeout = timeoutMs ?? this.timeoutMs

    const resolver = Promise.withResolvers<TResponse>()

    // Build session ID and request before registering, so any errors
    // (e.g., session not initialized) don't leave orphan pending requests
    let sessionId: string
    let request: BackendOperationRequest
    try {
      sessionId = this.getSessionId()
      request = new BackendOperationRequest({
        requestId,
        sessionId,
        [payloadField]: payload,
      })
    } catch (error) {
      resolver.reject(error)
      return resolver.promise
    }

    // eslint-disable-next-line no-restricted-globals -- Non-React class managing async request timeouts.
    const timeoutId = setTimeout(() => {
      this.handleTimeout(requestId)
    }, effectiveTimeout)

    this.pendingRequests.set(requestId, {
      resolver: resolver as PromiseWithResolvers<unknown>,
      timeoutId,
      requestType: payloadField,
    })

    try {
      this.sendRequest(request)
    } catch (error) {
      this.cleanupRequest(requestId)
      resolver.reject(error)
    }

    return resolver.promise
  }

  /**
   * Request a deferred file download.
   *
   * @param fileId - The ID of the deferred file to request
   * @param timeoutMs - Optional timeout override (default: 60s for large files)
   * @returns A promise that resolves with the file URL
   */
  public requestDeferredFile(
    fileId: string,
    timeoutMs?: number
  ): Promise<{ url: string }> {
    return this.request<{ url: string }>(
      "deferredFile",
      { fileId },
      timeoutMs ?? DEFERRED_FILE_REQUEST_TIMEOUT_MS
    )
  }

  /**
   * Request a one-click install of the bundled Streamlit agent skills.
   *
   * @returns A promise that resolves with an optional outcome detail, or
   * rejects with the server-provided error message on failure.
   */
  public requestInstallSkills(): Promise<{ detail?: string | null }> {
    return this.request<{ detail?: string | null }>(
      "installSkills",
      {},
      INSTALL_SKILLS_REQUEST_TIMEOUT_MS
    )
  }

  /**
   * Permanently dismiss the in-app "install skills" nudge. The server writes
   * a marker so the nudge is not shown again.
   *
   * @returns A promise that resolves once the dismissal has been persisted.
   */
  public requestDismissSkillsNudge(): Promise<unknown> {
    return this.request<unknown>("dismissSkillsNudge", {})
  }

  /**
   * Handle a response from the server. Called by App.tsx when a
   * BackendOperationResponse ForwardMsg is received.
   */
  public onResponse(response: IBackendOperationResponse): void {
    const requestId = response.requestId as string
    const pending = this.pendingRequests.get(requestId)

    if (!pending) {
      LOG.warn(`Received response for unknown request ${requestId}`)
      return
    }

    this.cleanupRequest(requestId)

    if (response.errorMsg) {
      pending.resolver.reject(
        new BackendOperationError(
          response.errorMsg,
          response.errorReason ?? undefined
        )
      )
    } else {
      try {
        const payload = this.extractResponsePayload(response)
        pending.resolver.resolve(payload)
      } catch (error) {
        pending.resolver.reject(error)
      }
    }
  }

  /**
   * Clean up all pending requests. Should be called on disconnect or
   * session reset to reject pending promises and prevent memory leaks.
   */
  public cleanup(): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutId)
      pending.resolver.reject(new Error(CONNECTION_CLOSED_MESSAGE))
      LOG.debug(`Cleaned up pending request ${requestId}`)
    }
    this.pendingRequests.clear()
  }

  /** Get the number of pending requests (useful for debugging/testing). */
  public get pendingCount(): number {
    return this.pendingRequests.size
  }

  private handleTimeout(requestId: string): void {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      LOG.warn(`Request ${requestId} (${pending.requestType}) timed out`)
      this.pendingRequests.delete(requestId)
      pending.resolver.reject(new Error(REQUEST_TIMED_OUT_MESSAGE))
    }
  }

  private cleanupRequest(requestId: string): void {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      clearTimeout(pending.timeoutId)
      this.pendingRequests.delete(requestId)
    }
  }

  private extractResponsePayload(
    response: IBackendOperationResponse
  ): unknown {
    // Return the first recognized non-null payload field
    if (response.deferredFile) return response.deferredFile
    if (response.installSkills) return response.installSkills
    if (response.dismissSkillsNudge) return response.dismissSkillsNudge

    LOG.warn("Response contained no recognized payload", response)
    throw new Error("Response contained no recognized payload")
  }
}
