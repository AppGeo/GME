Google Maps Engine
======

Wrapper for doing crud operations on Google Maps Engin tables.

No affliations with Google blah blah etc.

All methods return promises

```javascript
var GME = require('GME');
var table = new GME(key, email, tableID);

table.info(); //-> info about the table
table.features(); //-> all the features
table.features(query); //-> filtered list
table.feature(id); //-> one feature
table.create(array); //-> success/failure
table.update(array); //-> success/failure
table.remove(array); //-> success/failure
```

the key parameter may either be the buffer contents of the key file or the string path to the keyfile

email and tableID must be strings. 

For the features query see [this page](https://developers.google.com/maps-engine/documentation/read#queries) for query options.

For create and update takes an array of features per the [create](https://developers.google.com/maps-engine/documentation/feature-create) and [update](https://developers.google.com/maps-engine/documentation/feature-update) docs.

For remove an array of ids to delete is required.