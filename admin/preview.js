export function initPreview() {
  let channel = null;
  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel('clower-preview');
    channel.onmessage = event => {
      if (event.data === 'refresh-preview') {
        refreshFrame();
      }
    };
  }
  return () => {
    refreshFrame();
    if (channel) {
      channel.postMessage('refresh-preview');
    }
  };
}

function refreshFrame() {
  const frame = document.querySelector('iframe');
  if (frame) {
    const src = frame.getAttribute('src').split('?')[0];
    frame.setAttribute('src', `${src}?t=${Date.now()}`);
  }
}
