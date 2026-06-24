export function navigateTo(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.dispatchEvent(new Event('app:navigate'));
}

export function navigateBack(fallback = '/') {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.history.replaceState({}, '', fallback);
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new Event('app:navigate'));
  }
}
