import netease from '@neteasecloudmusicapienhanced/api';

// Expose the pinned NetEase SDK under Folia's same-origin Vercel API.
export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (!['GET', 'POST'].includes(req.method)) {
        res.setHeader('Allow', 'GET, POST, OPTIONS');
        return res.status(405).json({ code: 405, msg: 'Method not allowed' });
    }

    const url = new URL(req.url, 'https://folia.invalid');
    const route = String(req.query?.path || url.searchParams.get('path') || '/');
    const segments = route.replace(/^\/+|\/+$/g, '').split('/');
    if (!segments.every(segment => /^[a-z][a-z0-9_]*$/.test(segment))) {
        return res.status(404).json({ code: 404, msg: 'Unknown API route' });
    }
    const method = segments.join('_');
    if (!Object.hasOwn(netease, method) || typeof netease[method] !== 'function') {
        return res.status(404).json({ code: 404, msg: 'Unknown API route' });
    }

    let body = req.body || {};
    if (typeof body === 'string') {
        try {
            body = req.headers['content-type']?.includes('application/json')
                ? JSON.parse(body)
                : Object.fromEntries(new URLSearchParams(body));
        } catch {
            return res.status(400).json({ code: 400, msg: 'Invalid request body' });
        }
    }
    const params = { ...Object.fromEntries(url.searchParams), ...req.query, ...body };
    delete params.path;
    params.cookie = params.cookie || req.headers.cookie || '';

    try {
        const result = await netease[method](params);
        if (Array.isArray(result.cookie) && result.cookie.length) {
            res.setHeader('Set-Cookie', result.cookie.map(cookie => cookie + '; Secure; SameSite=Lax'));
        }
        return res.status(result.status || 200).json(result.body);
    } catch (error) {
        if (Array.isArray(error?.cookie) && error.cookie.length) {
            res.setHeader('Set-Cookie', error.cookie.map(cookie => cookie + '; Secure; SameSite=Lax'));
        }
        const status = Number(error?.status);
        return res.status(status >= 400 && status <= 599 ? status : 502).json(
            error?.body || { code: 502, msg: 'NetEase service temporarily unavailable' }
        );
    }
}
