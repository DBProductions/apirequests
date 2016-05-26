/**
 * APIrequests
 * Take rules as JSON and execute requests.
 */
"use strict";
let request = require("request");
let colors = require("colors");
let logSymbols = require("log-symbols");
let Spinner = require("cli-spinner").Spinner;
let _spinner = new Spinner("Requesting %s");
let fs = require("fs");
let _output = require("./lib/output");
let apirequests;
let startTime = 0;
let loopCount = 1;
let TASKS = [];
let RESPONSES = [];
let methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

_spinner.setSpinnerString("|/-\\");

module.exports = function apirequests (opts) {
    if (!opts) { opts = {}; }
    opts.output = opts.output || "print";
    opts.mode = opts.mode || "all";
    opts.onlyFailures = opts.onlyFailures || null;
    opts.outputfile = opts.outputfile || "reports.html";
    opts.outputpath = opts.outputpath || "./";
    opts.outputpath = opts.outputpath || "./";
    opts.connectionurl = opts.connectionurl || null;
    opts.collection = opts.collection || "results";

    /**
     * Check uri
     */
    function checkUri (s) {
        var r = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
        return r.test(s);
    }

    /**
     * Do the request
     */
    function call (opts, cb) {
        request(opts, (err, res, body) => {
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
     * Collect the responses
     */
    function getResponse (response) {
        RESPONSES.push(response);
    }

    /**
     * Check the responses
     */
    function checkResponses (opts) {
        if (TASKS.length === RESPONSES.length) {
            _spinner.stop();
            console.log("\n");
            var results = fillResults(TASKS, RESPONSES);
            results = setOutputs(results);
            if (opts.output === "print") {
                _output.printResults(results, startTime);
            } else if (opts.output === "html") {
                _output.writeResults(results, opts, startTime);
            } else if (opts.output === "db") {
                _output.storeResults(results, opts, startTime);
            }
            if (opts.loop) {
                loopCount += 1;
                startTime = (+new Date());
                if (opts.output === "print") {
                    console.log("Start again with", tasks.length, "Tasks", "made " + loopCount + " runs\n");
                }
                RESPONSES = [];
                TASKS.map(function(currentValue) {
                    currentValue.reqstart = (+new Date());
                    call(currentValue, function(response) {
                        getResponse(response);
                    });
                });
                checkResponses(opts);
            }
        } else {
            setTimeout(() => { checkResponses(opts); }, 1);
        }
    }

    /**
     * Fill results with matching tasks and responses
     */
    function fillResults (tasks, responses) {
        var results = [];
        for (var i = 0; i < tasks.length; i++) {
            for (var j = 0; j < responses.length; j++) {
                if (tasks[i].num === responses[j].num) {
                    results.push({task: tasks[i], result: responses[j]});
                    responses.splice(j, 1);
                }
            }
        }
        return results;
    }

    /**
     * Set the output property of the results object
     */
    function setOutputs (results) {
        let msgPart = " is not equal ";
        for (var i = 0; i < results.length; i++) {
            results[i].output = {};
            results[i].output.msg = [];
            if (results[i].task.response) {
                results[i].output.pass = false;
                // Status code
                if (results[i].task.response.statuscode) {
                    if (results[i].task.response.statuscode !== results[i].result.statusCode) {
                        results[i].output.msg.push(results[i].task.response.statuscode + msgPart + results[i].result.statusCode);
                    }
                }
                // Host
                if (results[i].task.response.host) {
                    if (results[i].task.response.host !== results[i].result.request.host) {
                        results[i].output.msg.push(results[i].task.response.host + msgPart + results[i].result.request.host);
                    }
                }
                // Headers
                if (results[i].task.response.headers) {
                    // Contenttype
                    if (results[i].task.response.headers.contenttype) {
                        if (results[i].task.response.headers.contenttype !== results[i].result.headers["content-type"]) {
                            results[i].output.msg.push(results[i].task.response.headers.contenttype + msgPart + results[i].result.headers["content-type"]);
                        }
                    }
                    // Contentlength
                    if (results[i].task.response.headers.contentlength) {
                        if (results[i].task.response.headers.contentlength !== results[i].result.headers["content-length"]) {
                            results[i].output.msg.push(results[i].task.response.headers.contentlength + msgPart + results[i].result.headers["content-length"]);
                        }
                    }
                    // Server
                    if (results[i].task.response.headers.server) {
                        if (results[i].task.response.headers.server !== results[i].result.headers.server) {
                            results[i].output.msg.push(results[i].task.response.headers.server + msgPart + results[i].result.headers.server);
                        }
                    }
                    // Cachecontrol
                    if (results[i].task.response.headers.cachecontrol) {
                        if (results[i].task.response.headers.cachecontrol !== results[i].result.headers["cache-control"]) {
                            results[i].output.msg.push(results[i].task.response.headers.cachecontrol + msgPart + results[i].result.headers["cache-control"]);
                        }
                    }
                }
                // Body
                if (results[i].task.response.data) {
                    if (results[i].task.response.regex) {
                        var re = new RegExp(results[i].task.response.data);
                        if (!re.exec(results[i].result.body)) {
                            results[i].output.msg.push(results[i].result.body + " not includes " + results[i].task.response.data);
                        }
                    } else {
                        if (results[i].task.response.data !== results[i].result.body) {
                            results[i].output.msg.push(results[i].task.response.data + msgPart + results[i].result.body);
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
     * Build the tasks, make some checks and skip wrong data
     */
    function buildTasks (rules) {
        var i;
        var options;
        var rulesLength = rules.length;
        for (i = 0; i < rulesLength; i++) {
            options = {};
            options.num = i + 1;
            if (rules[i].method) {
                options.method = rules[i].method.toUpperCase();
                if (methods.indexOf(options.method) < 0) {
                    options.method = false;
                }
            } else {
                options.method = "GET";
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
                TASKS.push(options);
            } else {
                console.log(colors.red("* SKIP") + " - " + rules[i].method + " " + rules[i].uri);
            }
        }
    }
    /**
     * start the calls and check the responses
     */
    function start () {
        TASKS.map((currentValue) => {
            currentValue.reqstart = (+new Date());
            if (currentValue.delay) {
                setTimeout(() => {
                    call(currentValue, (response) => {
                        getResponse(response);
                    });
                }, currentValue.delay);
            } else {
                call(currentValue, (response) => {
                    getResponse(response);
                });
            }
        });
        checkResponses(opts);
    }

    return {
        /**
         * checks the rules then build the tasks and start to work
         */
        run: function (rules) {
            if (!rules) {
                console.log(logSymbols.error,
                            colors.red("No rules!"),
                            "Rules are needed to build and run tasks.");
            } else if (typeof rules === "string") {
                var filename = rules;
                fs.stat(filename, (err) => {
                    if (err === null) {
                        fs.readFile(filename, (err, data) => {
                            if (err) { throw err; }
                            rules = JSON.parse(data.toString());
                            buildTasks(rules);
                            startTime = (+new Date());
                            if (opts.output === "print") {
                                console.log("Find",
                                            rules.length,
                                            "in",
                                            filename,
                                            "start with",
                                            TASKS.length,
                                            "Tasks\n");
                            }
                            start();
                        });
                    } else if (err.code === "ENOENT") {
                        console.log(logSymbols.error,
                                    colors.red(filename + " doesn't exists!"));
                    } else {
                        console.log(logSymbols.error,
                                    colors.red(err.code));
                    }
                });
            } else {
                buildTasks(rules);
                startTime = (+new Date());
                if (opts.output === "print") {
                    console.log("Start with",
                                TASKS.length,
                                "Tasks");
                    _spinner.start();
                }
                start();
            }
        }
    };
};
