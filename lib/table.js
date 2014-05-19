'use strict';
var Promise = require('bluebird');
var auth = Promise.promisify(require('google-auth2-service-account').auth);
var scope = 'https://www.googleapis.com/auth/mapsengine';
var rawRequest = Promise.promisify(require('request'));
var Deque = require('double-ended-queue');
var fs = require('fs');
var Bulk = require('./bulk');
var Stream = require('./stream');
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
      if (tries++ > 4) {
        throw err;
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
  var opts = {};
  Object.keys(query).forEach(function (item) {
    opts[item] = query[item];
  });
  var out = {
    type: 'FeatureCollection',
    features: []
  };
  function getStuff() {
    return self.get('tables/' + self.tableid + '/features', opts).then(function (resp) {
     out.features = out.features.concat(resp.features);
     if (resp.nextPageToken) {
      opts.pageToken = resp.nextPageToken;
      return getStuff();
     } else {
      return out;
     }
    });
  }
  return getStuff();
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