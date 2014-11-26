var request = require("request");
var colors = require('colors');

var apirequests = function apirequests(opts) {
    if (!opts) { opts = []; }
    var tasks = [], responses = [];
    var startTime;
    // build the tasks
    var i, options;
    for(i = 0; i < opts.length; i++) {
        options = {};
        options['num'] = i + 1; 
        if (opts[i].method) {
            options['method'] = opts[i].method.toUpperCase();
        } else {
            options['method'] = 'GET';
        }
        if (opts[i].uri) {
            options['uri'] = opts[i].uri;
        } else {
            options['uri'] = 'http://httpbin.org';
        }
        if (opts[i].form) {
            options['form'] = opts[i].form;
        }
        if (opts[i].headers) {
            options['headers'] = opts[i].headers;    
        }
        if (opts[i].response) {
            options['response'] = opts[i].response;
        }
        tasks.push(options);
    }
    /**
     * do the request
     */
    function call(opts, cb) {
        request(opts, function(err, response, body) {
            if (err) {
                cb(err);
            } else {
                cb(response, body);
            }
        });
    }
    /**
     * collect the responses
     */
    function getResponse(response) {
        responses.push(response);
    }
    /**
     * check the responses
     */
    function checkResponses(opts) {
        if (tasks.length === responses.length) {
            var results = [];
            // match tasks and responses
            for(var i = 0; i < tasks.length; i++) {
                for(var j = 0; j < responses.length; j++) {
                    if (responses[j].request.href == tasks[i].uri && responses[j].request.method == tasks[i].method) {
                        results.push({task:tasks[i],result:responses[j]});
                        responses.splice(j, 1);                        
                    }
                }
            }
            // calculate outputs
            for(var i = 0; i < results.length; i++) {
                results[i].output = {};
                results[i].output['msg'] = '\n';
                if (results[i].task.response) {                    
                    results[i].output['pass'] = false;
                    // status code
                    if (results[i].task.response.statuscode !== results[i].result.statusCode) {
                        results[i].output['msg'] += '    - ' + results[i].task.response.statuscode + ' is not equal ' + results[i].result.statusCode + '\n';
                    }                    
                    // headers                    
                    if (results[i].task.response.headers) {
                        if (results[i].task.response.headers['contenttype'] !== results[i].result.headers['content-type']) {
                            results[i].output['msg'] += '    - ' + results[i].task.response.headers['contenttype'] + ' is not equal ' + results[i].result.headers['content-type'] + '\n';
                        }
                        if (results[i].task.response.headers['contentlength'] !== results[i].result.headers['content-length']) {
                            results[i].output['msg'] += '    - ' + results[i].task.response.headers['contentlength'] + ' is not equal ' + results[i].result.headers['content-length'] + '\n';
                        }
                    }
                    // body
                    if (results[i].task.response.data) {
                        if (results[i].task.response.data !== results[i].result.body) {
                            results[i].output['msg'] += '    - ' + results[i].task.response.data + ' is not equal ' + results[i].result.body + '\n';
                        }
                    }
                    if (results[i].output['msg'] === '\n') {
                        results[i].output['pass'] = true;
                    }
                }
            }
            // display results
            if (opts['output'] === 'print') {
                var passed = 0, failed = 0;
                var difference = Math.round((new Date().getTime() - startTime) / 1000);                
                for(var i = 0; i < results.length; i++) {
                    if (!results[i].output['pass'] && results[i].task.response) {
                        console.log(colors.red('* FAIL') + ' - ', results[i].task.num, results[i].task.method, results[i].task.uri, results[i].output.msg);                    
                        failed += 1;
                    } else {
                        console.log(colors.green('* PASS') + ' - ', results[i].task.num, results[i].task.method, results[i].task.uri, results[i].output.msg);
                        passed += 1;
                    }
                }
                console.log('Finish ' + results.length + ' tasks in ' + difference + ' seconds.');
                var msg = 'Have passed ' + passed + ' and failed ' + failed + ' tasks.\n';
                if (failed > 0) {
                    console.log(colors.red(msg));
                } else {
                    console.log(colors.green(msg));
                }
            } else if(opts['output'] === 'html') {
                console.log('write to file...later!');
            }
        } else {
            setTimeout(function(){checkResponses(opts)}, 1000);    
        }
    }
    return {
        /**
         *
         */
        run: function(opts) {
            if (!opts) opts = {};
            if (!opts['output']) opts['output'] = 'print';
            if (opts['output'] === 'print') {
                startTime = (+new Date());
                console.log('Start with', tasks.length, 'Tasks\n');
            }
            for(var i = 0; i < tasks.length; i++) {
                call(tasks[i], function(response, body) {
                    getResponse(response);
                });
            }
            checkResponses(opts);
        }
    };
}

module.exports = apirequests; 