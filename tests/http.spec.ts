import { http } from '../src/client';

describe('http', () => {
  it('should call', async () => {
    const res = 'Result';
    const _fn = jest.fn().mockResolvedValue(res);
    const _http = http(_fn);
    expect(await _http('/test')).toBe(res);
  });
});
