# apirequests

Calls several API resources in a simple way with JSON defined rules.  
Can test several backends if the resources are response like expected.

[![NPM](https://nodei.co/npm/apirequests.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/apirequests/)

## How to use

```javascript
const apirequests = require('apirequests');

let rules = [...];

let apitest = apirequests();
apitest.run(rules);
```

Use rules from a JSON file.

```javascript
let apirequests = require('apirequests');

let apitest = apirequests();
apitest.run('rules.json');
```

Use a store engine, like MongoDB, for storing the rules.

```javascript
const apirequests = require('apirequests');
const MongoClient = require('mongodb').MongoClient;

MongoClient.connect('mongodb://127.0.0.1:27017/apirequests', (err, db) => {
    if(err) throw err;
    let apitest = apirequests();
    db.collection('urls').find().toArray((err, results) => {
        apitest.run(results);
        db.close();
    });
});
```

#### Options
Options are optional.

##### output
The default value is `print`, other possible values are `html`, `xml`, `db` and `ci`.

##### printOnlyFailure
When this flag is `true` only the failures are printed out.  

##### outputFile and outputPath  
The default values are `reports.html` and `./`, will be used when output is set to html.  

```javascript
const apirequests = require('apirequests');

let apitest = apirequests({output: 'html', outputFile: 'report.html'});
apitest.run('rules.json');
```

##### loop
When the requests should run in a `loop` with a timeout value.

```javascript
require('apirequests')({loop: 2000}).run('rules.json');
```

##### connectionurl and collection  
The default values are `mongodb://127.0.0.1:27017/apirequests` and `results`, will be used when output is set to db.  

```javascript
const apirequests = require('apirequests');
const MongoClient = require('mongodb').MongoClient;

const connectionUrl = 'mongodb://127.0.0.1:27017/requests';
const opts = {output: 'db', connectionurl: connectionUrl};

MongoClient.connect(connectionUrl, function(err, db) {
    if(err) throw err;

    let apitest = apirequests(opts);

    db.collection('urls').find().toArray((err, results) => {
        if(err) throw err;
        apitest.run(results);
        db.close();
    });
});
```

## How to define rules

A rule takes basically an `uri` to run, the `method` is optional, GET is the default value.  
When a request should wait `delay` can be added. To send custom headers use a `headers` object and define a `form` object inside of the rule to send data.  
To test the response, define inside of the rule a response object. The response object can have a `statuscode`, `host`, `time`, `data`, `regex` and a `headers` object, this object can check `contenttype`, `contentlength`, `cachecontrol` and `server`.

Some examples how to define rules.

```javascript
[{
    method: 'get',
    uri: 'http://webservice-point.appspot.com/test'
},
{
    method: 'post',
    uri: 'http://webservice-point.appspot.com/test',
    form: {
        name: "apirequests",
        test: "post"
    },
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    },
    response: {
        statuscode: 200,
        data: '{"data": [{"test": "post"}, {"name": "apirequests"}], "response": "POST"}'
    }
},
{
    method: 'put',
    uri: 'http://webservice-point.appspot.com/test/123',
    response: {
        statuscode: 404,
        headers: {
            contenttype: 'text/html; charset=UTF-8',
            contentlength: '285'           
        }
    }
},
{
    method: 'patch',
    uri: 'http://webservice-point.appspot.com/test/123',
    response: {
        statuscode: 404,
        headers: {
            contenttype: 'text/html; charset=UTF-8',
            contentlength: '285'
        }
    }
},
{
    method: 'delete',
    uri: 'http://webservice-point.appspot.com/test',
    delay: 3000,
    response: {
        statuscode: 404,
        headers: {
            contenttype: 'text/html; charset=UTF-8'
        },
        data: 'error',
        regex: true
    }
}]
```

To send JSON data it's needed to define a `body` and send the specific header.
```
{
    ...
    body: JSON.stringify({apirequest: 'post'}),
    headers: {
        'Content-Type': 'application/json'
    },
    response: {
        statuscode: 200,
        data: {apirequest: 'post'}
    }
}
```


## Results

Per default the result be print out and looks like the picture below.

![Console](https://dbgaecdn.appspot.com/images/apirequests_console.png)

The HTML file which gets created. `{output: 'html'}`

![HTML](https://dbgaecdn.appspot.com/images/apirequests_html.png)

## Feedback
Star this repo if you found it useful. Use the github issue tracker to give feedback on this repo.
