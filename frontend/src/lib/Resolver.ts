/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */


/**
 * A promise wrapper that makes resolve/reject functions public.
 */
export default class Resolver<T> {
  public resolve: (arg?: T) => (void|Promise<any>)
  public reject: (reason?: any) => (void|Promise<any>)
  public promise: Promise<T>

  public constructor() {
    // Initialize to something so TS is happy.
    this.resolve = () => {}
    this.reject = () => {}

    this.promise = new Promise<T>((resFn, rejFn) => {
      this.resolve = resFn
      this.reject = rejFn
    })
  }
}
