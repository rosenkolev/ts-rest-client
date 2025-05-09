import type { HttpRequestInit, HttpHandler } from './client';
import type { RestOptions } from './rest';

import { rest } from './rest';
import { http, httpBodySerialize, httpErrorCode, httpJsonParser, interceptor } from './client';

export { rest, http, httpBodySerialize, httpJsonParser, httpErrorCode, interceptor };
export type { HttpRequestInit, RestOptions, HttpHandler };
