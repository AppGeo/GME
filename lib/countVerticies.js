'use strict';
module.exports = count;
function count(geometry) {
  if (!geometry) {
    return 0;
  }
  if (geometry.type === 'MultiPolygon' && geometry.coordinates.length === 1) {
    geometry.type = 'Polygon';
    geometry.coordinates = geometry.coordinates[0];
  } else if (geometry.type === 'MultiLineString' && geometry.coordinates.length === 1) {
    geometry.type = 'LineString';
    geometry.coordinates = geometry.coordinates[0];
  } else if (geometry.type === 'MultiPoint' && geometry.coordinates.length === 1) {
    geometry.type = 'Point';
    geometry.coordinates = geometry.coordinates[0];
  }
  var type = geometry.type;
  switch (type) {
    case 'Point': return 1;
    case 'MultiPoint':
    case 'LineString': return geometry.coordinates.length;
    case 'Polygon':
    case 'MultiLineString': return geometry.coordinates.reduce(arrCount, 0);
    case 'MultiPolygon': return geometry.coordinates.reduce(arrArrCount, 0);
    case 'GeometryCollection': return geometry.geometries.reduce(geomCount, 0);
    default: return NaN;
  }
}
function arrCount(accum, item) {
  return accum + item.length;
}
function arrArrCount(accum, item) {
  return item.reduce(arrCount, accum);
}
function geomCount(accum, item) {
  return accum + count(item);
}