import React from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { 
  CanonicalBadge, 
  mapLegacyBadges 
} from '../../data/badges';

export interface StatusBadgeConfigItem {
  label: CanonicalBadge;
  icon?: (props: { className?: string }) => React.ReactNode;
  iconClass?: string;
  containerClass: string;
}

export const STATUS_BADGE_CONFIG_MAP: Record<CanonicalBadge, StatusBadgeConfigItem> = {
  'Gömrük olunub': {
    label: 'Gömrük olunub',
    icon: (props) => <ShieldCheck {...props} />,
    iconClass: 'w-3.5 h-3.5 text-emerald-600 shrink-0',
    containerClass: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  },
  'Azərbaycanda sürülməyib': {
    label: 'Azərbaycanda sürülməyib',
    icon: (props) => <CheckCircle2 {...props} />,
    iconClass: 'w-3.5 h-3.5 text-blue-600 shrink-0',
    containerClass: 'text-blue-800 bg-blue-50 border-blue-200',
  },
  'Vuruqsuz və rəngsiz': {
    label: 'Vuruqsuz və rəngsiz',
    containerClass: 'text-slate-700 bg-slate-100 border-slate-200',
  },
};

interface StatusBadgesProps {
  badges?: string[];
  className?: string;
}

export const StatusBadges: React.FC<StatusBadgesProps> = ({
  badges,
  className = 'mt-2 flex flex-wrap items-center gap-1.5',
}) => {
  const mapped = mapLegacyBadges(badges);
  if (mapped.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {mapped.map((badge) => {
        const conf = STATUS_BADGE_CONFIG_MAP[badge];
        if (!conf) return null;
        const IconComponent = conf.icon;

        return (
          <span
            key={badge}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border ${conf.containerClass}`}
          >
            {IconComponent && IconComponent({ className: conf.iconClass })}
            <span>{conf.label}</span>
          </span>
        );
      })}
    </div>
  );
};
