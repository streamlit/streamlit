/**
 * Utility functions for dealing with immutable protobuf objects.
 */

import { fromJS } from 'immutable';

/**
 * Converts a protobuf JS object into its immutable counterpart.
 */
export function toImmutableProto(messageType, message) {
  return fromJS(messageType.toObject(message, {
    defaults: true,
    oneofs: true,
  }));
}

/**
 * Applies a function based on the type of a protobuf oneof field.
 *
 * obj   - The immutable protobuf object we're applying this to.
 * name  - The name of the oneof field.
 * funcs - Dictionary of functions, one for each oneof field.
 */
export function dispatchOneOf(obj, name, funcs) {
  const whichOne = obj.get(name);
  if (whichOne in funcs)
    return funcs[whichOne](obj.get(whichOne));
  else
    throw new Error(`Cannot handle ${name} "${whichOne}".`);
}

/**
 * Updates a oneof field of an immutable protobuf based on its type.
 *
 * obj   - The immutable protobuf object we're applying this to.
 * name  - The name of the oneof field.
 * funcs - Dictionary of update functions, one for each oneof field.
 */
export function updateOneOf(obj, name, funcs) {
  const whichOne = obj.get(name);
  if (whichOne in funcs)
    return obj.update(whichOne, funcs[whichOne]);
  else
    throw new Error(`Cannot handle ${name} "${whichOne}".`);
}
