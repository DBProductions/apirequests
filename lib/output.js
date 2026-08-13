/**
 * Output functions
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import pc from 'picocolors';
import logSymbols from 'log-symbols';
import { buildTestsuiteXml } from './xml.js';

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => {
    switch (c) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return c;
    }
});

const printTask = (item, opts, fail, pass, run) => {
    const requestTime = `${item.result.requestTime} milliseconds\n`;
    if (!item.output.pass && item.task.response) {
        let msg = '';
        if (item.output.msg.length > 0) {
            item.output.msg.forEach((value) => {
                msg += '\t- ' + value.trim() + '\n';
            });
        }
        fail(item, requestTime, msg);
    } else if (item.task.response) {
        pass(item, requestTime);
    } else {
        run(item, requestTime);
    }
};

/**
 * Count passed and failed tasks (tasks with a response expectation).
 */
export const countResults = (results) => {
    let passed = 0;
    let failed = 0;
    const count = (item) => {
        if (item.task.response && item.output) {
            if (item.output.pass) {
                passed += 1;
            } else {
                failed += 1;
            }
        }
    };
    for (const item of results.single) {
        count(item);
    }
    for (const group of results.group) {
        group.tasks.forEach(count);
    }
    return { passed, failed };
};

/**
 * Print results on console
 */
export const printResults = (results, opts, startTime) => {
    let passed = 0;
    let failed = 0;
    let i;
    const difference = Math.round((new Date().getTime() - startTime));

    const printFailed = (results, requestTime, msg) => {
        console.log(logSymbols.error,
            pc.red('FAIL') + '  - ' + results.task.num,
            results.task.method,
            results.task.uri,
            'in ' + requestTime,
            msg);
        failed += 1;
    };
    const printPassed = (results, requestTime) => {
        if (!opts.printOnlyFailure) {
            console.log(logSymbols.success,
                pc.green('PASS') + '  - ' + results.task.num,
                results.task.method,
                results.task.uri,
                'in ' + requestTime);
        }
        passed += 1;
    };
    const printRun = (results, requestTime) => {
        if (!opts.printOnlyFailure) {
            console.log(logSymbols.info,
                pc.blue('RUN') + '  - ' + results.task.num,
                results.task.method,
                results.task.uri,
                'in ' + requestTime);
        }
    };

    for (i = 0; i < results.single.length; i++) {
        printTask(results.single[i], opts, printFailed, printPassed, printRun);
    }
    for (i = 0; i < results.group.length; i++) {
        const groupName = results.group[i].name || 'Group';
        console.log(pc.underline(` ${groupName} `));
        results.group[i].tasks.forEach((val) => {
            printTask(val, opts, printFailed, printPassed, printRun);
        });
    }
    const countGroupTasks = results.group.map((group) => {
        return group.tasks.length;
    }).reduce((a, b) => a + b, 0);
    let finishMsg = `Finish ${results.single.length} tasks ${results.group.length} Groups (${countGroupTasks} tasks) `;
    finishMsg += `in ${difference} milliseconds.`;
    console.log(finishMsg);
    const msg = `Have passed ${passed} and failed ${failed} tests\n`;
    if (failed > 0) {
        console.log(logSymbols.error, pc.red(msg));
    } else {
        console.log(logSymbols.success, pc.green(msg));
    }
    return { passed, failed };
};

/**
 * Write results to xml file
 */
export const writeXml = async (results, opts, startTime) => {
    const difference = Math.round((new Date().getTime() - startTime));
    const content = buildTestsuiteXml(results, difference / 1000);
    const file = path.join(opts.outputPath, opts.outputFile);
    await fs.writeFile(file, content);
    console.log(logSymbols.success,
        pc.green(`Report file ${file} saved!`));
};

/**
 * Write results to html file
 */
export const writeHtml = async (results, opts, startTime) => {
    let passed = 0;
    let failed = 0;
    let requestTime;
    let i;
    const difference = Math.round((new Date().getTime() - startTime));
    let content = '<html><head>';
    if (opts.loop) {
        content += `<meta http-equiv="refresh" content="${Math.round(opts.loop / 1000)}">`;
    }
    content += '<style>.error{color:red;}.pass{color:green;}</style></head><body><h1>apirequests HTML Report</h1>';

    const renderTask = (item) => {
        requestTime = `${item.result.requestTime} milliseconds`;
        if (!item.output.pass && item.task.response) {
            content += `<div><strong class="error">* FAIL</strong> - ${escapeHtml(item.task.num)} ${escapeHtml(item.task.method)} ${escapeHtml(item.task.uri)} in ${requestTime}<br>`;
            if (item.output.msg.length > 0) {
                item.output.msg.forEach((value) => {
                    content += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - ${escapeHtml(value.trim())}<br>`;
                });
            }
            content += '</div><br>';
            failed += 1;
        } else if (item.task.response) {
            content += `<div><span class="pass">* PASS</span> - ${escapeHtml(item.task.num)} ${escapeHtml(item.task.method)} ${escapeHtml(item.task.uri)} in ${requestTime}<br><br></div>`;
            passed += 1;
        } else {
            content += `<div><span class="pass">* RUN</span> - ${escapeHtml(item.task.num)} ${escapeHtml(item.task.method)} ${escapeHtml(item.task.uri)} in ${requestTime}<br><br></div>`;
        }
    };

    for (i = 0; i < results.single.length; i++) {
        renderTask(results.single[i]);
    }
    for (i = 0; i < results.group.length; i++) {
        const groupName = results.group[i].name || 'Group';
        content += `<div><h3>${escapeHtml(groupName)}</h3></div>`;
        results.group[i].tasks.forEach((item) => {
            renderTask(item);
        });
    }
    const countGroupTasks = results.group.map((group) => {
        return group.tasks.length;
    }).reduce((a, b) => a + b, 0);
    content += '<div><h3>Result</h3></div>';
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
    const file = path.join(opts.outputPath, opts.outputFile);
    await fs.writeFile(file, content);
    console.log(logSymbols.success,
        pc.green(`Report file ${file} saved!`));
};

/**
 * Store results in MongoDB
 */
export const storeResults = async (results, opts) => {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(opts.connectionurl);
    try {
        await client.connect();
        const docs = [];
        for (const item of results.single) {
            item.task.reqend = item.result.reqend;
            docs.push({ output: item.output, task: item.task });
        }
        for (const group of results.group) {
            const groupName = group.name || 'Group';
            docs.push({
                name: groupName,
                tasks: group.tasks.map((item) => {
                    return { output: item.output, task: item.task };
                })
            });
        }
        if (docs.length > 0) {
            const db = client.db(opts.database);
            const collection = db.collection(opts.collection);
            const result = await collection.insertMany(docs);
            console.log(logSymbols.success,
                pc.green(`${result.insertedCount} documents stored in database`));
        }
    } finally {
        await client.close();
    }
};
