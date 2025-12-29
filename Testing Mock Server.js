
Testing

Mock Server

```javascript
// Example using Mock Service Worker
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const server = setupServer(
  rest.post('/api/compliance/check', (req, res, ctx) => {
    return res(
      ctx.json({
        compliant: true,
        warnings: []
      })
    );
  })
);
