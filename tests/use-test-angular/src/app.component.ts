import { HttpClient } from '@angular/common/http';
import { Component, inject, resource } from '@angular/core';

import { firstValueFrom } from 'rxjs';
import { rest } from 'typed-rest-api-client';
import { z } from 'zod';

import type { HttpHandler } from 'typed-rest-api-client';

const ApiData = z
  .object({
    url: z.string(),
    data: z.object({
      token: z.number()
    })
  })
  .strict();

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <h1>API Test</h1>
    @let info = data.value();
    <p><strong>URL</strong>: {{ info?.url }}</p>
    <p><strong>Token</strong>: {{ info?.data?.token }}</p>
  `,
  styles: []
})
export class AppComponent {
  readonly #http = inject(HttpClient);
  readonly #client = rest<HttpHandler>({
    http: (reqInfo, init) =>
      firstValueFrom(
        this.#http.request(init?.method ?? 'get', reqInfo as string, {
          body: init!.data
        })
      )
  });

  readonly #api = this.#client('/', ({ post }) => [
    post('callback', { args: { token: 123 }, schema: ApiData.parse })
  ]);

  readonly data = resource({
    loader: () => this.#api.callback()
  });
}
