/**
 * A promise wrapper that makes resolve/reject functions public.
 */
export default class Resolver<T> {
  public resolve: (value: T | PromiseLike<T>) => void

  public reject: (reason?: any) => void | Promise<any>

  public promise: Promise<T>

  constructor() {
    // Initialize to something so TS is happy.
    this.resolve = () => {}
    this.reject = () => {}

    this.promise = new Promise<T>((resFn, rejFn) => {
      this.resolve = resFn
      this.reject = rejFn
    })
  }
}
