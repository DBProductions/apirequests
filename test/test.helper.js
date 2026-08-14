import Joi from 'joi';
import test from 'ava';
import * as helper from '../lib/helper.js';
import { startServer } from './helpers/http-server.js';

let server;
let baseUrl;
test.before(async () => {
    server = await startServer();
    baseUrl = server.baseUrl;
});
test.after(async () => {
    await server.close();
});

/**
 * checkUri with different cases
 */
test('checkUri', t => {
    t.plan(8);
    [
        { input: 'http://www.google.com', expected: true },
        { input: 'www.google.com', expected: false },
        { input: 'http//www.google.com/', expected: false },
        { input: 'http:/www.google.com/', expected: false },
        { input: 'http://www.google.com?q=search', expected: true },
        { input: 'www.google.com?q=search&foo=bar', expected: false },
        { input: 'http://www.google.com?q=search&foo=bar', expected: true },
        { input: 'ftp://www.google.com', expected: false }
    ].forEach(item => {
        t.is(helper.checkUri(item.input), item.expected);
    });
});

/**
 * make different requests
 */
test('caller', async t => {
    t.plan(4);
    await helper.caller().catch((err) => {
        t.is(err.message, 'undefined is not a valid uri or options object.');
    });
    await helper.caller({ num: 1, uri: `${baseUrl}/ok` }).then((val) => {
        t.is(val.statusCode, 200);
        t.truthy(val.num);
        t.truthy(val.reqend);
    });
});

/**
 * build different tasks
 */
test('buildTasks', t => {
    t.plan(10);
    let task;
    [
        {
            input: [],
            expected: { singles: [], groups: [] }
        },
        {
            input: [{}],
            expected: { singles: [], groups: [] }
        },
        {
            input: [{ uri: 'http://www.google.com', response: {} }],
            expected: { singles: [{ method: 'GET', num: 1, uri: 'http://www.google.com', response: {} }], groups: [] }
        },
        {
            input: [{ method: 'put', uri: 'http://www.google.com', response: {} }],
            expected: { singles: [{ method: 'PUT', num: 1, uri: 'http://www.google.com', response: {} }], groups: [] }
        },
        {
            input: [{ method: 'del', uri: 'http://www.google.com', response: {} }],
            expected: { singles: [], groups: [] }
        },
        {
            input: [{ uri: 'www.google.com', headers: {}, form: {}, body: {} }],
            expected: { singles: [], groups: [] }
        },
        {
            input: [{ group: [{}] }],
            expected: { singles: [], groups: [{ key: undefined, name: undefined, tasks: [] }] }
        },
        {
            input: [{ group: [{ uri: 'http://www.google.com' }] }],
            expected: { singles: [], groups: [{ key: undefined, name: undefined, tasks: [{ method: 'GET', num: 'g1-1', uri: 'http://www.google.com' }] }] }
        },
        {
            input: [{ group: [{ uri: 'http://www.google.com' }, { uri: 'http://www.bing.com' }] }],
            expected: { singles: [], groups: [{ key: undefined, name: undefined, tasks: [{ method: 'GET', num: 'g1-1', uri: 'http://www.google.com' }, { method: 'GET', num: 'g1-2', uri: 'http://www.bing.com' }] }] }
        },
        {
            input: [{ group: [{ uri: 'http://www.google.com' }] }, { group: [{ uri: 'http://www.google.com' }] }],
            expected: { singles: [], groups: [{ key: undefined, name: undefined, tasks: [{ method: 'GET', num: 'g1-1', uri: 'http://www.google.com' }] }, { key: undefined, name: undefined, tasks: [{ method: 'GET', num: 'g2-1', uri: 'http://www.google.com' }] }] }
        }
    ].forEach(item => {
        task = helper.buildTasks({}, item.input);
        t.deepEqual(task, item.expected);
    });
});

/**
 * build tasks from a Swagger 2.0 document
 */
test('buildOpenApiTasks swagger 2.0', t => {
    const doc = {
        swagger: '2.0',
        schemes: ['https'],
        host: 'api.example.com',
        basePath: '/v1',
        paths: {
            '/users/{id}': {
                get: {
                    produces: ['application/json'],
                    parameters: [
                        { name: 'id', in: 'path', required: true, example: '123' },
                        { name: 'q', in: 'query', type: 'string' }
                    ],
                    responses: {
                        200: {
                            description: 'ok',
                            examples: { 'application/json': { id: 123 } }
                        }
                    }
                }
            },
            '/users': {
                post: {
                    parameters: [
                        { name: 'body', in: 'body', schema: { type: 'object' }, example: { name: 'apirequests' } }
                    ],
                    responses: {
                        201: { description: 'created', example: { name: 'apirequests' } }
                    }
                }
            }
        }
    };
    const expected = {
        groups: [],
        singles: [
            {
                num: 1,
                method: 'GET',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                uri: 'https://api.example.com/v1/users/123?q',
                response: { statuscode: 200, headers: { contenttype: 'application/json' }, data: { id: 123 } }
            },
            {
                num: 2,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                uri: 'https://api.example.com/v1/users',
                body: JSON.stringify({ name: 'apirequests' }),
                response: { statuscode: 201, headers: { contenttype: 'application/json' }, data: { name: 'apirequests' } }
            }
        ]
    };
    t.deepEqual(helper.buildOpenApiTasks(doc), expected);
});

/**
 * build tasks from an OpenAPI 3 document
 */
test('buildOpenApiTasks openapi 3', t => {
    const doc = {
        openapi: '3.0.0',
        servers: [{ url: 'https://api.example.com/v1/' }],
        paths: {
            '/pets/{petId}': {
                parameters: [
                    { name: 'petId', in: 'path', required: true, schema: { type: 'string' }, example: '42' }
                ],
                get: {
                    responses: {
                        200: {
                            description: 'ok',
                            content: {
                                'application/json': {
                                    schema: { type: 'object' },
                                    example: { id: 42 }
                                }
                            }
                        }
                    }
                },
                post: {
                    requestBody: {
                        content: {
                            'application/json': {
                                schema: { type: 'object' },
                                example: { name: 'rex' }
                            }
                        }
                    },
                    responses: {
                        201: {
                            description: 'created',
                            content: {
                                'application/json': {
                                    schema: { type: 'object' },
                                    examples: {
                                        ok: { value: { id: 42, name: 'rex' } }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };
    const expected = {
        groups: [],
        singles: [
            {
                num: 1,
                method: 'GET',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                uri: 'https://api.example.com/v1/pets/42',
                response: { statuscode: 200, headers: { contenttype: 'application/json' }, data: { id: 42 } }
            },
            {
                num: 2,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                uri: 'https://api.example.com/v1/pets/42',
                body: JSON.stringify({ name: 'rex' }),
                response: { statuscode: 201, headers: { contenttype: 'application/json' }, data: { id: 42, name: 'rex' } }
            }
        ]
    };
    t.deepEqual(helper.buildOpenApiTasks(doc), expected);
});

/**
 * build tasks from an empty document
 */
test('buildOpenApiTasks empty document', t => {
    t.deepEqual(helper.buildOpenApiTasks({}), { groups: [], singles: [] });
    t.deepEqual(helper.buildOpenApiTasks(), { groups: [], singles: [] });
});

/**
 * build tasks resolving $ref components
 */
test('buildOpenApiTasks resolves $ref components', t => {
    const doc = {
        openapi: '3.0.0',
        servers: [{ url: 'https://api.example.com/v1/' }],
        paths: {
            '/pets/{petId}': {
                parameters: [
                    { $ref: '#/components/parameters/PetId' }
                ],
                get: {
                    responses: {
                        200: {
                            description: 'ok',
                            content: {
                                'application/json': {
                                    schema: { $ref: '#/components/schemas/Pet' }
                                }
                            }
                        },
                        404: {
                            $ref: '#/components/responses/NotFound'
                        }
                    }
                }
            }
        },
        components: {
            parameters: {
                PetId: {
                    name: 'petId',
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                    example: '7'
                }
            },
            schemas: {
                Pet: { type: 'object', example: { id: 42, name: 'rex' } }
            },
            responses: {
                NotFound: { description: 'not found' }
            }
        }
    };
    const expected = {
        groups: [],
        singles: [
            {
                num: 1,
                method: 'GET',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                uri: 'https://api.example.com/v1/pets/7',
                response: { statuscode: 200, headers: { contenttype: 'application/json' }, data: { id: 42, name: 'rex' } }
            },
            {
                num: 2,
                method: 'GET',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                uri: 'https://api.example.com/v1/pets/7',
                response: { statuscode: 404 }
            }
        ]
    };
    t.deepEqual(helper.buildOpenApiTasks(doc), expected);
});

/**
 * fill results with matching tasks and responses
 */
test('fillResults', t => {
    let results;
    [
        {
            input: [
                { singles: [] },
                []
            ],
            expected: []
        },
        {
            input: [
                { singles: [{ num: 123 }] },
                [{ num: 456 }]
            ],
            expected: []
        },
        {
            input: [
                { singles: [{ num: 123, reqstart: 1 }] },
                [{ num: 123, reqend: 2 }]
            ],
            expected: [{ task: { num: 123, reqstart: 1 }, result: { num: 123, reqend: 2, requestTime: 1 } }]
        },
        {
            input: [
                { singles: [{ num: 123, reqstart: 1 }, { num: 456, reqstart: 3 }] },
                [{ num: 123, reqend: 2 }, { num: 456, reqend: 4 }]
            ],
            expected: [
                { task: { num: 123, reqstart: 1 }, result: { num: 123, reqend: 2, requestTime: 1 } },
                { task: { num: 456, reqstart: 3 }, result: { num: 456, reqend: 4, requestTime: 1 } }
            ]
        }
    ].forEach(item => {
        results = helper.fillResults(item.input[0], item.input[1]);
        t.deepEqual(results, item.expected);
    });
});

test('setCommonOutput', t => {
    let outputs;
    const schema = Joi.object().keys({ test: Joi.string().required() });
    [
        {
            input: { task: { response: { statuscode: 200 } }, result: { statusCode: 400 }, output: { msg: [] } },
            expected: { task: { response: { statuscode: 200 } }, result: { statusCode: 400 }, output: { msg: ['200 is not equal 400'] } }
        },
        {
            input: { task: { response: { host: 'x' } }, result: { request: { host: 'y' } }, output: { msg: [] } },
            expected: { task: { response: { host: 'x' } }, result: { request: { host: 'y' } }, output: { msg: ['x is not equal y'] } }
        },
        {
            input: { task: { response: { time: 12 } }, result: { requestTime: 13 }, output: { msg: [] } },
            expected: { task: { response: { time: 12 } }, result: { requestTime: 13 }, output: { msg: ['13 greater than 12'] } }
        },
        {
            input: { task: { response: { headers: { contenttype: 'x' } } }, result: { headers: { 'content-type': 'y' } }, output: { msg: [] } },
            expected: { task: { response: { headers: { contenttype: 'x' } } }, result: { headers: { 'content-type': 'y' } }, output: { msg: ['x is not equal y'] } }
        },
        {
            input: { task: { response: { headers: { contentlength: 3 } } }, result: { headers: { 'content-length': 4 } }, output: { msg: [] } },
            expected: { task: { response: { headers: { contentlength: 3 } } }, result: { headers: { 'content-length': 4 } }, output: { msg: ['3 is not equal 4'] } }
        },
        {
            input: { task: { response: { headers: { server: 'x' } } }, result: { headers: { server: 'y' } }, output: { msg: [] } },
            expected: { task: { response: { headers: { server: 'x' } } }, result: { headers: { server: 'y' } }, output: { msg: ['x is not equal y'] } }
        },
        {
            input: { task: { response: { headers: { cachecontrol: 3 } } }, result: { headers: { 'cache-control': 4 } }, output: { msg: [] } },
            expected: { task: { response: { headers: { cachecontrol: 3 } } }, result: { headers: { 'cache-control': 4 } }, output: { msg: ['3 is not equal 4'] } }
        },
        {
            input: { task: { response: { data: 'x' } }, result: { body: 'y' }, output: { msg: [] } },
            expected: { task: { response: { data: 'x' } }, result: { body: 'y' }, output: { msg: ['x is not equal y'] } }
        },
        {
            input: { task: { response: { data: {} } }, result: { body: {} }, output: { msg: [] } },
            expected: { task: { response: { data: {} } }, result: { body: {} }, output: { msg: [] } }
        },
        {
            input: { task: { response: { data: 1 } }, result: { body: {} }, output: { msg: [] } },
            expected: { task: { response: { data: 1 } }, result: { body: {} }, output: { msg: ['1 is not equal [object Object]'] } }
        },
        {
            input: { task: { response: { data: 'xa', schema: true } }, result: { body: 'xyz' }, output: { msg: [] } },
            expected: { task: { response: { data: 'xa', schema: true } }, result: { body: 'xyz' }, output: { msg: ['"value" must be [xa]'] } }
        },
        {
            input: { task: { response: { data: schema, schema: true } }, result: { headers: { 'content-type': 'application/json' }, body: '{}' }, output: { msg: [] } },
            expected: { task: { response: { data: schema, schema: true } }, result: { headers: { 'content-type': 'application/json' }, body: '{}' }, output: { msg: ['"test" is required'] } }
        },
        {
            input: { task: { response: { data: schema, schema: true } }, result: { headers: { 'content-type': 'application/json' }, body: '{"test": 1}' }, output: { msg: [] } },
            expected: { task: { response: { data: schema, schema: true } }, result: { headers: { 'content-type': 'application/json' }, body: '{"test": 1}' }, output: { msg: ['"test" must be a string'] } }
        },
        {
            input: { task: { response: { data: schema, schema: true } }, result: { headers: { 'content-type': 'application/json' }, body: '{"test": "x"}' }, output: { msg: [] } },
            expected: { task: { response: { data: schema, schema: true } }, result: { headers: { 'content-type': 'application/json' }, body: '{"test": "x"}' }, output: { msg: [] } }
        },
        {
            input: { task: { response: { data: 'xa', regex: true } }, result: { body: 'xyz' }, output: { msg: [] } },
            expected: { task: { response: { data: 'xa', regex: true } }, result: { body: 'xyz' }, output: { msg: ['xyz not includes xa'] } }
        },
        {
            input: { task: { response: { data: 'x*', regex: true } }, result: { body: 'xyz' }, output: { msg: [] } },
            expected: { task: { response: { data: 'x*', regex: true } }, result: { body: 'xyz' }, output: { msg: [] } }
        },
        {
            input: { task: { response: { data: '[', regex: true } }, result: { body: 'xyz' }, output: { msg: [] } },
            expected: { task: { response: { data: '[', regex: true } }, result: { body: 'xyz' }, output: { msg: ['invalid regex: ['] } }
        }
    ].forEach(item => {
        outputs = helper.setCommonOutput(item.input);
        t.deepEqual(outputs, item.expected);
    });
});

/**
 * set outputs
 */
test('setOutputs', t => {
    t.plan(4);
    let outputs;
    [
        {
            input: [],
            expected: []
        },
        {
            input: [{ task: { response: {} } }],
            expected: [{ task: { response: {} }, output: { msg: [], pass: true } }]
        },
        {
            input: [{ task: { response: { statuscode: 200 } }, result: {} }],
            expected: [{ task: { response: { statuscode: 200 } }, result: {}, output: { msg: ['200 is not equal undefined'], pass: false } }]
        },
        {
            input: [{ task: { response: { host: 'localhost' } }, result: { request: {} } }],
            expected: [{ task: { response: { host: 'localhost' } }, result: { request: {} }, output: { msg: ['localhost is not equal undefined'], pass: false } }]
        }
    ].forEach(item => {
        outputs = helper.setOutputs(item.input);
        t.deepEqual(outputs, item.expected);
    });
});

/**
 * set group outputs
 */
test('setGroupOutputs', t => {
    t.plan(3);
    let outputs;
    [
        {
            input: [],
            expected: []
        },
        {
            input: [{ tasks: [] }],
            expected: [{ tasks: [] }]
        },
        {
            input: [{ tasks: [{ task: { response: {} } }] }],
            expected: [{ tasks: [{ task: { response: {} }, output: { msg: [], pass: true } }] }]
        }
    ].forEach(item => {
        outputs = helper.setGroupOutputs(item.input);
        t.deepEqual(outputs, item.expected);
    });
});
