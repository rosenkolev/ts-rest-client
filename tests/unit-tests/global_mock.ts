const _global: Record<string, unknown> = global || globalThis || window || {};
if (!('Request' in _global)) {
  _global.Request = class FakeRequest {
    readonly text = () => Promise.resolve(this.init?.body);
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
