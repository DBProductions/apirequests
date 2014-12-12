# apirequests

Call several API resources in a simple way with your defined rules.  
Test several backends if resources are responsing like expected.

[![NPM](https://nodei.co/npm/apirequests.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/apirequests/)

## How to use

```javascript
var apirequests = require('apirequests');

var rules = [...];
var options = {output: 'html'};

var apitest = apirequests(rules, options);
apitest.run();
```

The options are optional, per default the result be print out.
It's also possible to define `outputfile` and `outputpath` to save the html file.  

When the requests should run in a `loop` set it with a timeout value.

```javascript
var apirequests = require('apirequests');

var rules = [...];

var apitest = apirequests(rules, {loop: 20});
apitest.run();
```

## Define rules

A rule take basically a `uri` to run, a `method` is optinal, the default is GET. To send headers define them as `headers` object and define a `form` object inside of the rule to send data.  
To test the response, define inside of the rule a response object. The response object can have a `statuscode`, `data` and a `headers` object, this object can have a `contenttype`, `contentlength` and a `cachecontrol`.

Some examples for defining rules.

```javascript
{
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
    method: 'delete', 
    uri: 'http://webservice-point.appspot.com/test',
    response: {
        statuscode: 404,
        headers: {
            contenttype: 'text/html; charset=UTF-8'
        }
    }
}
```

## Results

Per default the result be print out and look like the picture below.

![Console](https://raw.githubusercontent.com/DBProductions/apirequests/master/screenshots/console.png)

When the options object gets set with output equal html a report.html file gets created.

![HTML](https://raw.githubusercontent.com/DBProductions/apirequests/master/screenshots/html.png)

## Feedback
Star this repo if you found it useful. Use the github issue tracker to give feedback on this repo.