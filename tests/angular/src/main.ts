import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app.component';

import { of } from 'rxjs';

bootstrapApplication(AppComponent, {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideHttpClient(
      // Fake HTTP response
      withInterceptors([
        (req) =>
          of(
            new HttpResponse({
              status: 200,
              body: {
                url: req.url,
                data: req.body
              }
            })
          )
      ])
    )
  ]
}).catch((err) => console.error(err));
