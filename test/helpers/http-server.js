import http from 'node:http';

/**
 * Start a local HTTP server on an ephemeral port for offline tests.
 */
export const startServer = async () => {
    const server = http.createServer((req, res) => {
        if (req.url === '/ok') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', test: 'yes' }));
            return;
        }
        if (req.url === '/echo') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ received: body }));
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found');
    });
    await new Promise((resolve) => server.listen(0, resolve));
    const { port } = server.address();
    return {
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((resolve) => {
            if (typeof server.closeAllConnections === 'function') {
                server.closeAllConnections();
            }
            server.close(resolve);
        })
    };
};
