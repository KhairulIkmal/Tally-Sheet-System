/** The Lam Soon logo (a 165×160 copy of the Portal's). Plain <img>: no image optimizer on Workers, and the service worker caches it for offline. */
export function LamSoonLogo({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/lam-soon-logo.png" alt="Lam Soon" width={165} height={160} className={className} />;
}
