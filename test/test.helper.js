import Joi from 'joi'
import test from 'ava'
import helper from './../lib/helper'

/**
 * checkUri with different cases
 */
test('checkUri', t => {
    t.plan(7);
    [
        {input: 'http://www.google.com', expected: true},
        {input: 'www.google.com', expected: false},
        {input: 'http//www.google.com/', expected: false},
        {input: 'http:/www.google.com/', expected: false},
        {input: 'http://www.google.com?q=search', expected: true},
        {input: 'www.google.com?q=search&foo=bar', expected: false},
        {input: 'http://www.google.com?q=search&foo=bar', expected: true}
    ].forEach(item => {
        t.is(helper.checkUri(item.input), item.expected)
    })
})

/**
 * make different requests
 */
test('caller', async t => {
    t.plan(4);
    await helper.caller().catch((err) => {
        t.is(err.message, 'undefined is not a valid uri or options object.')
    })
    await helper.caller({num: 1, uri: 'http://www.google.com'}).then((val, body) => {
        t.is(val.statusCode, 200)
        t.truthy(val.num)
        t.truthy(val.reqend)
    })
})

/**
 * build different tasks
 */
test('buildTasks', t => {
    t.plan(10);
    let task
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
            input: [{uri:'http://www.google.com', response: {}}],
            expected: {singles: [{method: 'GET', num: 1, uri: 'http://www.google.com', response: {}}], groups: []}
        },
        {
            input: [{method: 'put', uri: 'http://www.google.com', response: {}}],
            expected: {singles: [{method: 'PUT', num: 1, uri: 'http://www.google.com', response: {}}], groups: []}
        },
        {
            input: [{method: 'del', uri: 'http://www.google.com', response: {}}],
            expected: {singles: [], groups: []}
        },
        {
            input: [{uri: 'www.google.com', headers:{}, form:{}, body: {}}],
            expected: {singles: [], groups: []}
        },
        {
            input: [{group: [{}]}],
            expected: {singles: [], groups: [{key: undefined, name: undefined, tasks: []}]}
        },
        {
            input: [{group: [{uri: 'http://www.google.com'}]}],
            expected: {singles: [], groups: [{key: undefined, name: undefined, tasks: [{method: 'GET', num: 'g1-1', uri: 'http://www.google.com'}]}]}
        },
        {
            input: [{group: [{uri: 'http://www.google.com'}, {uri: 'http://www.bing.com'}]}],
            expected: {singles: [], groups: [{key: undefined, name: undefined, tasks: [{method: 'GET', num: 'g1-1', uri: 'http://www.google.com'}, {method: 'GET', num: 'g1-2', uri: 'http://www.bing.com'}]}]}
        },
        {
            input: [{group: [{uri: 'http://www.google.com'}]}, {group: [{uri: 'http://www.google.com'}]}],
            expected: {singles: [], groups: [{key: undefined, name: undefined, tasks: [{method: 'GET', num: 'g1-1', uri: 'http://www.google.com'}]}, {key: undefined, name: undefined, tasks: [{method: 'GET', num: 'g2-1', uri: 'http://www.google.com'}]}]}
        }
    ].forEach(item => {
        task = helper.buildTasks({}, item.input)
        t.deepEqual(task, item.expected)
    })
})

test('fillResults', t => {
    let results
    [
        {
            input: [
                {singles: []},
                []
            ],
            expected: []
        },
        {
            input: [
                {singles: [{num: 123}]},
                [{num: 456}]
            ],
            expected: []
        },
        {
            input: [
                {singles: [{num: 123, reqstart: 1}]},
                [{num: 123, reqend: 2}]
            ],
            expected: [{task: {num: 123, reqstart: 1}, result: {num: 123, reqend: 2, requestTime: 1}}]
        },
        {
            input: [
                {singles: [{num: 123, reqstart: 1}, {num: 456, reqstart: 3}]},
                [{num: 123, reqend: 2}, {num: 456, reqend: 4}]
            ],
            expected: [
                {task: {num: 123, reqstart: 1}, result: {num: 123, reqend: 2, requestTime: 1}},
                {task: {num: 456, reqstart: 3}, result: {num: 456, reqend: 4, requestTime: 1}}
            ]
        }
    ].forEach(item => {
        results = helper.fillResults(item.input[0], item.input[1])
        t.deepEqual(results, item.expected)
    })
})

test('setCommonOutput', t => {
    let outputs
    [
        {
            input: {task: {response: {statuscode: 200}}, result: {statusCode: 400}, output: {msg: []}},
            expected: {task: {response: {statuscode: 200}}, result: {statusCode: 400}, output: {msg: ['200 is not equal 400']}}
        },
        {
            input: {task: {response: {host: 'x'}}, result: {request: {host: 'y'}}, output: {msg: []}},
            expected: {task: {response: {host: 'x'}}, result: {request: {host: 'y'}}, output: {msg: ['x is not equal y']}}
        },
        {
            input: {task: {response: {time: 12}}, result: {requestTime: 13}, output: {msg: []}},
            expected: {task: {response: {time: 12}}, result: {requestTime: 13}, output: {msg: ['13 greater than 12']}}
        },
        {
            input: {task: {response: {headers: {contenttype: 'x'}}}, result: {headers: {'content-type': 'y'}}, output: {msg: []}},
            expected: {task: {response: {headers: {contenttype: 'x'}}}, result: {headers: {'content-type': 'y'}}, output: {msg: ['x is not equal y']}}
        },
        {
            input: {task: {response: {headers: {contentlength: 3}}}, result: {headers: {'content-length': 4}}, output: {msg: []}},
            expected: {task: {response: {headers: {contentlength: 3}}}, result: {headers: {'content-length': 4}}, output: {msg: ['3 is not equal 4']}}
        },
        {
            input: {task: {response: {headers: {server: 'x'}}}, result: {headers: {server: 'y'}}, output: {msg: []}},
            expected: {task: {response: {headers: {server: 'x'}}}, result: {headers: {server: 'y'}}, output: {msg: ['x is not equal y']}}
        },
        {
            input: {task: {response: {headers: {cachecontrol: 3}}}, result: {headers: {'cache-control': 4}}, output: {msg: []}},
            expected: {task: {response: {headers: {cachecontrol: 3}}}, result: {headers: {'cache-control': 4}}, output: {msg: ['3 is not equal 4']}}
        },
        {
            input: {task: {response: {data: 'x'}}, result: {body: 'y'}, output: {msg: []}},
            expected: {task: {response: {data: 'x'}}, result: {body: 'y'}, output: {msg: ['x is not equal y']}}
        },
        {
            input: {task: {response: {data: {}}}, result: {body: {}}, output: {msg: []}},
            expected: {task: {response: {data: {}}}, result: {body: {}}, output: {msg: ['{} is not equal [object Object]']}}
        },
        {
            input: {task: {response: {data: 1}}, result: {body: {}}, output: {msg: []}},
            expected: {task: {response: {data: 1}}, result: {body: {}}, output: {msg: ['1 is not equal [object Object]']}}
        },
        {
            input: {task: {response: {data: 'xa', schema: true}}, result: {body: 'xyz'}, output: {msg: []}},
            expected: {task: {response: {data: 'xa', schema: true}}, result: {body: 'xyz'}, output: {msg: ['parse error']}}
        },
        {
            input: {task: {response: {data: 'xa', schema: true}}, result: {body: '{}'}, output: {msg: []}},
            expected: {task: {response: {data: 'xa', schema: true}}, result: {body: '{}'}, output: {msg: ['"value" must be a string']}}
        },
        {
            input: {task: {response: {data: Joi.object().keys({test: Joi.string().required()}), schema: true}}, result: {body: '{}'}, output: {msg: []}},
            expected: {task: {response: {data: Joi.object().keys({test: Joi.string().required()}), schema: true}}, result: {body: '{}'}, output: {msg: ['"test" is required']}}
        },
        {
            input: {task: {response: {data: Joi.object().keys({test: Joi.string().required()}), schema: true}}, result: {body: '{"test": 1}'}, output: {msg: []}},
            expected: {task: {response: {data: Joi.object().keys({test: Joi.string().required()}), schema: true}}, result: {body: '{"test": 1}'}, output: {msg: ['"test" must be a string']}}
        },
        {
            input: {task: {response: {data: Joi.object().keys({test: Joi.string().required()}), schema: true}}, result: {body: '{"test": "x"}'}, output: {msg: []}},
            expected: {task: {response: {data: Joi.object().keys({test: Joi.string().required()}), schema: true}}, result: {body: '{"test": "x"}'}, output: {msg: []}}
        },
        {
            input: {task: {response: {data: 'xa', regex: true}}, result: {body: 'xyz'}, output: {msg: []}},
            expected: {task: {response: {data: 'xa', regex: true}}, result: {body: 'xyz'}, output: {msg: ['xyz not includes xa']}}
        },
        {
            input: {task: {response: {data: 'x*', regex: true}}, result: {body: 'xyz'}, output: {msg: []}},
            expected: {task: {response: {data: 'x*', regex: true}}, result: {body: 'xyz'}, output: {msg: []}}
        }
    ].forEach(item => {
        outputs = helper.setCommonOutput(item.input)
        t.deepEqual(outputs, item.expected)
    })
})

/**
 * set outputs
 */
test('setOutputs', t => {
    t.plan(4);
    let outputs
    [
        {
            input: [],
            expected: []
        },
        {
            input: [{task: {response: {}}}],
            expected: [{task: {response: {}}, output: {msg: [], pass: true}}]
        },
        {
            input: [{task: {response: {statuscode: 200}}, result: {}}],
            expected: [{task: {response: {statuscode: 200}}, result: {}, output: {msg: ['200 is not equal undefined'], pass: false}}]
        },
        {
            input: [{task: {response: {host: 'localhost'}}, result: {request: {}}}],
            expected: [{task: {response: {host: 'localhost'}}, result: {request: {}}, output: {msg: ['localhost is not equal undefined'], pass: false}}]
        }
    ].forEach(item => {
        outputs = helper.setOutputs(item.input)
        t.deepEqual(outputs, item.expected)
    })
})

/**
 * set group outputs
 */
test('setGroupOutputs', t => {
    t.plan(3);
    let outputs
    [
        {
            input: [],
            expected: []
        },
        {
            input: [{tasks: []}],
            expected: [{tasks: []}]
        },
        {
            input: [{tasks: [{task: {response: {}}}]}],
            expected: [{tasks: [{task: {response: {}}, output: {msg: [], pass: true}}]}]
        }
    ].forEach(item => {
        outputs = helper.setGroupOutputs(item.input)
        t.deepEqual(outputs, item.expected)
    })
})