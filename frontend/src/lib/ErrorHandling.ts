export function ensureError(err: unknown): Error {
  if (err instanceof Error) {
    return err
  }

  return new Error(`${err}`)
}
