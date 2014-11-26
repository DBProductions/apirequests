# apirequests

Call API resources in a very simple way.

[![NPM](https://nodei.co/npm/apirequests.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/apirequests/)

## Simple to use

```javascript
var apirequests = require('apirequests');

var rules = [...];

var apitest = apirequests(rules);
apitest.run();
```

## Define rules

```javascript
{
    method: 'get', 
    uri: 'http://webservice-point.appspot.com/test',
    response: {
        statuscode: 200,
        data: '{"response": "GET"}',
        headers: {
            contenttype: 'application/json',            
        }
    }
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
        statuscode: 200,
        headers: {
            contenttype: 'application/json',            
        }
    }
}
```

## Feedback
Star this repo if you found it useful. Use the github issue tracker to give feedback on this repo.