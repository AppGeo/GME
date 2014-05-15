'use strict';
var test = require('tape');
test('gme', function (t) {
  var auth = require('google-auth2-service-account');
  auth.auth = function (key, opts, callback) {
    auth.test(key, opts);
    callback(null, [key, JSON.stringify(opts)]);
  };
  auth.test = function () {};

  var GME = require('./lib/index');
  GME.prototype.request = function (opts) {
    return opts;
  };

  t.test('moching should work', function (t) {
    var table = new GME(new Buffer('key'), 'email', 'table');
    t.plan(1);
    table.info().then(function (resp) {
      t.ok(true, 'gets called');
    });
  });
  t.test('basic', function (t) {
    var table = new GME(new Buffer('key'), 'email', 'table');
    t.plan(2);
    auth.test = function () {
      t.equals(arguments.length, 2, 'also gets called');
    };
    table.info().then(function (resp) {
      t.ok(true, 'gets called');
    });
  });
});
test('exit', function (t) {
  t.end();
  process.exit();
});