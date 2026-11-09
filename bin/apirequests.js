#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apirequests from '../index.js';

const args = process.argv.slice(2);
const positionals = [];
const opts = {};
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
        case '--retries':
            opts.retries = Number(args[i + 1]);
            i += 1;
            break;
        case '--retry-delay':
            opts.retryDelay = Number(args[i + 1]);
            i += 1;
            break;
        case '--timeout':
            opts.timeout = Number(args[i + 1]);
            i += 1;
            break;
        case '--version':
        case '-v': {
            try {
                const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
                console.log(pkg.version);
            } catch {
                console.log('2.0.0');
            }
            process.exit(0);
            break;
        }
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
                '  --retries <n>                    retry count for failed requests\n' +
                '  --retry-delay <ms>               delay between retries\n' +
                '  --timeout <ms>                   request timeout\n' +
                '  -v, --version                    show version\n' +
                '  -h, --help                       show this help'
            );
            process.exit(0);
            break;
        default:
            if (arg.startsWith('-')) {
                console.error(`Unknown option: ${arg}`);
                process.exitCode = 1;
            } else {
                positionals.push(arg);
            }
            break;
    }
}

const rulesFile = positionals[0];

if (!rulesFile) {
    console.error('Usage: apirequests <rules.json|rules.yaml> [options]');
    process.exitCode = 1;
} else {
    apirequests(opts).run(rulesFile);
}
