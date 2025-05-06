const rest = require('typed-rest-api-client').rest;

describe('node', () => {
    const api = rest({
        baseUrl: 'https://jsonplaceholder.typicode.com/'
    });

    const posts = api('posts', ({ get }) => [
        get('all', { path: '/' })
    ]);

    it('gets', async () => {
        const data = await posts.all();
        expect(data.length).toBeGreaterThan(10);
    });
});