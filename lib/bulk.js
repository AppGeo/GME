'use strict';
var countVerticies = require('./countVerticies');
var Promise = require('bluebird');
var limits = {
  featureTotal: 50,
  featureVertex: 100000,
  totalVertex: 100000
};
var TRUE = Promise.resolve(true);
function ringIsClockwise(ringToTest) {
  var total = 0,
    i = -1,
    rLength = ringToTest.length,
    penLen = rLength - 1,
    pt1 = ringToTest[0],
    pt2;
  while (++i < penLen) {
    pt2 = ringToTest[i + 1];
    total += (pt2[0] - pt1[0]) * (pt2[1] + pt1[1]);
    pt1 = pt2;
  }
  return total >= 0;
}

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
function clone(obj) {
  var out = {};
  Object.keys(obj).forEach(function (key) {
    out[key] = obj[key];
  });
  return out;
}
module.exports = Bulk;
function Bulk(table) {
  this.table = table;
  this.limits = clone(table.limits || limits);
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
    console.log(JSON.stringify(item, false, 4));
    return Promise.reject(new TypeError('Unsuported Geometry Type'));
  }
  var out;
  if (verticies > this.limits.featureVertex) {
    return Promise.reject(new RangeError('too many verticies, limit is ' + this.limits.featureVertex + ' but polygon has ' + verticies));
  } else if(this.createVertices + verticies > this.limits.totalVertex) {
    return this.flush().then(function () {
      return self.create(item, verticies);
    });
  } else {
    this.createVertices += verticies;
    if (this.createQueue.push(item) === this.limits.featureTotal) {
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
  if (verticies > this.limits.featureVertex) {
    return Promise.reject(new RangeError('too many verticies, limit is ' + this.limits.featureVertex + ' but polygon has ' + verticies));
  } else if(this.updateVerticies + verticies > this.limits.totalVertex) {
    return this.flush().then(function () {
      return self.update(item, verticies);
    });
  } else {
    this.updateVerticies += verticies;
    if (this.updateQueue.push(item) === this.limits.featureTotal) {
      return this.flush();
    }
  }
  return TRUE;
};

Bulk.prototype.remove = function (id) {
  if (this.removeQueue.push(id) === this.limits.featureTotal) {
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
  createQueue = ddup(createQueue, function (item) {
    return item.properties[self.table.primary];
  }).map(function (item) {
    if (item.geometry) {
      if (item.geometry.type === 'Polygon') {
        item.geometry.coordinates.forEach(function (ring) {
          if (ringIsClockwise(ring)) {
            ring.reverse();
          }
        });
      } else if (item.geometry.type === 'MultiPolygon') {
        item.geometry.coordinates.forEach(function (rings) {
          rings.forEach(function (ring) {
            if (ringIsClockwise(ring)) {
              ring.reverse();
            }
          });
        });
      }
    }
    return item;
  });
  updateQueue = ddup(updateQueue, function (item) {
    return item.properties[self.table.primary];
  }).map(function (item) {
    if (item.geometry) {
      if (item.geometry.type === 'Polygon') {
        item.geometry.coordinates.forEach(function (ring) {
          if (ringIsClockwise(ring)) {
            ring.reverse();
          }
        });
      } else if (item.geometry.type === 'MultiPolygon') {
        item.geometry.coordinates.forEach(function (rings) {
          rings.forEach(function (ring) {
            if (ringIsClockwise(ring)) {
              ring.reverse();
            }
          });
        });
      }
    }
    return item;
  });
  removeQueue = ddup(removeQueue);
  this.removeQueue = [];
  return this.table.create(createQueue).then(function (e) {
    return self.table.update(updateQueue);
  }).then(function (e) {
    return self.table.remove(removeQueue);
  });
};