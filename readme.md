Google Maps Engine
======

Wrapper for doing crud operations on Google Maps Engine tables.

No affliations with Google blah blah etc.

All methods return promises

```javascript
var GME = require('gme');
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
```

the key parameter may either be the buffer contents of the key file or the string path to the keyfile

email and tableID must be strings. 

For the features query see [this page](https://developers.google.com/maps-engine/documentation/read#queries) for query options.

For create and update takes an array of features per the [create](https://developers.google.com/maps-engine/documentation/feature-create) and [update](https://developers.google.com/maps-engine/documentation/feature-update) docs.

For remove an array of ids to delete is required.

bulk is the only method that doesn't return a promice, but instead it reatures a bulk object, which has the same create update and remove methods that work the same way, the only difference is that they wait util they have the maximum number of features or or verticies and then does the upload in a batch.

i.e. `bulk.create(feature);` the first 49 times will return a promise that resolves to `true` but the 50th time it is a promise for the bulk upload of all 50 features.

`bulk.flush` forces an upload of all items in the current queue and cleans them out, flush doesn't close the object or anything so you can continue to use it.