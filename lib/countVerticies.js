'use strict';
module.exports = count;
function count(geometry) {
  if (!geometry) {
    return 0;
  }
  var type = geometry.type;
  switch (type) {
    case 'Point': return 1;
    case 'LineString': return geometry.coordinates.length;
    case 'Polygon': return geometry.coordinates.reduce(arrCount, 0);
    case 'GeometryCollection': return geometry.geometries.reduce(geomCount, 0);
    default: return NaN;
  }
}
function arrCount(accum, item) {
  return accum + item.length;
}
function geomCount(accum, item) {
  return accum + count(item);
}