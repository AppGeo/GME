'use strict';
var Promise = require('bluebird');
var auth = Promise.promisify(require('google-auth2-service-account').auth);
var scope = 'https://www.googleapis.com/auth/mapsengine';
var rawRequest = Promise.promisify(require('request'));
var Deque = require('double-ended-queue');
var fs = require('fs');
var Bulk = require('./bulk');
var Stream = require('./stream');
var FeatureStream = require('./featureStream');
var readFile = Promise.promisify(fs.readFile, fs);
var TRUE = Promise.resolve(true);
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
  this.queue = new Deque();
  this.inProgress = false;
}

GME.prototype._request = function (opts) {
  return rawRequest(opts).then(function (resp) {
    resp = resp[1];
    if (resp && resp.error) {
      throw resp.error;
    }
    return resp;
  });
};
GME.prototype.request = function (opts) {
  if (this.inProgress) {
    var resolver = Promise.defer();
    this.queue.push({
      resolver: resolver,
      opts: opts
    });
    return resolver.promise;
  }
  return this.createRequest(opts);
};
GME.prototype.createRequest = function (opts) {
  var self = this;
  this.inProgress = true;
  var tries = 1;
  function attemptDownload(){
    return self._request(opts).catch(function (err) {
      if (tries++ > 10) {
        var error = new Error(err.message);
        error.code = err.code;
        error.errors = err.errors;
        throw error;
      }
      return Promise.delay(tries * 1000).then(function () {
        return attemptDownload();
      });
    });
  }
  return attemptDownload().finally(function () {
    if (self.queue.length) {
      var next = self.queue.shift();
      next.resolver.resolve(self.createRequest(next.opts));
      return;
    }
    self.inProgress = false;
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
  var self = this;
  return new Promise(function (resolve, reject) {
    var out = {
      type: 'FeatureCollection',
      features: []
    };
    self.readStream(query).on('data', function (d) {
      out.features.push(d);
    }).on('finish', function () {
      resolve(out);
    }).on('error', reject);
  });
};
GME.prototype.featureStream = GME.prototype.readStream = function (query) {
  query = query || {};
  return new FeatureStream(this, query);
};
GME.prototype.feature = function (id) {
  return this.get('tables/' + this.tableid + '/features/' + id);
};
GME.prototype.create = function(arr) {
  if (!arr.length) {
    return TRUE;
  }
  return this.post('tables/' + this.tableid + '/features/batchInsert', {features: arr});
};
GME.prototype.update = function(arr) {
  if (!arr.length) {
    return TRUE;
  }
  return this.post('tables/' + this.tableid + '/features/batchPatch', {features: arr});
};
GME.prototype.remove = function(arr) {
  if (!arr.length) {
    return TRUE;
  }
  return this.post('tables/' + this.tableid + '/features/batchDelete', {gx_ids: arr});
};

GME.prototype.bulk = function() {
  return new Bulk(this);
};
GME.prototype.writeStream = function() {
  return new Stream(this);
};