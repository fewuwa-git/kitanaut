export interface CategoryRule {
    id: string;
    category_name: string;
    field: 'description' | 'counterparty' | 'any';
    match_type: 'contains' | 'starts_with' | 'exact';
    value: string;
    priority: number;
    created_at?: string;
}

export function getMatchingRule(rules: CategoryRule[], description: string, counterparty: string): CategoryRule | null {
    const sorted = [...rules].sort((a, b) => b.priority - a.priority);
    for (const rule of sorted) {
        const targets =
            rule.field === 'description' ? [description] :
            rule.field === 'counterparty' ? [counterparty] :
            [description, counterparty];
        const val = rule.value.toLowerCase();
        const matches = targets.some(t => {
            const text = (t || '').toLowerCase();
            switch (rule.match_type) {
                case 'contains': return text.includes(val);
                case 'starts_with': return text.startsWith(val);
                case 'exact': return text === val;
            }
        });
        if (matches) return rule;
    }
    return null;
}

export function applyRules(rules: CategoryRule[], description: string, counterparty: string): string {
    const match = getMatchingRule(rules, description, counterparty);
    return match ? match.category_name : 'Nicht kategorisiert';
}
