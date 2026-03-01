export const CATEGORY_COLORS: Record<string, string> = {
    'Elternbeiträge': '#22c55e',
    'Fördermittel Senat': '#3b82f6',
    'Spenden': '#a855f7',
    'Sonstige Einnahmen': '#f97316',
    'Miete': '#ef4444',
    'Personal': '#f43f5e',
    'Lebensmittel': '#eab308',
    'Bastelmaterial': '#06b6d4',
    'Versicherungen': '#8b5cf6',
    'Strom & Gas': '#f97316',
    'Reinigung': '#14b8a6',
    'Verwaltung': '#64748b',
    'Reparaturen': '#78716c',
    'Sonstige': '#6b7280',
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS).sort();

export const EXPENSE_CATEGORIES = [
    'Personal',
    'Miete',
    'Lebensmittel',
    'Strom & Gas',
    'Versicherungen',
    'Bastelmaterial',
    'Reinigung',
    'Verwaltung',
    'Reparaturen',
    'Sonstige'
];

export const INCOME_CATEGORIES = [
    'Elternbeiträge',
    'Fördermittel Senat',
    'Spenden',
    'Sonstige Einnahmen',
    'Sonstige'
];
