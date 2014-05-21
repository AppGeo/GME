'use strict';
var inherits = require('inherits');
var Transform = require('readable-stream').Transform;

inherits(FeatureStream, Transform);
module.exports = FeatureStream;
function FeatureStream(table, query) {
  Transform.call(this, {
    objectMode: true
  });
  this.table = table;
  this.opts = {};
  Object.keys(query).forEach(function (item) {
    this.opts[item] = query[item];
  }, this);
  this.write(false);
}
FeatureStream.prototype._transform = function (chunk, _, next) {
  var self = this;
  if (chunk) {
    self.opts.pageToken = chunk;
  }
  self.table.get('tables/' + self.table.tableid + '/features', self.opts).then(function (resp) {
    resp.features.forEach(function (item) {
      this.push(item);
    }, self);
    if (resp.nextPageToken) {
      self.write(resp.nextPageToken);
      next();
    } else {
      next();
      process.nextTick(function () {
        self.end();
      });
    }
  }, next);
};