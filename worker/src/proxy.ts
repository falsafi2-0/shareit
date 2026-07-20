// Proxy Worker: routes 4share.work → 4share.pages.dev
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const target = new URL(url.toString());
    target.hostname = '4share.pages.dev';
    target.protocol = 'https:';

    const modifiedRequest = new Request(target.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow',
    });

    const response = await fetch(modifiedRequest);

    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    return newResponse;
  },
};
