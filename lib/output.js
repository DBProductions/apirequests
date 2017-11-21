/**
 * Output functions
 */
'use strict';
const colors = require('colors');
const logSymbols = require('log-symbols');
/**
 * Print results on console
 */
exports.printResults = (results, opts, startTime) => {
    let passed = 0;
    let failed = 0;
    let msg = '';
    let requestTime;
    let finishMsg;
    let i;
    let difference = Math.round((new Date().getTime() - startTime));
    for (i = 0; i < results.single.length; i++) {
        msg = '';
        requestTime = `${results.single[i].result.requestTime} milliseconds\n`;
        if (!results.single[i].output.pass && results.single[i].task.response) {
            if (results.single[i].output.msg.length > 0) {
                results.single[i].output.msg.forEach((value) => {
                    msg += '\t- ' + value.trim() + '\n';
                });
            }
            console.log(logSymbols.error,
                colors.red('FAIL') + '  - ' + results.single[i].task.num,
                results.single[i].task.method,
                results.single[i].task.uri,
                'in ' + requestTime,
                msg);
            failed += 1;
        } else {
            if (results.single[i].task.response) {
                if (!opts.printOnlyFailure) {
                    console.log(logSymbols.success,
                        colors.green('PASS') + '  - ' + results.single[i].task.num,
                        results.single[i].task.method,
                        results.single[i].task.uri,
                        'in ' + requestTime);
                }
                passed += 1;
            } else {
                if (!opts.printOnlyFailure) {
                    console.log(logSymbols.info,
                        colors.blue('RUN') + '  - ' + results.single[i].task.num,
                        results.single[i].task.method,
                        results.single[i].task.uri,
                        'in ' + requestTime);
                }
            }
        }
    }
    for (i = 0; i < results.group.length; i++) {
        let groupName = results.group[i].name || 'Group';
        console.log(colors.underline(` ${groupName} `));
        results.group[i].tasks.forEach((val) => {
            msg = '';
            requestTime = `${val.result.requestTime} milliseconds\n`;
            if (!val.output.pass && val.task.response) {
                if (val.output.msg.length > 0) {
                    val.output.msg.forEach((value) => {
                        msg += '\t- ' + value.trim() + '\n';
                    });
                }
                console.log(logSymbols.error,
                    colors.red('FAIL') + '  - ' + val.task.num,
                    val.task.method,
                    val.task.uri,
                    'in ' + requestTime,
                    msg);
                failed += 1;
            } else {
                if (val.task.response) {
                    if (!opts.printOnlyFailure) {
                        console.log(logSymbols.success,
                            colors.green('PASS') + '  - ' + val.task.num,
                            val.task.method,
                            val.task.uri,
                            'in ' + requestTime);
                    }
                    passed += 1;
                } else {
                    if (!opts.printOnlyFailure) {
                        console.log(logSymbols.info,
                            colors.blue('RUN') + '  - ' + val.task.num,
                            val.task.method,
                            val.task.uri,
                            'in ' + requestTime);
                    }
                }
            }
        });
    }
    const countGroupTasks = results.group.map((group) => {
        return group.tasks.length;
    }).reduce((a, b) => a + b, 0);
    finishMsg = `Finish ${results.single.length} tasks ${results.group.length} Groups (${countGroupTasks} tasks) `;
    finishMsg += `in ${difference} milliseconds.`;
    console.log(finishMsg);
    msg = `Have passed ${passed} and failed ${failed} tests\n`;
    if (failed > 0) {
        console.log(logSymbols.error, colors.red(msg));
        if (!opts.loop) {
            process.exit(1);
        }
    } else {
        console.log(logSymbols.success, colors.green(msg));
        if (!opts.loop) {
            process.exit(0);
        }
    }
};
/**
 * Write results to xml file
 */
exports.writeXml = (results, opts, startTime) => {
    let i;
    let XMLWriter = require('xml-writer');
    let xw = new XMLWriter();
    let msg;
    let data;
    let requestTime;
    let failures = 0;
    let testsuites = [];
    let difference = Math.round((new Date().getTime() - startTime));
    for (i = 0; i < results.single.length; i++) {
        requestTime = Math.round((results.single[i].result.reqend - results.single[i].task.reqstart));
        msg = '';
        if (results.single[i].output.msg.length > 0) {
            msg = results.single[i].output.msg.join(', ');
        }
        data = {uri: results.single[i].task.uri, time: requestTime, msg: msg};
        testsuites.push(data);
        if (!results.single[i].output.pass && results.single[i].task.response) {
            failures += 1;
        }
    }
    xw.startDocument();
    xw.startElement('testsuite');
    xw.writeAttribute('name', 'apirequests');
    xw.writeAttribute('tests', results.single.length);
    xw.writeAttribute('failures', failures);
    xw.writeAttribute('time', (difference / 1000));
    for (i = 0; i < testsuites.length; i++) {
        xw.startElement('testcase');
        xw.writeAttribute('name', testsuites[i]['uri']);
        xw.writeAttribute('time', (testsuites[i]['time'] / 1000));
        if (testsuites[i]['msg']) {
            xw.startElement('error');
            xw.writeAttribute('message', testsuites[i]['msg']);
            xw.endElement();
        }
        xw.endElement();
    }
    require('fs').writeFile(opts.outputPath + opts.outputFile, xw.toString(), function (err) {
        if (err) { throw err; }
        console.log(logSymbols.success,
            colors.green('Report file ' + opts.outputPath + opts.outputFile + ' saved!'));
        if (failures > 0) {
            if (!opts.loop) {
                process.exit(1);
            }
        } else {
            if (!opts.loop) {
                process.exit(0);
            }
        }
    });
};
/**
 * Write results to html file
 */
exports.writeHtml = (results, opts, startTime) => {
    let passed = 0;
    let failed = 0;
    let requestTime;
    let i;
    let difference = Math.round((new Date().getTime() - startTime));
    let content = '<html><head>';
    if (opts.loop) {
        content += `<meta http-equiv="refresh" content="${Math.round(opts.loop / 1000)}">`;
    }
    content += '<style>.error{color:red;}.pass{color:green;}</style></head><body><h1>apirequests HTML Report</h1>';
    for (i = 0; i < results.single.length; i++) {
        requestTime = `${results.single[i].result.requestTime} milliseconds`;
        if (!results.single[i].output.pass && results.single[i].task.response) {
            content += `<div><strong class="error">* FAIL</strong> - ${results.single[i].task.num} ${results.single[i].task.method} ${results.single[i].task.uri} in ${requestTime}<br>`;
            if (results.single[i].output.msg.length > 0) {
                results.single[i].output.msg.forEach((value) => {
                    content += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - ${value.trim()}<br>`;
                });
            }
            content += '</div><br>';
            failed += 1;
        } else {
            if (results.single[i].task.response) {
                content += `<div><span class="pass">* PASS</span> - ${results.single[i].task.num} ${results.single[i].task.method} ${results.single[i].task.uri} in ${requestTime}<br><br></div>`;
                passed += 1;
            } else {
                content += `<div><span class="pass">* RUN</span> - ${results.single[i].task.num} ${results.single[i].task.method} ${results.single[i].task.uri} in ${requestTime}<br><br></div>`;
            }
        }
    }
    for (i = 0; i < results.group.length; i++) {
        const groupName = results.group[i].name || 'Group';
        content += `<div><h3>${groupName}</h3></div>`;
        results.group[i].tasks.forEach((item) => {
            requestTime = `${item.result.requestTime} milliseconds\n`;
            if (!item.output.pass && item.task.response) {
                content += `<div><strong class="error">* FAIL</strong> - ${item.task.num} ${item.task.method} ${item.task.uri} in ${requestTime}<br>`;
                if (item.output.msg.length > 0) {
                    item.output.msg.forEach((value) => {
                        content += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - ${value.trim()}<br>`;
                    });
                }
                content += '</div><br>';
                failed += 1;
            } else {
                if (item.task.response) {
                    content += `<div><span class="pass">* PASS</span> - ${item.task.num} ${item.task.method} ${item.task.uri} in ${requestTime}<br><br></div>`;
                    passed += 1;
                } else {
                    content += `<div><span class="pass">* RUN</span> - ${item.task.num} ${item.task.method} ${item.task.uri} in ${requestTime}<br><br></div>`;
                }
            }
        });
    }
    const countGroupTasks = results.group.map((group) => {
        return group.tasks.length;
    }).reduce((a, b) => a + b, 0);
    content += `<div><h3>Result</h3></div>`;
    content += `<div>Finish ${results.single.length} tasks ${results.group.length} Groups (${countGroupTasks} tasks) in ${difference} milliseconds.</div>`;
    let msg = `<div>Have passed ${passed} and failed ${failed}`;
    if (failed === 1) {
        msg += ' task.</div>';
    } else {
        msg += ' tasks.</div>';
    }
    let cssClass = 'pass';
    if (failed > 0) {
        cssClass = 'error';
    }
    content += `<div><span class="${cssClass}">${msg}</span></div>`;
    content += '<br><br><br></body></html>';
    require('fs').writeFile(opts.outputPath + opts.outputFile, content, (err) => {
        if (err) { throw err; }
        console.log(logSymbols.success,
            colors.green('Report file ' + opts.outputPath + opts.outputFile + ' saved!'));
    });
};
/**
 * Store results in MongoDB
 */
exports.storeResults = (results, opts, startTime) => {
    let docs = [];
    let MongoClient = require('mongodb').MongoClient;
    MongoClient.connect(opts.connectionurl, (err, client) => {
        if (err) { throw err; }
        for (var i = 0; i < results.single.length; i++) {
            results.single[i].task.reqend = results.single[i].result.reqend;
            docs.push({output: results.single[i].output, task: results.single[i].task});
        }

        for (i = 0; i < results.group.length; i++) {
            const groupName = results.group[i].name || 'Group';
            let group = {name: groupName, tasks: []};
            results.group[i].tasks.forEach((item) => {
                group.tasks.push({output: item.output, task: item.task});
            });
            docs.push(group);
        }

        if (docs.length > 0) {
            const db = client.db(opts.database);
            let collection = db.collection(opts.collection);
            collection.insertMany(docs, (err, result) => {
                if (err) { throw err; }
                console.log(logSymbols.success,
                    colors.green(`${result.result.n} documents stored in databse`));
                client.close();
            });
        } else {
            client.close();
        }
    });
};
