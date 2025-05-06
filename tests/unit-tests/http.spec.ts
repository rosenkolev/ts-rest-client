import { http, interceptor, httpErrorCode, httpJsonParser, httpBodySerialize } from '../../src';

const _global: Record<string, unknown> = global || globalThis || window || {};
if (!('Request' in _global)) {
  _global.Request = class FakeRequest {
    readonly text = () => Promise.resolve(this.init.body);
    constructor(
      readonly url: string,
      readonly init: { readonly body: string }
    ) {}
  };

  _global.Response = class FakeResponse {
    status: number;
    statusText: string;
    readonly text = () => Promise.resolve(this._body);
    readonly json = () => Promise.resolve(this._body ? JSON.parse(this._body) : {});

    constructor(
      readonly _body: string | null,
      init?: {
        readonly status?: number;
        readonly statusText?: string;
      }
    ) {
      this.status = init?.status ?? 0;
      this.statusText = init?.statusText ?? '';
    }
  };
}

describe('http client', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should call fetch with correct parameters', async () => {
    const client = http(mockFetch);
    const req = new Request('/test');

    client(req, { method: 'GET' });

    expect(mockFetch).toHaveBeenCalledWith(req, { method: 'GET' });
  });

  describe('interceptor hooks', () => {
    it('should wrap client and modify request with preRequest', () => {
      const handler = jest.fn((req) => req);
      const spy = jest.fn((req: Request) => new Request(req.url + '?intercepted=true'));

      const client = http(handler).wrap(
        interceptor({
          preRequest: spy
        })
      );

      client('/data');

      expect(spy).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].url).toContain('?intercepted=true');
    });

    it('should execute postRequest to transform response', async () => {
      const mockResponse = Promise.resolve(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

      const handler = jest.fn(() => mockResponse);
      const parseFn = jest.fn((res: Promise<Response>) => res.then((r) => r.text()));
      const client = http(handler).wrap(
        interceptor({
          postRequest: parseFn
        })
      );

      const result = await client('/post');

      expect(parseFn).toHaveBeenCalled();
      expect(result).toBe(JSON.stringify({ ok: true }));
    });

    it('should call init handler with config', () => {
      const initSpy = jest.fn();
      const client = http(() => new Response()).wrap(
        interceptor({
          init: initSpy
        }),
        { debug: true }
      );

      client('/x', { config: { trace: 1 } });

      expect(initSpy).toHaveBeenCalledWith({ debug: true });
    });

    it('should merge config from init and interceptor', () => {
      const spy = jest.fn();
      const handler = jest.fn((req) => req);

      const client = http(handler).wrap(
        interceptor({
          preRequest: (req, cfg) => {
            spy(cfg);
            return req;
          }
        }),
        { a: 1 }
      );

      client('/foo', { config: { b: 2 } });

      expect(spy).toHaveBeenCalledWith({ a: 1, b: 2 });
    });
  });

  describe('integrated interceptors', () => {
    it('httpJsonParser should parse JSON from response', async () => {
      const jsonData = { hello: 'world' };
      const res = new Response(JSON.stringify(jsonData), {
        headers: { 'Content-Type': 'application/json' }
      });

      const client = http(() => Promise.resolve(res)).wrap(httpJsonParser);
      const result = await client('/');

      expect(result).toEqual(jsonData);
    });

    it('httpErrorCode should throw on HTTP error status', async () => {
      const res = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      const client = http(() => Promise.resolve(res)).wrap(httpErrorCode);

      await expect(client('/')).rejects.toThrow('Bad Request');
    });

    it('httpBodySerialize should parse body', async () => {
      let resBody = Promise.resolve('');
      const client = http((req) => {
        resBody = (req as Request).text();
        return Promise.resolve(new Response());
      }).wrap(httpBodySerialize);

      client('/test', { data: { a: 174 } });

      expect(await resBody).toBe('{"a":174}');
    });
  });

  it('should support chaining multiple interceptors', async () => {
    const order: string[] = [];

    const interceptA = interceptor({
      preRequest: (req) => {
        order.push('A-pre');
        return req;
      },
      postRequest: (res) => {
        order.push('A-post');
        return res;
      }
    });

    const interceptB = interceptor({
      preRequest: (req) => {
        order.push('B-pre');
        return req;
      },
      postRequest: (res) => {
        order.push('B-post');
        return res;
      }
    });

    const client = http(() => Promise.resolve(new Response('ok')))
      .wrap(interceptA)
      .wrap(interceptB);

    await client('/test');

    expect(order).toEqual(['B-pre', 'A-pre', 'A-post', 'B-post']);
  });
});
