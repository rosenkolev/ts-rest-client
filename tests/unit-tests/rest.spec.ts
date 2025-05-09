import { rest, HttpHandler } from '../../src';
import './global_mock';

describe('rest client generator - extended tests', () => {
  const mockHttp = jest.fn();
  beforeEach(() => {
    mockHttp.mockClear();
  });

  const baseUrl = 'https://api.example.com';
  const client = rest<HttpHandler>({
    baseUrl,
    http: (info, init) => mockHttp(info, init)
  });

  const api = client('/v1', (r) => [
    r.get('withConfig', {
      path: '/config',
      args: { x: 1 },
      config: { secure: true }
    }),
    r.get('withSchema', {
      path: '/schema',
      schema: (obj: object) => ({ ...obj, _test: 1 })
    }),
    r.patch('updateUser', {
      path: '/users/:id',
      args: { id: 1, name: 'test' }
    }),
    r.del('deleteUser', {
      path: '/users/:id',
      args: { id: 999 }
    }),
    r.namespace('group', (r) => [
      r.put('rename', {
        path: '/rename/:id',
        args: { id: 55, newName: 'Team Rocket' }
      })
    ])
  ]);

  it('should init default', async () => {
    const _fetch = globalThis['fetch'];
    const mockFnFetch = jest.fn().mockResolvedValue(new Response());
    globalThis['fetch'] = mockFnFetch;
    try {
      const client = rest()('a', ({ get }) => [get('b')]);
      await client.b();
      expect(mockFnFetch).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://localhost/a/b' }),
        expect.anything()
      );
    } finally {
      globalThis.fetch = _fetch;
    }
  });

  it('should merge member and init config', () => {
    api.withConfig({ x: 42 }, { config: { retry: 3 } });

    expect(mockHttp).toHaveBeenCalledWith(
      `${baseUrl}/v1/config?x=42`,
      expect.objectContaining({
        method: 'GET',
        config: { secure: true, retry: 3 }
      })
    );
  });

  it('should return value', async () => {
    mockHttp.mockReturnValue('Result');
    const data = await api.withConfig();

    expect(data).toBe('Result');
  });

  it('should handle PATCH method and JSON body', () => {
    const data = { id: 12, name: 'Bob' };
    api.updateUser(data);

    expect(mockHttp).toHaveBeenCalledWith(
      `${baseUrl}/v1/users/12`,
      expect.objectContaining({
        method: 'PATCH',
        data: data
      })
    );
  });

  it('should handle DELETE method with query params', () => {
    api.deleteUser({ id: 999 });

    expect(mockHttp).toHaveBeenCalledWith(
      `${baseUrl}/v1/users/999?id=999`,
      expect.objectContaining({
        method: 'DELETE'
      })
    );
  });

  it('should support nested namespace PUT method', () => {
    const data = { id: 7, newName: 'Avengers' };
    api.group.rename(data);

    expect(mockHttp).toHaveBeenCalledWith(
      `${baseUrl}/v1/group/rename/7`,
      expect.objectContaining({
        method: 'PUT',
        data: data
      })
    );
  });

  it('should default args to empty object if not provided', () => {
    const noArgs = client('/x', (r) => [
      r.get('hello', {
        path: '/hello'
      })
    ]);

    noArgs.hello();

    expect(mockHttp).toHaveBeenCalledWith(
      `${baseUrl}/x/hello`,
      expect.objectContaining({
        method: 'GET'
      })
    );
  });

  it('should handle custom headers from init', () => {
    api.updateUser(
      { id: 123, name: 'John' },
      {
        headers: {
          Authorization: 'Bearer TOKEN'
        }
      }
    );

    expect(mockHttp).toHaveBeenCalledWith(
      `${baseUrl}/v1/users/123`,
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          Authorization: 'Bearer TOKEN',
          'Content-Type': 'application/json'
        })
      })
    );
  });

  it('should handle schema transform', async () => {
    mockHttp.mockResolvedValue({ a: 83 });
    const res = await api.withSchema();
    expect(res).toEqual({
      a: 83,
      _test: 1
    });
  });
});
