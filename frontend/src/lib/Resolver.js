/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */


/**
 * A promise wrapper that makes resolve/reject functions public.
 */
export default class Resolver {
  constructor() {
    this.resolve = null;
    this.reject = null;
    this.promise = new Promise((resFn, rejFn) => {
      this.resolve = resFn;
      this.reject = rejFn;
    });
  }
}
