'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './ui';

const STEPS = [
  { href: '/geo/mitigacion', label: 'Mitigación' },
  { href: '/geo/confirmacion', label: 'Confirmación' },
  { href: '/geo/reauditoria', label: 'Re-auditoría día 14' },
  { href: '/geo/resultado', label: 'Resultado 48 h' },
];

export default function GeoSteps() {
  const path = usePathname();
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {STEPS.map((s, i) => {
        const active = path === s.href;
        return (
          <div key={s.href} className="flex items-center gap-2">
            <Link
              href={s.href}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                active ? 'border-accent-cyan/50 bg-accent-cyan/10 text-accent-cyan font-medium' : 'border-line text-muted hover:text-fg'
              }`}
            >
              <span className="w-4 h-4 rounded-full border border-current text-[10px] flex items-center justify-center">{i + 1}</span>
              {s.label}
            </Link>
            {i < STEPS.length - 1 && <Icon name="chevronRight" className="w-3.5 h-3.5 text-dim" />}
          </div>
        );
      })}
    </div>
  );
}
