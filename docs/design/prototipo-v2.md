# ArenaZ v2 — Protótipo aprovado (referência visual)

**Status:** layout aprovado em 2026-10-28. Logo: **manter o atual** por enquanto (as explorações de logo ficaram só no canvas e não entram no código).

**Canvas navegável:** https://claude.ai/artifact/7ebwYSTz6m7Mtv7Ym34nVG (compartilhado por link; modo Play para clicar).

**Fontes do protótipo:** `docs/design/prototipo/*.dc.html`. São arquivos do canvas, não rodam sozinhos: as fotos apontam para `/_blob/<id>` do canvas e a lógica usa o runtime dele. Servem para copiar copy, estrutura e valores de estilo, não para importar.

## Telas

| Arquivo | Tela | O que importa |
|---|---|---|
| `Main.dc.html` | Home (desktop) | hero noturno com cards flutuantes, busca em pílula sobreposta ao hero, esportes com miniatura de foto, carrosséis de cards quadrados com selo "Livre às 20h", faixa escura "Falta gente? Entra no jogo." (partidas abertas), banner do dono |
| `Busca.dc.html` | Busca com mapa | grade de cards + mapa fixo com preço no pino; pino selecionado escuro; preview flutuante da quadra |
| `Quadra.dc.html` | Página da quadra | galeria de 5 fotos, seletor de dia/horário com horários seguidos, preço de horário nobre, card de reserva fixo com "Dividir com o time" e valor por pessoa |
| `Checkout.dc.html` | Checkout mobile | revisão → Pix (QR + copia e cola) → "Quadra garantida" com lista do racha |
| `MobileHome.dc.html` | Home mobile | busca "Bora jogar?", card grande "Livre agora", "Falta gente", tab bar |
| `Painel.dc.html` | Painel do dono | agenda quadra × hora colorida por tipo (app, mensalista, manual, partida aberta), indicadores, detalhe da reserva |

## Tokens

Viram `@theme` do Tailwind v4 (Plano 0, Task 6) e depois `packages/ui` (Plano 2).

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#FFFFFF` | fundo |
| `--color-surface` | `#F7F7F5` | rodapé, fundos neutros |
| `--color-ink` | `#161616` | texto e botões escuros |
| `--color-muted` | `#6A6A6A` | texto secundário |
| `--color-line` | `#EBEBEB` | divisórias, borda de card |
| `--color-line-strong` | `#DDDDDD` | borda de input/pílula |
| `--color-brand` | `#0B7A4B` | CTA principal, marca |
| `--color-night` | `#0E2018` | seções escuras (partidas abertas) |
| `--color-live` | `#3DDC84` | ponto "ao vivo", progresso do racha |
| `--color-free` | `#12A150` | ponto "Livre às" |
| `--color-fav` | `#FF385C` | coração salvo |
| `--shadow-1` | `0 1px 2px rgba(8,36,24,.08), 0 10px 22px -12px rgba(8,36,24,.32)` | foto/card em repouso |
| `--shadow-2` | `0 2px 6px rgba(8,36,24,.10), 0 26px 48px -20px rgba(8,36,24,.48)` | card em hover, galeria, seções |
| `--shadow-3` | `0 2px 4px rgba(0,0,0,.08), 0 18px 40px -14px rgba(0,0,0,.38), 0 48px 90px -30px rgba(0,0,0,.45)` | elementos flutuantes: busca, card de reserva, preview do mapa |
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | hover/lift |
| raios | foto 20px · card 24–26px · seção 32–36px · botão 14–18px · pílula 999px | |

**Tipografia:** Geist (interface, 400–700); Bricolage Grotesque 700–800 com `letter-spacing: -0.045em` só no wordmark "arenaz" e em títulos grandes; Geist Mono para horários e códigos.

**Vidro:** selos sobre foto usam `background: rgba(255,255,255,.78)` + `backdrop-filter: blur(14px) saturate(1.6)`.

**Movimento:** hover sobe o card 4–6px e aumenta a sombra; foto escala 1.05. Sem animação de entrada por seção. Respeitar `prefers-reduced-motion`.

## Logo (atual, mantido)

Quadrado arredondado `rx=10` em `--color-brand` com um campo em linhas brancas (retângulo, linha do meio, círculo central) + wordmark "arenaz" em Bricolage Grotesque 800. SVG de 34×34:

```svg
<svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true"><rect width="34" height="34" rx="10" fill="#0B7A4B"/><rect x="7" y="10" width="20" height="14" rx="2" stroke="#FFFFFF" stroke-width="1.8"/><line x1="17" y1="10" x2="17" y2="24" stroke="#FFFFFF" stroke-width="1.8"/><circle cx="17" cy="17" r="3.2" stroke="#FFFFFF" stroke-width="1.8"/></svg>
```

## Fotos

As do protótipo são do Unsplash (licença livre, uso comercial permitido) e só ilustram. Em produção as fotos vêm do upload do dono (Plano 1).
