/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 *
 * @fileoverview Utility functions for dealing with immutable protobuf objects.
 */

import { fromJS } from 'immutable'
import { IS_DEV_ENV } from './baseconsts'
// import { logMessage } from './log'

/**
 * Converts a protobuf JS object into its immutable counterpart.
 */
export function toImmutableProto(messageType, message) {
  const x = messageType.toObject(message, {
    defaults: true,
    oneofs: true,
  })
  if (IS_DEV_ENV) {
    // logMessage('Protobuf: ', x)
  }
  return fromJS(x)
}

/**
 * Applies a function based on the type of a protobuf oneof field.
 *
 * obj   - The immutable protobuf object we're applying this to.
 * name  - The name of the oneof field.
 * funcs - Dictionary of functions, one for each oneof field.
 */
export function dispatchOneOf(obj, name, funcs) {
  const whichOne = obj.get(name)
  if (whichOne in funcs) {
    return funcs[whichOne](obj.get(whichOne))
  } else {
    throw new Error(`Cannot handle ${name} "${whichOne}".`)
  }
}

/**
 * Updates a oneof field of an immutable protobuf based on its type.
 *
 * obj   - The immutable protobuf object we're applying this to.
 * name  - The name of the oneof field.
 * funcs - Dictionary of update functions, one for each oneof field.
 */
export function updateOneOf(obj, name, funcs) {
  const whichOne = obj.get(name)
  if (whichOne in funcs) {
    return obj.update(whichOne, funcs[whichOne])
  } else {
    throw new Error(`Cannot handle ${name} "${whichOne}".`)
  }
}

/**
 * Returns a value based on the type of a protobuf oneof field.
 *
 * obj   - The immutable protobuf object we're applying this to.
 * name  - The name of the oneof field.
 * funcs - Dictionary of values, one for each oneof field.
 */
export function mapOneOf(obj, name, values) {
  const whichOne = obj.get(name)
  if (whichOne in values) {
    return values[whichOne]
  }

  throw new Error(`Cannot handle ${name} "${whichOne}".`)
}
