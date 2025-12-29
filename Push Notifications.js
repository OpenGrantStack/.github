
Push Notifications

```javascript
// Subscribe to compliance updates
const subscribeToUpdates = async () => {
  const subscription = await navigator.serviceWorker.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: 'your-vapid-public-key'
  });
  
  await fetch('/api/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify(subscription)
  });
};
