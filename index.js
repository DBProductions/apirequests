/**
 * apirequests
 */
var request = require("request"),
    colors = require('colors'),
    fs = require('fs'),
    apirequests = function apirequests(opts) {
    "use strict";
    // set defaults
    if (!opts) { opts = {}; }
    opts.output = opts.output || 'print';
    opts.outputfile = opts.outputfile || 'reports.html';
    opts.outputpath = opts.outputpath || './';
    opts.outputpath = opts.outputpath || './';
    opts.connectionurl = opts.connectionurl || null;
    opts.collection = opts.collection || 'results';
    // set some variables
    var startTime = 0,
        loopCount = 1,
        tasks = [],
        responses = [],
        methods = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'];
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
                res.num = opts.num;
                res.reqend = (+new Date());
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
                if (tasks[i].num === responses[j].num) {
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
        var passed = 0,
            failed = 0,
            difference = Math.round((new Date().getTime() - startTime));
        for(var i = 0; i < results.length; i++) {
            var msg = '';
            var requestTime = Math.round((results[i].result.reqend - results[i].task.reqstart));
            requestTime +=  ' milliseconds';
            if (results[i].task.delay) {
                requestTime +=  ' delayed with ' + results[i].task.delay;
            }
            requestTime +=  '\n';
            if (!results[i].output.pass && results[i].task.response) {
                if (results[i].output.msg.length > 0) {
                    results[i].output.msg.forEach(function(value) {
                        msg += "\t- " + value.trim() + "\n";
                    });
                }
                console.log(colors.red('* FAIL') + '  - ' + results[i].task.num, results[i].task.method, results[i].task.uri, 'in ' + requestTime, msg);
                failed += 1;
            } else {
                if (results[i].task.response) {
                    console.log(colors.green('* PASS') + '  - ' + results[i].task.num, results[i].task.method, results[i].task.uri, 'in ' + requestTime);
                    passed += 1;
                } else {
                    console.log(colors.green('* RUN') + '  - ' + results[i].task.num, results[i].task.method, results[i].task.uri, 'in ' + requestTime);
                }
            }
        }
        console.log('Finish ' + results.length + ' tasks in ' + difference + ' milliseconds.');
        var msg = 'Have passed ' + passed + ' and failed ' + failed;
        if (failed === 1) {
            msg += ' task.\n';
        } else {
            msg += ' tasks.\n';
        }
        if (failed > 0) {
            console.log(colors.red(msg));
        } else {
            console.log(colors.green(msg));
        }
    }
    /**
     * write results to html file
     */
    function writeResults(results, opts) {
        var passed = 0,
            failed = 0,
            difference = Math.round((new Date().getTime() - startTime));
        var content = '<html><head>';
        if (opts.loop) {
            content += '<meta http-equiv="refresh" content="' + Math.round(opts.loop/1000) + '">';
        }
        content += '<style>.error{color:red;}.pass{color:green;}</style></head><body><h1>apirequests report</h1>';
        for(var i = 0; i < results.length; i++) {
            var requestTime = Math.round((results[i].result.reqend - results[i].task.reqstart));
            requestTime +=  ' milliseconds';
            if (results[i].task.delay) {
                requestTime +=  ' delayed with ' + results[i].task.delay;
            }
            if (!results[i].output.pass && results[i].task.response) {
                content += '<div><strong class="error">* FAIL</strong> - ' + results[i].task.num + ' ' + results[i].task.method + ' ' + results[i].task.uri + ' in ' + requestTime + '<br>';
                if (results[i].output.msg.length > 0) {
                    results[i].output.msg.forEach(function(value) {
                        content += "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - " + value.trim() + "<br>";
                    });
                }
                content += '</div><br>';
                failed += 1;
            } else {
                if (results[i].task.response) {
                        content += '<div><span class="pass">* PASS</span> - ' + results[i].task.num + ' ' + results[i].task.method + ' ' + results[i].task.uri + ' in ' + requestTime + '<br><br></div>';
                        passed += 1;
                } else {
                        content += '<div><span class="pass">* RUN' + '</span> - ' + results[i].task.num + ' ' + results[i].task.method + ' ' + results[i].task.uri + ' in ' + requestTime + '<br><br></div>';
                }
            }
        }
        content += '<div>Finish ' + results.length + ' tasks in ' + difference + ' milliseconds.</div>';
        var msg = '<div>Have passed ' + passed + ' and failed ' + failed;
        if (failed === 1) {
            msg += ' task.</div>';
        } else {
            msg += ' tasks.</div>';
        }
        if (failed > 0) {
            content += '<div><span class="error">' + msg + '</span></div>';
        } else {
            content += '<div><span class="pass">' + msg + '</span></div>';
        }
        content += '</body></html>';
        require('fs').writeFile(opts.outputpath + opts.outputfile, content, function (err) {
            if (err) { throw err; }
            console.log('Report file ' + opts.outputpath + opts.outputfile + ' saved!');
        });
    }
    /**
     * store results in MongoDB
     */
    function storeResults(results, opts) {
        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect(opts.connectionurl, function(err, db) {
            if(err) throw err;
            var docs = [];
            for(var i = 0; i < results.length; i++) {
                docs.push({output: results[i].output, task: results[i].task});
            }
            db.collection(opts.collection).insert(docs, function(err, response) {
                if(err) throw err;
                console.log(colors.green('Saved to ' + opts.connectionurl + ' in ' + opts.collection), response.result);
                db.close();
            });
        });
    }
    /**
     * set the output property of the results object
     */
    function setOutputs(results) {
        for(var i = 0; i < results.length; i++) {
            results[i].output = {};
            results[i].output.msg = [];
            if (results[i].task.response) {
                results[i].output.pass = false;
                // status code
                if (results[i].task.response.statuscode !== results[i].result.statusCode) {
                    results[i].output.msg.push(results[i].task.response.statuscode + ' is not equal ' + results[i].result.statusCode);
                }
                // host
                if (results[i].task.response.host) {
                    if (results[i].task.response.host !== results[i].result.request.host) {
                        results[i].output.msg.push(results[i].task.response.host + ' is not equal ' + results[i].result.request.host);
                    }
                }
                // headers
                if (results[i].task.response.headers) {
                    // contenttype
                    if (results[i].task.response.headers.contenttype) {
                        if (results[i].task.response.headers.contenttype !== results[i].result.headers['content-type']) {
                            results[i].output.msg.push(results[i].task.response.headers.contenttype + ' is not equal ' + results[i].result.headers['content-type']);
                        }
                    }
                    // contentlength
                    if (results[i].task.response.headers.contentlength) {
                        if (results[i].task.response.headers.contentlength !== results[i].result.headers['content-length']) {
                            results[i].output.msg.push(results[i].task.response.headers.contentlength + ' is not equal ' + results[i].result.headers['content-length']);
                        }
                    }
                    // server
                    if (results[i].task.response.headers.server) {
                        if (results[i].task.response.headers.server !== results[i].result.headers.server) {
                            results[i].output.msg.push(results[i].task.response.headers.server + ' is not equal ' + results[i].result.headers.server);
                        }
                    }
                    // cachecontrol
                    if (results[i].task.response.headers.cachecontrol) {
                        if (results[i].task.response.headers.cachecontrol !== results[i].result.headers['cache-control']) {
                            results[i].output.msg.push(results[i].task.response.headers.cachecontrol + ' is not equal ' + results[i].result.headers['cache-control']);
                        }
                    }
                }
                // body
                if (results[i].task.response.data) {
                    if (results[i].task.response.regex) {
                        var re = new RegExp(results[i].task.response.data);
                        if (!re.exec(results[i].result.body)) {
                            results[i].output.msg.push(results[i].result.body + ' not includes ' + results[i].task.response.data);
                        }
                    } else {
                        if (results[i].task.response.data !== results[i].result.body) {
                            results[i].output.msg.push(results[i].task.response.data + ' is not equal ' + results[i].result.body);
                        }
                    }
                }
                if (results[i].output.msg.length === 0) {
                    results[i].output.pass = true;
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
            if (opts.output === 'print') {
                printResults(results);
            } else if (opts.output === 'html') {
                writeResults(results, opts);
            } else if (opts.output === 'db') {
                storeResults(results, opts);
            }
            if (opts.loop) {
                loopCount += 1;
                startTime = (+new Date());
                if (opts.output === 'print') {
                    console.log('Start again with', tasks.length, 'Tasks', 'made ' + loopCount + ' runs', '\n');
                }
                responses = [];
                tasks.map(function(currentValue) {
                    currentValue.reqstart = (+new Date());
                    call(currentValue, function(response) {
                        getResponse(response);
                    });
                });
                checkResponses(opts);
            }
        } else {
            setTimeout(function(){ checkResponses(opts); }, 1);
        }
    }
    /**
     * build the tasks, make some chacks and skip wrong data
     */
    function buildTasks(rules) {
        var i, options;
        for(i = 0; i < rules.length; i++) {
            options = {};
            options.num = i + 1;
            if (rules[i].method) {
                options.method = rules[i].method.toUpperCase();
                if (methods.indexOf(options.method) < 0) {
                    options.method = false;
                }
            } else {
                options.method = 'GET';
            }
            if (rules[i].uri) {
                options.uri = rules[i].uri;
                if (!checkUri(options.uri)) {
                    options.uri = false;
                }
            }
            if (rules[i].delay) {
                options.delay = rules[i].delay;
            }
            if (rules[i].form) {
                options.form = rules[i].form;
            }
            if (rules[i].headers) {
                options.headers = rules[i].headers;
            }
            if (rules[i].response) {
                options.response = rules[i].response;
            }
            if (options.method && options.uri) {
                tasks.push(options);
            } else {
                console.log(colors.red('* SKIP') + ' - ' + rules[i].method + ' ' + rules[i].uri);
            }
        }
    }
    /**
     * start the calls and check the responses
     */
    function start() {
        tasks.map(function(currentValue) {
            currentValue.reqstart = (+new Date());
            if (currentValue.delay) {
                setTimeout(function() {
                    call(currentValue, function(response) {
                        getResponse(response);
                    });
                }, currentValue.delay);
            } else {
                call(currentValue, function(response) {
                    getResponse(response);
                });
            }
        });
        checkResponses(opts);
    }

    return {
        /**
         * run method checks the rules, build tasks and start the requests
         */
        run: function(rules) {
            if (!rules) {
                console.log(colors.red('No rules!'), 'Rules are needed to build and run tasks.');
            } else if (typeof rules === 'string') {
                var filename = rules;
                fs.stat(filename, function(err) {
                    if (err === null) {
                        fs.readFile(filename, function (err, data) {
                            if (err) { throw err; }
                            rules = JSON.parse(data.toString());
                            buildTasks(rules);
                            startTime = (+new Date());
                            if (opts.output === 'print') {
                                console.log('Find', rules.length, 'in', filename, 'start with', tasks.length, 'Tasks\n');
                            }
                            start();
                        });
                    } else if(err.code === 'ENOENT') {
                        console.log(colors.red('File ' + filename + ' does not exists!'));
                    } else {
                        console.log(colors.red(err.code));
                    }
                });
            } else {
                buildTasks(rules);
                startTime = (+new Date());
                if (opts.output === 'print') {
                    console.log('Start with', tasks.length, 'Tasks\n');
                }
                start();
            }
        }
    };
};

module.exports = apirequests;
