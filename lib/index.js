'use strict';
var GME = module.exports = require('./table');
GME.createTable = function (key, email, requestObj, opts) {
  var gme = new GME(key, email, 'foo', opts);
  return gme.post('tables', requestObj);
};