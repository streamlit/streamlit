const create = require('./create');

module.exports = function (api, opts) {
    return create(api, Object.assign({ helpers: false }, opts), 'development');
};