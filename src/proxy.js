import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = 3001;

const server = http.createServer((req, res) => {
    // URL to proxy is passed as a query param 'url'
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    const targetUrlStr = reqUrl.searchParams.get('url');

    if (!targetUrlStr) {
        res.writeHead(400);
        res.end('Missing "url" query parameter');
        return;
    }

    console.log(`[Proxy] Proxying request to: ${targetUrlStr}`);

    try {
        const targetUrl = new URL(targetUrlStr);

        // Copy headers from the incoming request (ffmpeg) to the outgoing request
        // But we might want to override some to match the browser
        const headers = { ...req.headers };
        delete headers.host; // Let the request set the host

        // We can enforce specific headers here if needed
        // headers['User-Agent'] = '...'; 

        const options = {
            hostname: targetUrl.hostname,
            port: targetUrl.port || 443,
            path: targetUrl.pathname + targetUrl.search,
            method: req.method,
            headers: headers,
            rejectUnauthorized: false // Ignore self-signed certs if any
        };

        const proxyReq = https.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', (e) => {
            console.error(`[Proxy] Error: ${e.message}`);
            res.writeHead(500);
            res.end(`Proxy error: ${e.message}`);
        });

        req.pipe(proxyReq, { end: true });

    } catch (e) {
        console.error(`[Proxy] Invalid URL: ${targetUrlStr}`);
        res.writeHead(400);
        res.end('Invalid URL');
    }
});

export function startProxy() {
    server.listen(PORT, () => {
        console.log(`[Proxy] Local proxy running on port ${PORT}`);
    });
}
