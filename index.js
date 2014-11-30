var fs = require('fs');
var request = require("request");
var colors = require('colors');
/**
 * apirequests
 */
var apirequests = function apirequests(rules, opts) {
    if (!rules) { rules = []; }
    if (!opts) { opts = {}; }
    opts['output'] = opts['output'] || 'print';
    // set some variables
    var tasks = [];
    var responses = [];
    var methods = ['GET','POST','PUT','DELETE'];
    var startTime = 0;
    // build the tasks from rules
    var i, options;
    for(i = 0; i < rules.length; i++) {
        options = {};
        options['num'] = i + 1; 
        if (rules[i].method) {
            options['method'] = rules[i].method.toUpperCase();
            if (methods.indexOf(options['method']) < 0) {
                options['method'] = false;
            }
        } else {
            options['method'] = 'GET';
        }
        if (rules[i].uri) {
            options['uri'] = rules[i].uri;            
            if (!checkUri(options['uri'])) {
                options['uri'] = false;
            }
        }
        if (rules[i].form) {
            options['form'] = rules[i].form;
        }
        if (rules[i].headers) {
            options['headers'] = rules[i].headers;    
        }
        if (rules[i].response) {
            options['response'] = rules[i].response;
        }
        if (options['method'] && options['uri']) {
            tasks.push(options);    
        } else {
            console.log(colors.red('* SKIP') + ' - ', rules[i].method + ' ' + rules[i].uri);
        }        
    }

    /**
     * check uri
     */
    function checkUri(s) {    
        var r = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
        return r.test(s);    
    }
    /**
     * collect the responses
     */
    function getResponse(response) {
        response['reqend'] = (+new Date());
        responses.push(response);
    }
    /**
     * do the request
     */
    function call(opts, cb) {
        request(opts, function(err, res, body) {
            if (err) {
                cb(err);
            } else {
                cb(res, body);
            }
        });
    }
    /**
     * fill results with matching tasks and responses
     */
    function fillResults(tasks, responses) {
        var results = [];
        for(var i = 0; i < tasks.length; i++) {
            for(var j = 0; j < responses.length; j++) {
                if (responses[j].request.href == tasks[i].uri && responses[j].request.method == tasks[i].method) {
                    results.push({task:tasks[i],result:responses[j]});
                    responses.splice(j, 1);                        
                }
            }
        }
        return results;
    }
    /**
     * print results on console
     */
    function printResults(results) {
        var passed = 0;
        var failed = 0;
        var difference = Math.round((new Date().getTime() - startTime));
        for(var i = 0; i < results.length; i++) {
            var requestTime = Math.round((results[i].result.reqend - results[i].task.reqstart));
            if (!results[i].output['pass'] && results[i].task.response) {
                console.log(colors.red('* FAIL') + ' - ', results[i].task.num, results[i].task.method, results[i].task.uri, 'in ' + requestTime + ' milliseconds', results[i].output.msg);                    
                failed += 1;
            } else {
                if (results[i].task.response) {
                    console.log(colors.green('* PASS') + ' - ', results[i].task.num, results[i].task.method, results[i].task.uri, 'in ' + requestTime + ' milliseconds', results[i].output.msg);
                    passed += 1;
                } else {
                    console.log(colors.green('* RUN') + ' - ', results[i].task.num, results[i].task.method, results[i].task.uri, 'in ' + requestTime + ' milliseconds', results[i].output.msg);
                }                        
            }
        }
        console.log('Finish ' + results.length + ' tasks in ' + difference + ' milliseconds.');
        var msg = 'Have passed ' + passed + ' and failed ' + failed + ' tasks.\n';
        if (failed > 0) {
            console.log(colors.red(msg));
        } else {
            console.log(colors.green(msg));
        }
    }
    /**
     * write results to html file
     */
    function writeResults(results) {
        var passed = 0;
        var failed = 0;
        var difference = Math.round((new Date().getTime() - startTime));
        var content = '<html><head><style>.error{color:red;}.pass{color:green;}</style></head><body><h1>apirequests report</h1>';
        for(var i = 0; i < results.length; i++) {
            var requestTime = Math.round((results[i].result.reqend - results[i].task.reqstart));
            if (!results[i].output['pass'] && results[i].task.response) {
                content += '<div><strong class="error">* FAIL</strong> - ' + results[i].task.num + ' ' + results[i].task.method + ' ' + results[i].task.uri + ' in ' + requestTime + ' milliseconds';
                content += results[i].output.msg.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;') + '</div>';
                failed += 1;
            } else {
                if (results[i].task.response) {
                        content += '<div><span class="pass">* PASS</span> - ' + results[i].task.num + ' ' + results[i].task.method + ' ' + results[i].task.uri + ' in ' + requestTime + ' milliseconds<br>';
                        content += results[i].output.msg.replace("\n", "<br>").replace(/ /g, '&nbsp;') + '</div>';
                        passed += 1;
                } else {
                        content += '<div><span class="pass">* RUN' + '</span> - ' + results[i].task.num + ' ' + results[i].task.method + ' ' + results[i].task.uri + ' in ' + requestTime + ' milliseconds<br>';
                        content += results[i].output.msg.replace("\n", "<br>").replace(/ /g, '&nbsp;') + '</div>';
                }                        
            }
        }
        content += '<br><div>Finish ' + results.length + ' tasks in ' + difference + ' milliseconds.</div>';
        var msg = '<div>Have passed ' + passed + ' and failed ' + failed + ' tasks.</div>';
        if (failed > 0) {
            content += '<div><span class="error">' + msg + '</span></div>';
        } else {
            content += '<div><span class="pass">' + msg + '</span></div>';
        }
        content += '</body></html>';
        fs.writeFile('report.html', content, function (err) {
            if (err) throw err;
            console.log('Report file saved!');
        });
    }
    /**
     * set the output property of the results object
     */
    function setOutputs(results) {
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
        return results;
    }
    /**
     * check the responses
     */
    function checkResponses(opts) {
        if (tasks.length === responses.length) {
            var results = fillResults(tasks, responses);
            results = setOutputs(results);
            if (opts['output'] === 'print') {   
                printResults(results);
            } else if(opts['output'] === 'html') {
                writeResults(results);                
            }
        } else {
            setTimeout(function(){checkResponses(opts)}, 100);
        }
    }
    
    return {
        /**
         *
         */
        run: function() {
            startTime = (+new Date());            
            if (opts['output'] === 'print') {                
                console.log('Start with', tasks.length, 'Tasks\n');
            }
            for(var i = 0; i < tasks.length; i++) {
                tasks[i]['reqstart'] = (+new Date());
                call(tasks[i], function(response, body) {
                    getResponse(response);
                });
            }
            checkResponses(opts);
        }
    };
}

module.exports = apirequests; 