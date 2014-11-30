# apirequests

Call several API resources in a very simple way with defined rules.  
Test several backends if the resources are responsing correctly.

[![NPM](https://nodei.co/npm/apirequests.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/apirequests/)

## Simple to use

```javascript
var apirequests = require('apirequests');

var rules = [...];

var apitest = apirequests(rules);
apitest.run();
```

## Define rules

A rule take basically a uri to run, a method is optinal the default is GET.  
To send data, define a form object inside of the rule.  
To test the response, define inside of the rule a response object. The response object can have a statuscode, data and a headers object, this object can have a contenttype and a contentlength.

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

![Console](https://raw.githubusercontent.com/DBProductions/apirequests/master/screenshots/console.png)

![HTML](https://raw.githubusercontent.com/DBProductions/apirequests/master/screenshots/html.png)

## Feedback
Star this repo if you found it useful. Use the github issue tracker to give feedback on this repo.