'use strict';
var countVerticies = require('./countVerticies');
var Promise = require('bluebird');
var FEATURE_LIMIT = 50;
var CREATE_VERTEX_LIMIT = 2000;
var UPDATE_VERTEX_LIMIT = 10000;
var TRUE = Promise.resolve(true);
function ddup(array, comp) {
  comp = comp || function (i) {return i;};
  var cache = [];
  return array.filter(function (item) {
    var v = comp(item);
    if (~~cache.indexOf(v)) {
      cache.push(v);
      return true;
    }
  });
}
module.exports = Bulk;
function Bulk(table) {
  this.table = table;
  this.createQueue = [];
  this.createVertices = 0;
  this.updateQueue = [];
  this.updateVerticies = 0;
  this.removeQueue = [];
}

Bulk.prototype.create = function (item, verticies) {
  verticies = verticies || countVerticies(item.geometry);
  var self = this;
  if (verticies !== verticies) {
    return Promise.reject(new TypeError('Unsuported Geometry Type'));
  }
  var out;
  if (verticies > CREATE_VERTEX_LIMIT) {
    return Promise.reject(new RangeError('too many verticies'));
  } else if(this.createVertices + verticies > CREATE_VERTEX_LIMIT) {
    return this.flush().then(function () {
      return self.create(item, verticies);
    });
  } else {
    this.createVertices += verticies;
    if (this.createQueue.push(item) === FEATURE_LIMIT) {
      return this.flush();
    }
  }
  return TRUE;
};

Bulk.prototype.update = function (item, verticies) {
  var self = this;
  verticies = verticies || countVerticies(item.geometry);
  if (verticies !== verticies) {
    return Promise.reject(new TypeError('Unsuported Geometry Type'));
  }
  var out;
  if (verticies > UPDATE_VERTEX_LIMIT) {
    return Promise.reject(new RangeError('too many verticies'));
  } else if(this.updateVerticies + verticies > UPDATE_VERTEX_LIMIT) {
    return this.flush().then(function () {
      return self.update(item, verticies);
    });
  } else {
    this.updateVerticies += verticies;
    if (this.updateQueue.push(item) === FEATURE_LIMIT) {
      return this.flush();
    }
  }
  return TRUE;
};

Bulk.prototype.remove = function (id) {
  if (this.removeQueue.push(id) === FEATURE_LIMIT) {
    return this.flush();
  }
  return TRUE;
};

Bulk.prototype.flush = function () {
  var self = this;
  var createQueue = ddup(this.createQueue, function (item) {
    return item.properties[self.table.primary];
  });
  this.createQueue = [];
  this.createVertices = 0;
  var updateQueue = ddup(this.updateQueue, function (item) {
    return item.properties[self.table.primary];
  });
  this.updateQueue = [];
  this.updateVerticies = 0;
  var removeQueue = ddup(this.removeQueue);
  this.removeQueue = [];
  return this.table.create(createQueue).then(function (e) {
    return self.table.update(updateQueue);
  }).then(function (e) {
    return self.table.remove(removeQueue);
  });
};