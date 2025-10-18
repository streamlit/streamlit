/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { Writer } from "protobufjs"

import {
  Block as BlockProto,
  Element,
  ForwardMsgMetadata,
  IArrowVegaLiteChart,
} from "@streamlit/protobuf"

import { UNICODE } from "~lib/mocks/arrow"
import { isNullOrUndefined } from "~lib/util/utils"

import { AppNode, NO_SCRIPT_RUN_ID } from "./AppNode.interface"
import { BlockNode } from "./BlockNode"
import { ElementNode } from "./ElementNode"

export const FAKE_SCRIPT_HASH = "fake_script_hash"

/** Create a `Text` element node with the given properties. */
export function text(
  textArg: string,
  scriptRunId = NO_SCRIPT_RUN_ID
): ElementNode {
  const element = makeProto(Element, { text: { body: textArg } })
  return new ElementNode(
    element,
    ForwardMsgMetadata.create(),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
}

/** Create a BlockNode with the given properties. */
export function block(
  children: AppNode[] = [],
  scriptRunId = NO_SCRIPT_RUN_ID
): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    makeProto(BlockProto, {}),
    scriptRunId
  )
}

/** Create an arrowTable element node with the given properties. */
export function arrowTable(scriptRunId = NO_SCRIPT_RUN_ID): ElementNode {
  const element = makeProto(Element, { arrowTable: { data: UNICODE } })
  return new ElementNode(
    element,
    ForwardMsgMetadata.create(),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
}

/** Create an arrowDataFrame element node with the given properties. */
export function arrowDataFrame(scriptRunId = NO_SCRIPT_RUN_ID): ElementNode {
  const element = makeProto(Element, { arrowDataFrame: { data: UNICODE } })
  return new ElementNode(
    element,
    ForwardMsgMetadata.create(),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
}

/** Create an arrowVegaLiteChart element node with the given properties. */
export function arrowVegaLiteChart(
  data: IArrowVegaLiteChart,
  scriptRunId = NO_SCRIPT_RUN_ID
): ElementNode {
  const element = makeProto(Element, { arrowVegaLiteChart: data })
  return new ElementNode(
    element,
    ForwardMsgMetadata.create(),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
}

/** Create a ForwardMsgMetadata with the given container and path */
export function forwardMsgMetadata(
  deltaPath: number[],
  activeScriptHash = FAKE_SCRIPT_HASH
): ForwardMsgMetadata {
  expect(deltaPath.length).toBeGreaterThanOrEqual(2)
  return makeProto(ForwardMsgMetadata, { deltaPath, activeScriptHash })
}

/**
 * Make a "fully concrete" instance of a protobuf message.
 * This function constructs a message and then encodes and decodes it as
 * if it had arrived on the wire. This ensures that that it has all its
 * 'oneOfs' and 'defaults' set.
 */
export function makeProto<Type, Props>(
  MessageType: {
    new (props: Props): Type
    encode: (message: Type, writer: Writer) => Writer
    decode: (bytes: Uint8Array) => Type
  },
  properties: Props
): Type {
  const message = new MessageType(properties)
  const bytes = MessageType.encode(message, Writer.create()).finish()
  return MessageType.decode(bytes)
}

// Custom Jest matchers for dealing with AppNodes
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace vi {
    interface Matchers<R> {
      toBeTextNode(text: string): R
    }
  }
}

interface CustomMatchers<R = unknown> {
  toBeTextNode(text: string): R
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type -- TODO: Replace 'any' with a more specific type.
  interface Assertion<T = any> extends CustomMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  toBeTextNode(received, textArg) {
    const elementNode = received as ElementNode
    if (isNullOrUndefined(elementNode)) {
      return {
        message: () => `expected ${received} to be an instance of ElementNode`,
        pass: false,
      }
    }

    const { type } = elementNode.element
    if (type !== "text") {
      return {
        message: () =>
          `expected ${received}.element.type to be 'text', but it was ${type}`,
        pass: false,
      }
    }

    const textBody = elementNode.element.text?.body
    return {
      message: () =>
        `expected ${received}.element.text.body to be "${textArg}", but it was "${textBody}"`,
      pass: textBody === textArg,
    }
  },
})
