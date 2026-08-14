#!/usr/bin/env node
import apirequests from '../index.js';

const args = process.argv.slice(2);
const rulesFile = args.find((a) => !a.startsWith('--'));
const opts = {};

for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
        case '--output':
            opts.output = args[i + 1];
            i += 1;
            break;
        case '--loop':
            opts.loop = Number(args[i + 1]);
            i += 1;
            break;
        case '--print-only-failure':
            opts.printOnlyFailure = true;
            break;
        case '--output-path':
            opts.outputPath = args[i + 1];
            i += 1;
            break;
        case '--output-file':
            opts.outputFile = args[i + 1];
            i += 1;
            break;
        case '--help':
        case '-h':
            console.log(
                'Usage: apirequests <rules.json|rules.yaml> [options]\n\n' +
                'Options:\n' +
                '  --output <print|html|xml|db|ci>  output format (default: print)\n' +
                '  --output-path <dir>              directory for report files\n' +
                '  --output-file <name>             report file name\n' +
                '  --loop <ms>                      repeat after a delay\n' +
                '  --print-only-failure             only print failing tasks\n' +
                '  -h, --help                       show this help'
            );
            process.exit(0);
            break;
        default:
            break;
    }
}

if (!rulesFile) {
    console.error('Usage: apirequests <rules.json|rules.yaml> [options]');
    process.exitCode = 1;
} else {
    apirequests(opts).run(rulesFile);
}
