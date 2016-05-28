# apirequests

Call several API resources in a simple way with JSON defined rules.  
Can test several backends if the resources are response like expected.

[![NPM](https://nodei.co/npm/apirequests.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/apirequests/)

## How to use

```javascript
var apirequests = require('apirequests');

var rules = [...];

var apitest = apirequests();
apitest.run(rules);
```

It's also possible to save the rules in a JSON file.

```javascript
var apirequests = require('apirequests');

var apitest = apirequests();
apitest.run('rules.json');
```

Use a store engine, like MongoDB, for storing the rules.

```javascript
var apirequests = require('./index');
var MongoClient = require('mongodb').MongoClient;

MongoClient.connect('mongodb://127.0.0.1:27017/apirequests', function(err, db) {
    if(err) throw err;
    var apitest = apirequests();
    db.collection('urls').find().toArray(function(err, results) {
        apitest.run(results);
        db.close();
    });
});
```

#### Options
Options are optional.

##### output
The default value is `print`, other possible values are `html` and `db`.

##### printOnlyFailure
When this flag is `true` only the failures are printed out.  

##### outputFile and outputPath  
The default values are `reports.html` and `./`, will be used when output is set to html.  

```javascript
var apirequests = require('apirequests');

var apitest = apirequests({output: 'html', outputFile: 'report.html'});
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
var apirequests = require('./index');
var MongoClient = require('mongodb').MongoClient;

var connectionUrl = 'mongodb://127.0.0.1:27017/requests';
var opts = {output: 'db', connectionurl: connectionUrl};

MongoClient.connect(connectionUrl, function(err, db) {
    if(err) throw err;

    var apitest = apirequests(opts);

    db.collection('urls').find().toArray(function(err, results) {
        if(err) throw err;
        apitest.run(results);
        db.close();
    });
});
```

## How to define rules

A rule take basically a `uri` to run, a `method` is optional, GET is the default value.  
When a request should wait or be the last call a `delay` can get added.  
To send headers define them as `headers` object and define a `form` object inside of the rule to send data when needed.  
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

## Results

Per default the result be print out and looks like the picture below.

![Console](https://dbgaecdn.appspot.com/images/apirequests_console.png)

The HTML file which gets created. `{output: 'html'}`

![HTML](https://dbgaecdn.appspot.com/images/apirequests_html.png)

## Feedback
Star this repo if you found it useful. Use the github issue tracker to give feedback on this repo.
