/** First focusable element of a page: jumps over the header to `#conteudo`. */
export function SkipLink() {
  return (
    <a
      href="#conteudo"
      className="sr-only rounded-button bg-ink px-4 py-3 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      Pular para o conteúdo
    </a>
  );
}
