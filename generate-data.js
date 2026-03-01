/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const categories = {
  income: [
    { name: 'Elternbeiträge', avg: 4200, variance: 300 },
    { name: 'Fördermittel Senat', avg: 6800, variance: 500 },
    { name: 'Spenden', avg: 250, variance: 200 },
    { name: 'Sonstige Einnahmen', avg: 120, variance: 100 },
  ],
  expenses: [
    { name: 'Miete', avg: 2800, variance: 0 },
    { name: 'Personal', avg: 5200, variance: 300 },
    { name: 'Lebensmittel', avg: 680, variance: 150 },
    { name: 'Bastelmaterial', avg: 180, variance: 80 },
    { name: 'Versicherungen', avg: 220, variance: 0 },
    { name: 'Strom & Gas', avg: 310, variance: 80 },
    { name: 'Reinigung', avg: 240, variance: 30 },
    { name: 'Verwaltung', avg: 85, variance: 40 },
    { name: 'Reparaturen', avg: 120, variance: 150 },
  ],
};

const counterparties = {
  'Elternbeiträge': ['Familie Müller', 'Familie Schmidt', 'Familie Wagner', 'Familie Klein', 'Familie Becker', 'Familie Hoffmann', 'Familie Fischer', 'Familie Weber', 'Familie Wolf', 'Familie Neumann'],
  'Fördermittel Senat': ['Senatsverwaltung Berlin'],
  'Spenden': ['Förderverein Pankonauten', 'Anonym', 'Familie Richter'],
  'Sonstige Einnahmen': ['Flohmärkterlöse', 'Kuchenverkauf', 'Sommerfest'],
  'Miete': ['Wohnungsbaugesellschaft Berlin'],
  'Personal': ['Gehaltsabrechnung Oktober', 'Gehaltsabrechnung'],
  'Lebensmittel': ['METRO Cash & Carry', 'Biocompany', 'REWE'],
  'Bastelmaterial': ['Modulor Berlin', 'Idee Creativmarkt', 'Amazon'],
  'Versicherungen': ['ARAG Versicherung', 'AON Versicherungen'],
  'Strom & Gas': ['Vattenfall', 'Berliner Gaswerke'],
  'Reinigung': ['CleanPro GmbH', 'Reinigungsservice Müller'],
  'Verwaltung': ['DATEV eG', 'Steuerberater Krause', 'Postbank Gebühren'],
  'Reparaturen': ['Handwerker Schmidt', 'Schreiner Meister GmbH', 'Elektriker Hoffmann'],
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTransactions() {
  const transactions = [];
  let id = 1;
  let balance = 18000;

  // Generate 13 months back from Feb 2026
  for (let monthOffset = 12; monthOffset >= 0; monthOffset--) {
    const date = new Date(2026, 1, 1); // Feb 2026
    date.setMonth(date.getMonth() - monthOffset);
    const year = date.getFullYear();
    const month = date.getMonth();

    // Income transactions (early in month)
    for (const cat of categories.income) {
      const variance = cat.variance > 0 ? rand(-cat.variance, cat.variance) : 0;
      const amount = cat.avg + variance;
      const day = cat.name === 'Fördermittel Senat' ? rand(1, 5) : rand(1, 10);
      const txDate = new Date(year, month, Math.min(day, 28));

      const counterpartyList = counterparties[cat.name] || [cat.name];
      let counterparty = counterpartyList[rand(0, counterpartyList.length - 1)];

      // For Elternbeiträge, split into multiple payments
      if (cat.name === 'Elternbeiträge') {
        const families = counterparties['Elternbeiträge'];
        const numFamilies = rand(8, 12);
        const perFamily = Math.floor(amount / numFamilies);
        for (let f = 0; f < numFamilies; f++) {
          const family = families[f % families.length];
          const fDay = rand(1, 10);
          const fDate = new Date(year, month, Math.min(fDay, 28));
          balance += perFamily;
          transactions.push({
            id: String(id++),
            date: fDate.toISOString().split('T')[0],
            description: `Elternbeitrag ${fDate.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}`,
            counterparty: family,
            amount: perFamily,
            category: 'Elternbeiträge',
            type: 'income',
            balance: balance,
          });
        }
        continue;
      }

      balance += amount;
      transactions.push({
        id: String(id++),
        date: txDate.toISOString().split('T')[0],
        description: `${cat.name} ${txDate.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}`,
        counterparty: counterparty,
        amount: amount,
        category: cat.name,
        type: 'income',
        balance: balance,
      });
    }

    // Expense transactions (spread through month)
    for (const cat of categories.expenses) {
      const variance = cat.variance > 0 ? rand(-cat.variance, cat.variance) : 0;
      const amount = -(cat.avg + variance);
      const day = cat.name === 'Miete' ? 1 : cat.name === 'Personal' ? 25 : rand(5, 28);
      const txDate = new Date(year, month, Math.min(day, 28));

      const counterpartyList = counterparties[cat.name] || [cat.name];
      const counterparty = counterpartyList[rand(0, counterpartyList.length - 1)];

      balance += amount;
      transactions.push({
        id: String(id++),
        date: txDate.toISOString().split('T')[0],
        description: `${cat.name} ${txDate.toLocaleString('de-DE', { month: 'long', year: 'numeric' })}`,
        counterparty: counterparty,
        amount: amount,
        category: cat.name,
        type: 'expense',
        balance: balance,
      });

      // Some categories have occasional extra transactions
      if (cat.name === 'Lebensmittel' && rand(0, 1)) {
        const extraDay = rand(10, 20);
        const extraDate = new Date(year, month, Math.min(extraDay, 28));
        const extraAmount = -rand(80, 200);
        balance += extraAmount;
        transactions.push({
          id: String(id++),
          date: extraDate.toISOString().split('T')[0],
          description: `Lebensmitteleinkauf`,
          counterparty: 'REWE Prenzlauer Berg',
          amount: extraAmount,
          category: 'Lebensmittel',
          type: 'expense',
          balance: balance,
        });
      }
    }
  }

  // Sort by date
  transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Recalculate rolling balance
  let runningBalance = 18000;
  for (let i = 0; i < transactions.length; i++) {
    runningBalance += transactions[i].amount;
    transactions[i].balance = Math.round(runningBalance * 100) / 100;
    transactions[i].amount = Math.round(transactions[i].amount * 100) / 100;
  }

  return transactions;
}

const transactions = generateTransactions();
const outputPath = path.join(__dirname, 'data', 'transactions.json');
fs.writeFileSync(outputPath, JSON.stringify(transactions, null, 2));
console.log(`Generated ${transactions.length} transactions`);
console.log(`Final balance: €${transactions[transactions.length - 1].balance.toFixed(2)}`);
