'use strict';
var countVerticies = require('./countVerticies');
var Promise = require('bluebird');
var FEATURE_LIMIT = 50;
var CREATE_VERTEX_LIMIT = 2000;
var UPDATE_VERTEX_LIMIT = 10000;
var TRUE = Promise.resolve(true);
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
  var createQueue = this.createQueue;
  this.createQueue = [];
  this.createVertices = 0;
  var updateQueue = this.updateQueue;
  this.updateQueue = [];
  this.updateVerticies = 0;
  var removeQueue = this.removeQueue;
  this.removeQueue = [];
  return this.table.create(createQueue).then(function () {
    return self.table.update(updateQueue);
  }).then(function () {
    return self.table.remove(removeQueue);
  });
};