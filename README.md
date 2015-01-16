# apirequests

Call several API resources in a simple way with JSON defined rules.  
Can test several backends if the resources are responsing like expected.

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

Options are optional, per default the result be print out.
It's also possible to define `output`, `outputfile` and `outputpath` to save the html file.  

```javascript
var apirequests = require('apirequests');

var apitest = apirequests({output: 'html'});
apitest.run('rules.json');
```

When the requests should run in a `loop` set it with a timeout value.

```javascript
var apirequests = require('apirequests');

var apitest = apirequests({loop: 2000});
apitest.run('rules.json');
```

## How to define rules

A rule take basically a `uri` to run, a `method` is optinal, the default value is GET.  
To send headers define them as `headers` object and define a `form` object inside of the rule to send data.  
To test the response, define inside of the rule a response object. The response object can have a `statuscode`, `data` and a `headers` object, this object can check `contenttype`, `contentlength`, `cachecontrol` and `server`.

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
    method: 'delete', 
    uri: 'http://webservice-point.appspot.com/test',
    response: {
        statuscode: 404,
        headers: {
            contenttype: 'text/html; charset=UTF-8'
        }
    }
}]
```

## Results

Per default the result be print out and looks like the picture below.

![Console](https://raw.githubusercontent.com/DBProductions/apirequests/master/screenshots/console.png)

The HTML file which can get created.

![HTML](https://raw.githubusercontent.com/DBProductions/apirequests/master/screenshots/html.png)

## Feedback
Star this repo if you found it useful. Use the github issue tracker to give feedback on this repo.