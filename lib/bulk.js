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

Bulk.prototype.create = function (item) {
  var verticies = countVerticies(item.geometry);
  if (verticies !== verticies) {
    return Promise.reject(new TypeError('Unsuported Geometry Type'));
  }
  var out;
  if (verticies > CREATE_VERTEX_LIMIT) {
    return Promise.reject(new RangeError('too many verticies'));
  } else if(this.createVertices + verticies > CREATE_VERTEX_LIMIT) {
    out = this.table.create(this.createQueue);
    this.createQueue = [item];
    this.createVertices = verticies;
    return out;
  } else {
    this.createVertices += verticies;
    if (this.createQueue.push(item) === FEATURE_LIMIT) {
      out = this.table.create(this.createQueue);
      this.createQueue = [];
      this.createVertices = 0;
      return out;
    }
  }
  return TRUE;
};

Bulk.prototype.update = function (item) {
  var verticies = countVerticies(item.geometry);
  if (verticies !== verticies) {
    return Promise.reject(new TypeError('Unsuported Geometry Type'));
  }
  var out;
  if (verticies > UPDATE_VERTEX_LIMIT) {
    return Promise.reject(new RangeError('too many verticies'));
  } else if(this.updateVerticies + verticies > UPDATE_VERTEX_LIMIT) {
    out = this.table.update(this.updateQueue);
    this.updateQueue = [item];
    this.updateVerticies = verticies;
    return out;
  } else {
    this.updateVerticies += verticies;
    if (this.updateQueue.push(item) === FEATURE_LIMIT) {
      out = this.table.update(this.updateQueue);
      this.updateQueue = [];
      this.updateVerticies = 0;
      return out;
    }
  }
  return TRUE;
};

Bulk.prototype.remove = function (id) {
  if (this.removeQueue.push(id) === FEATURE_LIMIT) {
    var out = this.table.remove(this.removeQueue);
    this.removeQueue = [];
    return out;
  }
  return TRUE;
};

Bulk.prototype.flush = function () {
  var pending = [];
  if (this.createQueue.length) {
    pending.push(this.table.create(this.createQueue));
    this.createQueue = [];
    this.createVertices = 0;
  }
  if (this.updateQueue.length) {
    pending.push(this.table.update(this.updateQueue));
    this.updateQueue = [];
    this.updateVerticies = 0;
  }
  if (this.removeQueue.length) {
    pending.push(this.table.remove(this.removeQueue));
    this.removeQueue = [];
  }
  return Promise.all(pending);
};