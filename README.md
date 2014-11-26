# apirequests

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
    uri: 'http://httpbin.org/get',
    response: {
        statuscode: 200,
        headers: {
            contenttype: 'application/json'
        }
    }
}
```