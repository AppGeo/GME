'use strict';
var GME = module.exports = require('./table');
GME.createTable = function (key, email, requestObj) {
  var gme = new GME(key, email, 'foo');
  return gme.post('tables', requestObj);
};