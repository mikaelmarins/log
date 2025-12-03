import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = 3001;

const server = http.createServer((req, res) => {
    let targetUrlStr;

    // Check if URL is provided as query parameter (old way)
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    const urlParam = reqUrl.searchParams.get('url');

    if (urlParam) {
        // Query parameter style: /?url=https://...
        targetUrlStr = urlParam;
    } else if (req.url.startsWith('http://') || req.url.startsWith('https://')) {
        // Direct proxy style: ffmpeg sends full URL in request
        targetUrlStr = req.url;
    } else {
        console.error('[Proxy] Invalid request:', req.url);
        res.writeHead(400);
        res.end('Invalid proxy request');
        return;
    }

    console.log(`[Proxy] Received request for: ${targetUrlStr}`);

    try {
        const targetUrl = new URL(targetUrlStr);

        // Copy headers from the incoming request (ffmpeg) to the outgoing request
        const headers = { ...req.headers };
        delete headers.host; // Let the request set the host
        delete headers['proxy-connection']; // Remove proxy-specific headers

        const options = {
            hostname: targetUrl.hostname,
            port: targetUrl.port || 443,
            path: targetUrl.pathname + targetUrl.search,
            method: req.method,
            headers: headers,
            rejectUnauthorized: false // Ignore self-signed certs if any
        };

        console.log(`[Proxy] Forwarding to: ${options.hostname}${options.path}`);

        const proxyReq = https.request(options, (proxyRes) => {
            console.log(`[Proxy] Target responded with status: ${proxyRes.statusCode}`);
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        });

        proxyReq.on('error', (e) => {
            console.error(`[Proxy] Request Error: ${e.message}`);
            if (!res.headersSent) {
                res.writeHead(500);
                res.end(`Proxy error: ${e.message}`);
            }
        });

        req.pipe(proxyReq, { end: true });

    } catch (e) {
        console.error(`[Proxy] Invalid URL or Error: ${e.message}`);
        res.writeHead(400);
        res.end('Invalid URL');
    }
});

export function startProxy() {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`[Proxy] Local proxy running on port ${PORT}`);
    });
}
