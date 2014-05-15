'use strict';
var Promise = require('bluebird');
var auth = Promise.promisify(require('google-auth2-service-account').auth);
var scope = 'https://www.googleapis.com/auth/mapsengine';
var rawRequest = Promise.promisify(require('request'));
var fs = require('fs');
var Bulk = require('./bulk');
var Stream = require('./stream');
var readFile = Promise.promisify(fs.readFile, fs);

module.exports = GME;
function GME(key, email, table) {
  if (Buffer.isBuffer(key)) {
    this.key = Promise.resolve(key);
  } else {
    this.key = readFile(key);
  }
  this.iss = email;
  this.scope = scope;
  this.tableid = table;
  this.baseurl = 'https://www.googleapis.com/mapsengine/v1/';
}

GME.prototype.request = function (opts) {
  return rawRequest(opts).then(function (resp) {
    return resp[1];
  });
};
GME.prototype.init = function () {
  var self = this;
  return this.key.then(function (key) {
    return auth(key, {
      iss:self.iss,
      scope:self.scope
    }).then(function (token) {
      if (self.timeout) {
        clearTimeout(self.timeout);
        self.timeout = null;
      }
      self.token = token;
      self.timeout = setTimeout(function () {
        self.token = null;
        self.timeout = null;
      }, 3600 * 1000);
      return token;
    });
  });
};
GME.prototype.auth = function () {
  if (this.token) {
    return Promise.resolve(this.token);
  } else {
    return this.init();
  }
};
GME.prototype.get = function (url, qs) {
  qs = qs || {};
  url = this.baseurl + url;
  var self = this;
  return this.auth().then(function (auth) {
    return self.request({
      url: url,
      headers: {
        Authorization: 'Bearer ' + auth
      },
      qs: qs,
      json: true
    });
  });
};
GME.prototype.post = function (url, body) {
  url = this.baseurl + url;
  var self = this;
  return this.auth().then(function (auth) {
    return self.request({
      url: url,
      headers: {
        Authorization: 'Bearer ' + auth
      },
      body: body,
      json: true,
      method: 'POST'
    });
  });
};
GME.prototype.info = function () {
  return this.get('tables/' + this.tableid);
};
GME.prototype.features = function (query) {
  return this.get('tables/' + this.tableid + '/features', query);
};
GME.prototype.feature = function (id) {
  return this.get('tables/' + this.tableid + '/features/' + id);
};
GME.prototype.create = function(arr) {
  return this.post('tables/' + this.tableid + '/features/batchInsert', {features: arr});
};
GME.prototype.update = function(arr) {
  return this.post('tables/' + this.tableid + '/features/batchPatch', {features: arr});
};
GME.prototype.remove = function(arr) {
  return this.post('tables/' + this.tableid + '/features/batchDelete', {gx_ids: arr});
};

GME.prototype.bulk = function() {
  return new Bulk(this);
};
GME.prototype.writeStream = function() {
  return new Stream(this);
};