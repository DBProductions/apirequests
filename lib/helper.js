'use strict';
const request = require('request');
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
/**
 * Check uri
 */
const checkUri = (s) => {
    let r = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    return r.test(s);
};
exports.checkUri = checkUri;
/**
 * Do the request
 */
exports.caller = (opts, cb) => {
    return new Promise((resolve, reject) => {
        request(opts, (err, res, body) => {
            if (err) {
                reject(err);
            } else {
                res.num = opts.num;
                res.reqend = (+new Date());
                resolve(res, body);
            }
        });
    });
};
/**
 * Build the tasks, make some checks and skip wrong data
 */
exports.buildTasks = (opts, rules) => {
    let options;
    let tasks = [];
    rules.forEach((value, key) => {
        options = {};
        options.num = key + 1;
        options.method = 'GET';
        if (value.method) {
            options.method = value.method.toUpperCase();
            if (METHODS.indexOf(options.method) === -1) {
                options.method = false;
            }
        }
        if (value.uri) {
            options.uri = value.uri;
            if (!checkUri(options.uri)) {
                options.uri = false;
            }
        }
        if (value.delay) {
            options.delay = value.delay;
        }
        if (value.body) {
            options.body = value.body;
        }
        if (value.form) {
            options.form = value.form;
        }
        if (value.headers) {
            options.headers = value.headers;
        }
        if (value.response) {
            options.response = value.response;
        }
        if (options.method && options.uri) {
            tasks.push(options);
        } else {
            if (opts.output === 'print') {
                console.log(logSymbols.error,
                            colors.red('SKIP'),
                            value.method,
                            value.uri);
            }
        }
    });
    return tasks;
};
/**
 * Set the output property of the results object
 */
exports.setOutputs = (results) => {
    const msgPart = ' is not equal ';
    results.forEach((value, key) => {
        value.output = {msg: []};
        if (value.task.response) {
            value.output.pass = false;
            // Status code
            if (value.task.response.statuscode) {
                if (value.task.response.statuscode !== value.result.statusCode) {
                    value.output.msg.push(value.task.response.statuscode + msgPart + value.result.statusCode);
                }
            }
            // Host
            if (value.task.response.host) {
                if (value.task.response.host !== value.result.request.host) {
                    value.output.msg.push(value.task.response.host + msgPart + value.result.request.host);
                }
            }
            // Time
            if (value.task.response.time) {
                if (value.task.response.time < value.result.requestTime) {
                    value.output.msg.push(value.result.requestTime + ' greater than ' + value.task.response.time);
                }
            }
            // Headers
            if (value.task.response.headers) {
                // Contenttype
                if (value.task.response.headers.contenttype) {
                    if (value.task.response.headers.contenttype !== value.result.headers['content-type']) {
                        value.output.msg.push(value.task.response.headers.contenttype + msgPart + value.result.headers['content-type']);
                    }
                }
                // Contentlength
                if (value.task.response.headers.contentlength) {
                    if (value.task.response.headers.contentlength !== value.result.headers['content-length']) {
                        value.output.msg.push(value.task.response.headers.contentlength + msgPart + value.result.headers['content-length']);
                    }
                }
                // Server
                if (value.task.response.headers.server) {
                    if (value.task.response.headers.server !== value.result.headers.server) {
                        value.output.msg.push(value.task.response.headers.server + msgPart + value.result.headers.server);
                    }
                }
                // Cachecontrol
                if (value.task.response.headers.cachecontrol) {
                    if (value.task.response.headers.cachecontrol !== value.result.headers['cache-control']) {
                        value.output.msg.push(results[i].task.response.headers.cachecontrol + msgPart + value.result.headers['cache-control']);
                    }
                }
            }
            // Body
            if (value.task.response.data) {
                if (value.task.response.regex) {
                    let re = new RegExp(results[i].task.response.data);
                    if (!re.exec(value.result.body)) {
                        value.output.msg.push(value.result.body + ' not includes ' + value.task.response.data);
                    }
                } else {
                    if ('object' === typeof value.task.response.data) {
                        try {
                            if (JSON.stringify(value.task.response.data) !== value.result.body) {
                                value.output.msg.push(JSON.stringify(value.task.response.data) + msgPart + value.result.body);
                            }
                        } catch (e) {
                            value.output.msg.push("result body isn't right json");
                        }
                    } else {
                        if (value.task.response.data !== value.result.body) {
                            value.output.msg.push(value.task.response.data + msgPart + value.result.body);
                        }
                    }
                }
            }
            if (value.output.msg.length === 0) {
                value.output.pass = true;
            }
        }
    });
    return results;
}
