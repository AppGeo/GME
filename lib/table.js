'use strict';
var Promise = require('bluebird');
var auth = Promise.promisify(require('google-auth2-service-account').auth);
var scope = 'https://www.googleapis.com/auth/mapsengine';
var rawRequest = Promise.promisify(require('request'));
var Deque = require('double-ended-queue');
var fs = require('fs');
var Bulk = require('./bulk');
var limits = require('./limits.json');
var Stream = require('./stream');
var FeatureStream = require('./featureStream');
var readFile = Promise.promisify(fs.readFile, fs);
var TRUE = Promise.resolve(true);
module.exports = GME;
function GME(key, email, table, opts) {
  if (Buffer.isBuffer(key)) {
    this.key = Promise.resolve(key);
  } else {
    this.key = readFile(key);
  }
  if (typeof opts === 'string') {
    opts = {
      primary: opts
    };
  }
  this.iss = email;
  this.tableid = table;
  opts = opts || {};
  this.primary = opts.primary || 'gx_id';
  this.verbose = !!opts.verbose;
  this.nogeo = !!opts.nogeo;
  this.stopOnError = !!opts.stopOnError;
  if (opts.trace) {
    this.trace = opts.trace;
  } else {
    this.trace = false;
  }
  this.baseurl = 'https://www.googleapis.com/mapsengine/v1/';
  this.queue = new Deque();
  this.inProgress = false;
  if (opts.limits && typeof opts.limits === 'object') {
    this.limits = opts.limits;
  } else if (typeof opts.limits === 'string') {
    if (limits[opts.limits]) {
      this.limits = limits[opts.limits];
    }
  }
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
    return self.auth().then(function (auth) {
      opts.headers = {
        Authorization: 'Bearer ' + auth
      };
      return self._request(opts);
    }).catch(function (err) {
      if (tries++ > 10 || [401, 403, 429].indexOf(err.code) === -1 || self.stopOnError) {
        var error = new Error(err.message);
        error.code = err.code;
        error.errors = err.errors;
        if (self.verbose) {
          if (self.nogeo) {
            try {
              opts.body.features = opts.body.features.map(function (feature) {
                delete feature.geometry;
                return feature;
              });
            } catch(e) {}
          }
          console.log(new Date());
          console.log(err);
          console.log(JSON.stringify(opts, false, 4));
        }
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
      iss: self.iss,
      scope: scope
    }).then(function (token) {
      if (self.timeout) {
        clearTimeout(self.timeout);
        self.timeout = null;
      }
      self.token = token;
      self.timeout = setTimeout(function () {
        self.token = null;
        self.timeout = null;
      }, 5 * 60 * 1000);
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
  if (this.trace) {
    qs.trace = this.trace;
  }

  return self.request({
    url: url,
    qs: qs,
    json: true
  });
};
GME.prototype.post = function (url, body) {
  url = this.baseurl + url;
  var self = this;
  var opts = {
    url: url,

    body: body,
    json: true,
    method: 'POST'
  };
  if (self.trace) {
    opts.qs = {
      trace: self.trace
    };
  }
  return self.request(opts);
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
  if (this.verbose && arr.length) {
    console.log(new Date());
    console.log('create', arr.length);
    arr.forEach(function (item) {
      console.log(item.properties[this.primary]);
    }, this);
  }
  if (!arr.length) {
    return TRUE;
  }
  return this.post('tables/' + this.tableid + '/features/batchInsert', {features: arr});
};
GME.prototype.update = function(arr) {
  if (this.verbose && arr.length) {
    console.log(new Date());
    console.log('update', arr.length);
  }
  if (!arr.length) {
    return TRUE;
  }
  return this.post('tables/' + this.tableid + '/features/batchPatch', {features: arr});
};
GME.prototype.remove = function(arr) {
  if (this.verbose && arr.length) {
    console.log(new Date());
    console.log('remove', arr.length);
    arr.forEach(function (item) {
      console.log(item);
    }, this);
    console.log(this.tableid);
  }
  if (!arr.length) {
    return TRUE;
  }
  var self = this;
  function makeQuery(item) {
    var query = {where: 'GLOBALID=\'' + item + '\''};
    return self.features(query).then(function (resp) {
      if (!resp.features.length) {
        return item;
      }
      console.log(item, resp.features[0].properties.gx_id);
      return resp.features[0].properties.gx_id || item;
    });
  }
  return Promise.all(arr.map(makeQuery)).then(function (arr) {
    return self.post('tables/' + self.tableid + '/features/batchDelete', {primaryKeys: arr});
  });
};

GME.prototype.bulk = function() {
  return new Bulk(this);
};
GME.prototype.writeStream = function() {
  return new Stream(this);
};
