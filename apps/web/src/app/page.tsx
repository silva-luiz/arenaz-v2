import Link from 'next/link';
import { primaryButton, secondaryButton } from '@/components/ui/button-styles';
import { Card, PageShell } from '@/components/ui/page-shell';

export default function HomePage() {
  return (
    <PageShell>
      <Card>
        <h1 className="text-2xl font-bold tracking-tight">
          Bem-vindo ao arenaz
        </h1>
        <p className="mt-2 mb-6 text-muted">
          Em breve: encontre quadras perto de você e reserve em poucos toques.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/entrar" className={`${secondaryButton} flex-1`}>
            Entrar
          </Link>
          <Link href="/cadastro" className={`${primaryButton} flex-1`}>
            Criar conta
          </Link>
        </div>
      </Card>
    </PageShell>
  );
}
