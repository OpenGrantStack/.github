
Mobile Integration

Offline Support

```javascript
// Service Worker caching strategy
const CACHE_STRATEGY = {
  schemas: 'stale-while-revalidate',
  templates: 'cache-first',
  compliance: 'network-first'
};

// Local validation
const validateOffline = (data, schemaName) => {
  const schema = await getCachedSchema(schemaName);
  return validateAgainstSchema(data, schema);
};
