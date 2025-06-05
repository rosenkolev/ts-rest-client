import { http, interceptor, httpErrorCode, httpJsonParser, httpBodySerialize } from '../../src';
import { InterceptorApplier } from '../../src/client';
import './global_mock';

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
    it('preRequest should wrap client and modify request', () => {
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

    it('postRequest should transform response', async () => {
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

    it('init: should transform config', () => {
      const initSpy = jest.fn();
      const client = http(mockFetch).wrap(
        interceptor({
          init: initSpy
        }),
        { debug: true }
      );

      client('/x', { config: { trace: 1 } });

      expect(initSpy).toHaveBeenCalledWith({ debug: true });
    });

    it('merge all configs', () => {
      const spy = jest.fn();
      const handler = jest.fn((req) => req);

      const client = http(handler).wrap(
        interceptor({
          preRequest: (req, cfg) => {
            spy(cfg);
            return req;
          },
          defaultConfig: {
            a: 0,
            c: 3
          }
        }),
        { a: 1 }
      );

      client('/foo', { config: { b: 2 } });

      expect(spy).toHaveBeenCalledWith({ a: 1, b: 2, c: 3 });
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

    it('httpJsonParser supports non Promise', async () => {
      const data = {};
      const client = http(() => data).wrap(
        httpJsonParser as unknown as InterceptorApplier<{}, object, object> // eslint-disable-line @typescript-eslint/no-empty-object-type
      );

      const result = await client('/');
      expect(result).toBe(data);
    });

    it('httpErrorCode should throw on HTTP error status', async () => {
      const res = new Response('Bad Request', { status: 400, statusText: 'Bad Request' });
      const client = http(() => Promise.resolve(res)).wrap(httpErrorCode);

      await expect(client('/')).rejects.toThrow('Bad Request');
    });

    it('httpErrorCode should not throw', async () => {
      const res = new Response('Bad Request', { status: 301, statusText: 'Redirect' });
      const client = http(() => Promise.resolve(res)).wrap(httpErrorCode);

      await expect(client('/')).resolves.toEqual(expect.anything());
    });

    it('httpErrorCode should not throw based on config', async () => {
      const res = new Response('Bad Request', { status: 404, statusText: 'Not Found' });
      const client = http(() => Promise.resolve(res)).wrap(httpErrorCode);

      await expect(
        client('/', {
          config: {
            errorCode: 405
          }
        })
      ).resolves.toEqual(expect.anything());
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

    it('httpBodySerialize should not parse', async () => {
      let resBody = Promise.resolve('');
      const client = http((req) => {
        resBody = (req as Request).text();
        return Promise.resolve(new Response());
      }).wrap(httpBodySerialize);

      client('/test');

      expect(await resBody).toBeUndefined();
    });

    it('httpBodySerialize supports non Promise', async () => {
      const data = {};
      const client = http(() => data).wrap(
        httpBodySerialize as unknown as InterceptorApplier<{}, object, object> // eslint-disable-line @typescript-eslint/no-empty-object-type
      );

      const result = await client('/');
      expect(result).toBe(data);
    });

    it('httpBodySerialize append content-type', async () => {
      const client = http(mockFetch).wrap(httpBodySerialize);
      await client('/', { data: {} });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          init: expect.objectContaining({
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }),
        expect.anything()
      );
    });

    it('httpBodySerialize not append content-type', async () => {
      const client = http(mockFetch).wrap(httpBodySerialize, { appendContentType: false });
      await client('/', { data: {} });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          init: expect.not.objectContaining({
            headers: {
              'Content-Type': 'application/json'
            }
          })
        }),
        expect.anything()
      );
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
