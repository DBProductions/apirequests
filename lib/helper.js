import Joi from 'joi';
import pc from 'picocolors';
import logSymbols from 'log-symbols';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/**
 * Check uri
 */
export const checkUri = (s) => {
    const r = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-/]))?/;
    return r.test(s);
};

const buildRequestBody = (task) => {
    if (task.form) {
        return new URLSearchParams(task.form).toString();
    }
    return task.body;
};

/**
 * Do the request with native fetch
 */
export const caller = async (opts) => {
    if (!opts || !opts.uri) {
        throw new Error('undefined is not a valid uri or options object.');
    }
    const start = Date.now();
    const response = await fetch(opts.uri, {
        method: opts.method,
        headers: opts.headers,
        body: buildRequestBody(opts),
        signal: AbortSignal.timeout(opts.timeout || 30000)
    });
    const body = await response.text();
    const headers = {};
    response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
    });
    return {
        statusCode: response.status,
        headers,
        body,
        num: opts.num,
        reqend: Date.now(),
        request: { host: new URL(opts.uri).host },
        requestTime: Math.round(Date.now() - start)
    };
};

/**
 * Build a single task
 */
const buildTask = (num, value) => {
    const options = {};
    options.num = num;
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
    if (value.timeout) {
        options.timeout = value.timeout;
    }
    return options;
};

/**
 * Build the tasks, make some checks and skip wrong data
 */
export const buildTasks = (opts, rules) => {
    let options;
    const tasks = {
        groups: [],
        singles: []
    };
    rules.forEach((value, key) => {
        if (value.group) {
            const label = 'g' + (tasks.groups.length + 1);
            const group = {
                name: value.name,
                key: value.key,
                tasks: []
            };
            value.group.forEach((gvalue, gkey) => {
                options = buildTask(label + '-' + (gkey + 1), gvalue);
                if (options.method && options.uri) {
                    group.tasks.push(options);
                } else if (opts.output === 'print') {
                    console.log(logSymbols.error,
                        pc.red('SKIP'),
                        value.method,
                        value.uri);
                }
            });
            tasks.groups.push(group);
        } else {
            options = buildTask(key + 1, value);
            if (options.method && options.uri) {
                tasks.singles.push(options);
            } else if (opts.output === 'print') {
                console.log(logSymbols.error,
                    pc.red('SKIP'),
                    value.method,
                    value.uri);
            }
        }
    });
    return tasks;
};

/**
 * Build tasks from an OpenAPI document.
 * Supports Swagger 2.0 (`host`/`basePath`/`produces`, `examples`) and
 * OpenAPI 3 (`servers`, `content`, `examples`) — examples are required to work.
 */
export const buildOpenApiTasks = (doc) => {
    const tasks = { groups: [], singles: [] };
    if (!doc || !doc.paths || typeof doc.paths !== 'object') {
        return tasks;
    }
    const isOas3 = Boolean(doc.openapi);
    let host = 'http://localhost:4000';
    if (isOas3 && Array.isArray(doc.servers) && doc.servers.length && doc.servers[0].url) {
        host = doc.servers[0].url.replace(/\/$/, '');
    } else if (!isOas3) {
        const scheme = Array.isArray(doc.schemes) && doc.schemes.length ? doc.schemes[0] : 'http';
        if (doc.host) {
            host = `${scheme}://${doc.host}`;
        }
        if (doc.basePath) {
            host += doc.basePath;
        }
    }
    let num = 1;
    for (const uriPath of Object.keys(doc.paths)) {
        const pathItem = doc.paths[uriPath];
        if (!pathItem || typeof pathItem !== 'object') {
            continue;
        }
        const pathParams = (pathItem.parameters || []).filter((p) => p && p.in);
        for (const method of Object.keys(pathItem)) {
            if (['parameters', 'servers', 'summary', 'description', '$ref'].includes(method)) {
                continue;
            }
            const operation = pathItem[method];
            if (!operation || !operation.responses) {
                continue;
            }
            const params = [...pathParams, ...((operation.parameters || []).filter((p) => p && p.in))];
            for (const status of Object.keys(operation.responses)) {
                const response = operation.responses[status];
                if (!response) {
                    continue;
                }
                const task = {
                    num,
                    method: method.toUpperCase(),
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                    }
                };
                let uri = uriPath;
                params.filter((p) => p.in === 'path').forEach((p) => {
                    const example = isOas3 ? exampleFor(p) : p.example;
                    if (example !== undefined) {
                        uri = uri.replace(`{${p.name}}`, String(example));
                    }
                });
                const queryParam = params.find((p) => p.in === 'query' && p.name);
                if (queryParam && !uri.includes('?')) {
                    uri += `?${queryParam.name}`;
                }
                task.uri = host + uri;

                if (isOas3) {
                    const contentType = mediaType(response.content);
                    task.response = { statuscode: Number(status) };
                    if (contentType) {
                        const data = exampleFor(response.content[contentType]);
                        task.response.headers = { contenttype: contentType };
                        if (data !== undefined) {
                            task.response.data = data;
                        }
                    }
                    const requestBody = operation.requestBody;
                    if (requestBody && requestBody.content) {
                        const bodyType = mediaType(requestBody.content);
                        if (bodyType) {
                            const bodyExample = exampleFor(requestBody.content[bodyType]);
                            if (bodyExample !== undefined) {
                                task.body = typeof bodyExample === 'string'
                                    ? bodyExample
                                    : JSON.stringify(bodyExample);
                                task.headers['Content-Type'] = bodyType;
                            }
                        }
                    }
                } else {
                    const bodyParam = params.find((p) => p.in === 'body');
                    if (bodyParam && bodyParam.example) {
                        task.body = JSON.stringify(bodyParam.example);
                    }
                    let data = response.example;
                    if (response.examples && response.examples['application/json']) {
                        data = response.examples['application/json'];
                    }
                    const produces = (pathItem.produces && pathItem.produces[0]) ||
                        (doc.produces && doc.produces[0]) ||
                        'application/json';
                    task.response = {
                        statuscode: Number(status),
                        headers: { contenttype: produces },
                        data
                    };
                }
                tasks.singles.push(task);
                num += 1;
            }
        }
    }
    return tasks;
};

const mediaType = (content) => {
    if (!content || typeof content !== 'object') {
        return undefined;
    }
    const keys = Object.keys(content);
    return keys.length ? keys[0] : undefined;
};

const exampleFor = (schema) => {
    if (schema && schema.example !== undefined) {
        return schema.example;
    }
    if (schema && schema.examples) {
        const keys = Object.keys(schema.examples);
        if (keys.length) {
            const example = schema.examples[keys[0]];
            return example && example.value !== undefined ? example.value : example;
        }
    }
    return undefined;
};

/**
 * Fill results with matching tasks and responses
 */
export const fillResults = (tasks, responses) => {
    const results = [];
    for (let i = 0, singleLength = tasks.singles.length; i < singleLength; i++) {
        const response = responses.find(o => o.num === tasks.singles[i].num);
        if (response) {
            const requestTime = Math.round((response.reqend - tasks.singles[i].reqstart));
            response.requestTime = requestTime;
            results.push({ task: tasks.singles[i], result: response });
        }
    }
    return results;
};

/**
 * Set the common output
 * @param {Object} value
 */
export const setCommonOutput = (value) => {
    const msgPart = ' is not equal ';
    if (value.output.msg === undefined) {
        value.output.msg = [];
    }
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
                value.output.msg.push(value.task.response.headers.cachecontrol + msgPart + value.result.headers['cache-control']);
            }
        }
    }
    // Body
    if (value.task.response.data) {
        let resultBody = value.result.body;
        if (value.result.headers && value.result.headers['content-type'] === 'application/json') {
            try {
                if (value.result.body) {
                    resultBody = JSON.parse(value.result.body);
                }
            } catch (e) {
                value.output.msg.push('parse error');
            }
        }

        if (value.task.response.regex) {
            try {
                const re = new RegExp(value.task.response.data);
                if (!re.exec(value.result.body)) {
                    value.output.msg.push(`${value.result.body} not includes ${value.task.response.data}`);
                }
            } catch (e) {
                value.output.msg.push(`invalid regex: ${value.task.response.data}`);
            }
        } else if (value.task.response.schema) {
            const schema = typeof value.task.response.data === 'string'
                ? Joi.any().valid(value.task.response.data)
                : value.task.response.data;
            const result = schema.validate(resultBody);
            if (result.error) {
                value.output.msg.push(result.error.details[0].message);
            }
        } else {
            if (typeof resultBody === 'object') {
                if (typeof value.task.response.data === 'string') {
                    try {
                        const requestBody = JSON.parse(value.task.response.data);
                        if (JSON.stringify(requestBody) !== JSON.stringify(resultBody)) {
                            value.output.msg.push(value.task.response.data + msgPart + value.result.body);
                        }
                    } catch (e) {
                        value.output.msg.push('parse error');
                    }
                } else {
                    if (JSON.stringify(value.task.response.data) !== JSON.stringify(resultBody)) {
                        value.output.msg.push(JSON.stringify(value.task.response.data) + msgPart + value.result.body);
                    }
                }
            } else {
                if (value.task.response.data !== value.result.body) {
                    value.output.msg.push(value.task.response.data + msgPart + value.result.body);
                }
            }
        }
    }
    return value;
};

/**
 * Set the output property of the results object
 */
export const setOutputs = (results) => {
    results.forEach((value, key) => {
        value.output = { msg: [] };
        if (value.task.response) {
            value.output.pass = false;
            setCommonOutput(value);
            if (value.output.msg.length === 0) {
                value.output.pass = true;
            }
        }
    });
    return results;
};

/**
 * Set the output property of the group results object
 */
export const setGroupOutputs = (groups) => {
    groups.forEach((group, key) => {
        group.tasks.forEach((item) => {
            item.output = { msg: [] };
            if (item.task.response) {
                item.output.pass = false;
                setCommonOutput(item);
                if (item.output.msg.length === 0) {
                    item.output.pass = true;
                }
            }
        });
    });
    return groups;
};
