const escapeXml = (value) => String(value).replace(/[<>&'"]/g, (c) => {
    switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&apos;';
        case '"': return '&quot;';
        default: return c;
    }
});

const testcase = (num, uri, time, msg) => {
    let content = `<testcase name="${escapeXml(uri)}" time="${time}">`;
    if (msg) {
        content += `<error message="${escapeXml(msg)}"></error>`;
    }
    return content + '</testcase>';
};

/**
 * Build a JUnit style XML report from the results.
 * Includes single and group tasks.
 * @returns {string}
 */
export const buildTestsuiteXml = (results, time) => {
    let failures = 0;
    const cases = [];
    const add = (item) => {
        const requestTime = Math.round(item.result.requestTime) / 1000;
        const msg = (item.output && item.output.msg && item.output.msg.length)
            ? item.output.msg.join(', ')
            : '';
        cases.push(testcase(item.task.num, item.task.uri, requestTime, msg));
        if (item.task.response && item.output && !item.output.pass) {
            failures += 1;
        }
    };
    for (const item of results.single) {
        add(item);
    }
    for (const group of results.group) {
        for (const item of group.tasks) {
            add(item);
        }
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="apirequests" tests="${cases.length}" failures="${failures}" time="${time}">
${cases.join('\n')}
</testsuite>
`;
};
