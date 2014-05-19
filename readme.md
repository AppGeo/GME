Google Maps Engine [![NPM version](https://badge.fury.io/js/gme.svg)](http://badge.fury.io/js/gme)
======

Wrapper for doing crud operations on Google Maps Engine tables.

No affiliations with Google blah blah etc.

All methods return promises

```javascript
var GME = require('gme');
GME.createTable(key, email, requestObj);
var table = new GME(key, email, tableID);

table.info(); //-> info about the table
table.features(); //-> all the features
table.features(query); //-> filtered list
table.feature(id); //-> one feature
table.create(array); //-> success/failure
table.update(array); //-> success/failure
table.remove(array); //-> success/failure

var bulk = table.bulk();
bulk.([create|update|remove]); //-> ready for more/failure
bulk.flush(); //-> success/failure

var stream = table.writeStream();
stream.write({
  type: 'create',
  value: {...}
});
stream.write({
  type: 'update',
  value: {...}
});
stream.write({
  type: 'remove',
  key: 'string'
});
```

the key parameter may either be the buffer contents of the key file or the string path to the keyfile

`email` and `tableID` must be strings. 

For the features query see [this page](https://developers.google.com/maps-engine/documentation/read#queries) for query options.

For create and update takes an array of features per the [create](https://developers.google.com/maps-engine/documentation/feature-create) and [update](https://developers.google.com/maps-engine/documentation/feature-update) docs.

For remove an array of ids to delete is required.

## table.bulk

bulk doesn't return a promise, but instead it returns a bulk object, which has the same create update and remove methods that work the same way, the only difference is that they wait util they have the maximum number of features or verticies and then does the upload in a batch.

i.e. `bulk.create(feature);` the first 49 times will return a promise that resolves to `true` but the 50th time it is a promise for the bulk upload of all 50 features.

`bulk.flush` forces an upload of all items in the current queue and cleans them out, flush doesn't close the object or anything so you can continue to use it.

## table.writeStream

the `writeStream` method returns a writable stream, write objects with a `type` property with 'create', 'update', or 'remove' value and then a 'data' property with the object or string to put to the method (this can also be named 'key' if you want).

## GME.createTable

Similar to the table constructor but instead of a table ID takes a [table creation object](https://developers.google.com/maps-engine/documentation/table-create#table_create_requests).