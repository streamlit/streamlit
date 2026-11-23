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

import { describe, expect, it } from "vitest"

import {
  ForwardMsg,
  ForwardMsgMetadata,
  RunIdentity as RunIdentityProto,
} from "@streamlit/protobuf"

import { getFinishedRun, getRunIdentity } from "./runIdentity"

describe("getRunIdentity", () => {
  it("returns the identity of a full-app run", () => {
    const metadata = new ForwardMsgMetadata({
      run: new RunIdentityProto({ scriptRunId: "run_id" }),
    })

    expect(getRunIdentity(metadata)).toEqual({
      scriptRunId: "run_id",
      fragmentIds: [],
    })
  })

  it("returns the identity of a fragment run after a wire round trip", () => {
    const encoded = ForwardMsg.encode(
      new ForwardMsg({
        newSession: {},
        metadata: {
          run: { scriptRunId: "run_id", fragmentIds: ["outer", "inner"] },
        },
      })
    ).finish()
    const { metadata } = ForwardMsg.decode(encoded)

    expect(getRunIdentity(metadata as ForwardMsgMetadata)).toEqual({
      scriptRunId: "run_id",
      fragmentIds: ["outer", "inner"],
    })
  })

  it.each([
    ["metadata is undefined", undefined],
    ["metadata is null", null],
    ["run is missing", new ForwardMsgMetadata({ deltaPath: [0, 1] })],
    [
      "scriptRunId is missing",
      new ForwardMsgMetadata({ run: { fragmentIds: ["fragment"] } }),
    ],
    [
      "scriptRunId is empty",
      new ForwardMsgMetadata({ run: { scriptRunId: "" } }),
    ],
  ])("returns undefined when %s", (_description, metadata) => {
    expect(getRunIdentity(metadata)).toBeUndefined()
  })
})

describe("getFinishedRun", () => {
  it("cleans up every fragment when all output was delivered", () => {
    const metadata = new ForwardMsgMetadata({
      run: { scriptRunId: "run_id", fragmentIds: ["outer", "inner"] },
    })

    expect(getFinishedRun(metadata)).toEqual({
      scriptRunId: "run_id",
      fragmentIds: ["outer", "inner"],
      droppedFragmentIds: new Set(),
      cleanupFragmentIds: ["outer", "inner"],
    })
  })

  it("cleans up a full-app run with an empty fragment list", () => {
    const metadata = new ForwardMsgMetadata({
      run: { scriptRunId: "run_id" },
    })

    expect(getFinishedRun(metadata)?.cleanupFragmentIds).toEqual([])
  })

  it("leaves dropped fragments out of cleanup after a wire round trip", () => {
    const encoded = ForwardMsg.encode(
      new ForwardMsg({
        scriptFinished:
          ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY,
        metadata: {
          run: { scriptRunId: "run_id", fragmentIds: ["outer", "inner"] },
          delivery: { droppedFragmentIds: ["inner"] },
        },
      })
    ).finish()
    const { metadata } = ForwardMsg.decode(encoded)

    expect(getFinishedRun(metadata as ForwardMsgMetadata)).toEqual({
      scriptRunId: "run_id",
      fragmentIds: ["outer", "inner"],
      droppedFragmentIds: new Set(["inner"]),
      cleanupFragmentIds: ["outer"],
    })
  })

  it("has no cleanup scope when every fragment's output was dropped", () => {
    const metadata = new ForwardMsgMetadata({
      run: { scriptRunId: "run_id", fragmentIds: ["frag"] },
      delivery: { droppedFragmentIds: ["frag"] },
    })

    const finishedRun = getFinishedRun(metadata)

    expect(finishedRun?.fragmentIds).toEqual(["frag"])
    expect(finishedRun?.cleanupFragmentIds).toBeUndefined()
  })

  it("returns undefined without run identity, even with a delivery", () => {
    const metadata = new ForwardMsgMetadata({
      delivery: { droppedFragmentIds: ["frag"] },
    })

    expect(getFinishedRun(metadata)).toBeUndefined()
  })
})
