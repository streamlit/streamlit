/**
 * @license
 * Copyright 2018 Streamlit Inc. All rights reserved.
 */

const format = require('./format');

test('class Duration constructor', () => {
    var duration = new format.Duration(1234);
    expect(duration.getTime()).toBe(1234);
});
