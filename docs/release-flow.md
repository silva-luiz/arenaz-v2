# Fluxo de releases

Uma release branch por sprint. A `main` é protegida: só recebe a release no
fim da sprint (e hotfixes). Versões seguem [SemVer](https://semver.org/lang/pt-BR/)
e cada versão publicada é uma tag na `main`.

```
main  ──●────────────────────────●──────────●─────
        │ v1.1.0                 │ v1.2.0   │ v1.2.1 (hotfix)
        └─ release/v1.2 ─●──●──●─┘          │
              feat/* ────┘  │  │            └─ merge de volta na release aberta
              fix/*  ───────┘  │
```

## Branches

| Branch           | Sai de          | PR vai para     | Dura           |
| ---------------- | --------------- | --------------- | -------------- |
| `main`           | —               | —               | sempre         |
| `release/vX.Y`   | `main`          | `main`          | uma sprint     |
| `feat/*`, `fix/*`| release aberta  | release aberta  | até o merge    |
| `hotfix/*`       | `main`          | `main`          | até o merge    |

## Sprint, passo a passo

1. **Início:** criar `release/vX.Y` a partir da `main` (ex.: `release/v1.2`).
2. **Durante:** cada feature ou correção sai da release e volta por PR para
   ela. A release é o que sobe na demo do Cubeship
   ([infra/deploy/README.md](../infra/deploy/README.md)).
3. **Fim:** um PR `release/vX.Y` → `main`. Depois do merge:
   - tag anotada na `main`: `git tag -a vX.Y.0 -m "vX.Y.0: <resumo>"` e
     `git push origin vX.Y.0`;
   - deploy;
   - apagar a `release/vX.Y`.

## Hotfix

Para um bug em produção que não pode esperar a sprint:

1. `hotfix/<nome>` a partir da `main`, PR para a `main`.
2. Tag do patch: `vX.Y.Z+1` (ex.: `v1.2.1`).
3. Merge da `main` na release aberta. Sem isso, o próximo merge da release
   desfaz o hotfix.

## Versões

- **Minor** (`v1.2.0`): o fim de cada sprint.
- **Patch** (`v1.2.1`): hotfix.
- **Major** (`v2.0.0`, `release/v2`): só quando algo quebra compatibilidade
  (contrato da API, dados que precisam de migração manual etc.).

Regras: a release dura uma sprint e é apagada depois do merge. Release de longa
duração diverge da `main` (a antiga `release/v1.1` chegou a 132 commits de um
lado e 105 do outro).

## Proteção da `main` (para um admin do repo aplicar)

Em **Settings → Rules → Rulesets → New branch ruleset**:

- **Nome:** `main`; **Enforcement:** Active; **Target:** branch `main`.
- **Restrict deletions** e **Block force pushes**.
- **Require a pull request before merging**, com 1 aprovação.
- **Require status checks to pass:** `ci`, com a branch atualizada antes do
  merge.

Um segundo ruleset igual para `release/**`, sem a aprovação obrigatória, evita
push direto na release.

O CI ([.github/workflows/ci.yml](../.github/workflows/ci.yml)) roda em todo PR e
em push na `main`, `release/**` e `hotfix/**`.
