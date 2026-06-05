// ─── Subresource Integrity (SRI) hashes ──────────────────────────────────────
// When upgrading a library, regenerate the hash:
//   curl -s <url> | openssl dgst -sha512 -binary | openssl base64 -A
// Or use https://www.srihash.org/
// S4: SRI hashes prevent CDN-served scripts from being silently tampered with.
// Hashes verified against cdnjs API: https://api.cdnjs.com/libraries/<name>/<version>?fields=sri
const SRI = {
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js':
    'sha512-dfX5uYVXzyU8+KHqj8bjo7UkOdg18PaOtpa48djpNbZHwExddghZ+ZmzWT06R5v6NSk3ZUfsH6FNEDepLx9hPQ==',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js':
    'sha512-r22gChDnGvBylk90+2e/ycr3RVrDi8DIOkIGNhJlKfuyQM4tIRAI062MaV8sfjQKYVGjOBaZBOA87z+IhZE9DA==',
};

export function loadCdnScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    // Attach SRI hash when available so the browser rejects tampered payloads
    const hash = SRI[src];
    if (hash) {
      s.integrity   = hash;
      s.crossOrigin = 'anonymous';
    }
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
