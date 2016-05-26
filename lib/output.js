/**
 * Output functions
 */
"use strict";
let colors = require('colors');
let logSymbols = require('log-symbols');
/**
 * Print results on console
 */
exports.printResults = function (results, startTime) {
    let passed = 0,
        failed = 0,
        msg = '',
        requestTime,
        finishMsg,
        i,
        difference = Math.round((new Date().getTime() - startTime));
    for (i = 0; i < results.length; i++) {
        msg = '';
        requestTime = Math.round((results[i].result.reqend - results[i].task.reqstart));
        requestTime +=  ' milliseconds';
        if (results[i].task.delay) {
            requestTime +=  ' delayed with ' + results[i].task.delay;
        }
        requestTime +=  '\n';
        if (!results[i].output.pass && results[i].task.response) {
            if (results[i].output.msg.length > 0) {
                results[i].output.msg.forEach(function(value) {
                    msg += '\t- ' + value.trim() + '\n';
                });
            }
            console.log(logSymbols.error,
                        colors.red('FAIL') + '  - ' + results[i].task.num,
                        results[i].task.method,
                        results[i].task.uri,
                        'in ' + requestTime,
                        msg);
            failed += 1;
        } else {
            if (results[i].task.response) {
                console.log(logSymbols.success,
                            colors.green('PASS') + '  - ' + results[i].task.num,
                            results[i].task.method,
                            results[i].task.uri,
                            'in ' + requestTime);
                passed += 1;
            } else {
                console.log(logSymbols.info,
                            colors.blue('RUN') + '  - ' + results[i].task.num,
                            results[i].task.method,
                            results[i].task.uri,
                            'in ' + requestTime);
            }
        }
    }
    finishMsg = 'Finish ' + results.length;
    if (results.length === 1) { finishMsg += ' task '; } else { finishMsg += ' tasks '; }
    finishMsg +=  'in ' + difference + ' milliseconds.';
    console.log(finishMsg);
    msg = 'Have passed ' + passed + ' and failed ' + failed;
    if (failed === 1) { msg += ' task.\n'; } else { msg += ' tasks.\n'; }
    if (failed > 0) { console.log(logSymbols.error, colors.red(msg)); } else { console.log(logSymbols.success, colors.green(msg)); }
}

/**
 * Write results to html file
 */
exports.writeResults = function (results, opts, startTime) {
    let passed = 0,
        failed = 0,
        requestTime,
        i,
        difference = Math.round((new Date().getTime() - startTime)),
        content = '<html><head>';
    if (opts.loop) {
        content += '<meta http-equiv="refresh" content="' + Math.round(opts.loop / 1000) + '">';
    }
    content += '<style>.error{color:red;}.pass{color:green;}</style></head><body><h1>apirequests report</h1>';
    for (i = 0; i < results.length; i++) {
        requestTime = Math.round((results[i].result.reqend - results[i].task.reqstart));
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
 * Store results in MongoDB
 */
exports.storeResults = function (results, opts, startTime) {
    var MongoClient = require('mongodb').MongoClient,
        docs;
    MongoClient.connect(opts.connectionurl, function(err, db) {
      if (err) { throw err; }
      docs = [];
      for (var i = 0; i < results.length; i++) {
        docs.push({output: results[i].output, task: results[i].task});
      }
      db.collection(opts.collection).insert(docs, function(err, response) {
        if (err) { throw err; }
        console.log(colors.green('Saved to ' + opts.connectionurl + ' in ' + opts.collection), response.result);
        db.close();
      });
    });
}
