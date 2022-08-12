import { fromJS, Map } from "immutable"

/**
 * Converts a protobuf JS object into its immutable counterpart.
 */
export function toImmutableProto(messageType: any, message: any): any {
  const x = messageType.toObject(message, {
    defaults: true,
    oneofs: true,
  })
  return fromJS(x)
}

/**
 * Applies a function based on the type of a protobuf oneof field.
 *
 * obj   - The immutable protobuf object we're applying this to.
 * name  - The name of the oneof field.
 * funcs - Dictionary of functions, one for each oneof field. Optionally, you
 * may pass a key-value pair {'_else': errorFunc} to handle the case where there
 * is no match. If such a function is not passed, we throw an error if there's
 * no match.
 */

export function dispatchOneOf(
  obj: Map<string, any>,
  name: string,
  funcs: any
): any {
  const whichOne = obj.get(name)
  if (whichOne in funcs) {
    return funcs[whichOne](obj.get(whichOne))
  }
  // eslint-disable-next-line no-underscore-dangle
  if (funcs._else) {
    // eslint-disable-next-line no-underscore-dangle
    return funcs._else()
  }
  throw new Error(`Cannot handle ${name} "${whichOne}".`)
}

/**
 * Updates a oneof field of an immutable protobuf based on its type.
 *
 * obj   - The immutable protobuf object we're applying this to.
 * name  - The name of the oneof field.
 * funcs - Dictionary of update functions, one for each oneof field.
 */
export function updateOneOf(
  obj: Map<string, any>,
  name: string,
  funcs: any
): any {
  const whichOne = obj.get(name)
  if (whichOne in funcs) {
    return obj.update(whichOne, funcs[whichOne])
  }
  throw new Error(`Cannot handle ${name} "${whichOne}".`)
}

/**
 * Returns a value based on the type of a protobuf oneof field.
 *
 * obj   - The immutable protobuf object we're applying this to.
 * name  - The name of the oneof field.
 * values - Dictionary of values, one for each oneof field.
 */
export function mapOneOf(
  obj: Map<string, any>,
  name: string,
  values: any
): any {
  const whichOne = obj.get(name)
  if (whichOne in values) {
    return values[whichOne]
  }

  throw new Error(`Cannot handle ${name} "${whichOne}".`)
}
