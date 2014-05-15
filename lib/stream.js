'use strict';
var inherits = require('inherits');
var Writable = require('readable-stream').Writable;
var Promise = require('bluebird');

module.exports = WriteStream;
inherits(WriteStream, Writable);

function WriteStream(table) {
  Writable.call(this, {
    objectMode: true
  });
  var self = this;
  this._bulk = table.bulk();
  this.read();
  this._end = this.end;
  this.end = function(chunk, encoding, cb) {
    if (typeof chunk === 'function') {
      cb = chunk;
      chunk = null;
      encoding = null;
    } else if (typeof encoding === 'function') {
      cb = encoding;
      encoding = null;
    }
    if (typeof cb === 'function') {
      self.once('finish', cb);
    }
    if (chunk) {
      self.write(chunk, encoding, function (err) {
        if (err) {
          return self.emit('error', err);
        }
        self._flush(function (err) {
          if (err) {
            return self.emit('error', err);
          }
          self._end();
        });
      });
    } else {
      self._flush(function (err) {
        if (err) {
          return self.emit('error', err);
        }
        self._end();
      });
    }
  };
}
WriteStream.prototype._write = function (chunk, _, next) {
  var data;
  var methods = ['data', 'value', 'key'];
  methods.forEach(function (method) {
    if (typeof chunk[method] !== 'undefined') {
      data = chunk[method];
    }
  });
  var method = chunk.type;
  this._bulk[method](data).nodeify(next);
};
WriteStream.prototype._flush = function (next) {
  this._bulk.flush().nodeify(next);
};