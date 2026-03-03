import { useState, useEffect } from 'react';

export type PeriodKey = '30d' | '6m' | '12m' | 'all' | 'custom';

export function useFilterState(defaultPeriod: PeriodKey = '30d') {
    const [isMounted, setIsMounted] = useState(false);

    const [period, setPeriodState] = useState<PeriodKey>(defaultPeriod);
    const [customStart, setCustomStartState] = useState('');
    const [customEnd, setCustomEndState] = useState('');

    useEffect(() => {
        setIsMounted(true);
        const storedPeriod = localStorage.getItem('panko_period') as PeriodKey;
        if (storedPeriod) setPeriodState(storedPeriod);

        const storedStart = localStorage.getItem('panko_customStart');
        if (storedStart) setCustomStartState(storedStart);

        const storedEnd = localStorage.getItem('panko_customEnd');
        if (storedEnd) setCustomEndState(storedEnd);
    }, []);

    const setPeriod = (p: PeriodKey) => {
        setPeriodState(p);
        localStorage.setItem('panko_period', p);
    };

    const setCustomStart = (val: string) => {
        setCustomStartState(val);
        localStorage.setItem('panko_customStart', val);
    };

    const setCustomEnd = (val: string) => {
        setCustomEndState(val);
        localStorage.setItem('panko_customEnd', val);
    };

    return {
        period: isMounted ? period : defaultPeriod,
        setPeriod,
        customStart: isMounted ? customStart : '',
        setCustomStart,
        customEnd: isMounted ? customEnd : '',
        setCustomEnd,
        isMounted
    };
}
