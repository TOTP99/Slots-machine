/* 符号表 + 中奖概率（结果导向）→ rollSpinResult / evaluateSpinResult */

const SYMBOLS = [
  { key: "seven", label: "7️⃣", color: "#ff2d2d", multiplier: 50 },
  { key: "blossom", label: "🌸", color: "#ff8fab", multiplier: 20 },
  { key: "hibiscus", label: "🌺", color: "#ff4d6d", multiplier: 15 },
  { key: "grape", label: "🍇", color: "#9b5de5", multiplier: 10 },
  { key: "strawberry", label: "🍓", color: "#ff2d55", multiplier: 8 },
  { key: "cherry", label: "🍒", color: "#e63946", multiplier: 6 },
  { key: "mushroom", label: "🍄", color: "#c77dff", multiplier: 4 },
];

// 先定结果类型再倒推符号，避免独立随机导致对子概率失控。RTP ≈ 87%（百万把级）
const SPIN_TABLE_TOTAL = 1000000;
const THREE_OF_KIND_WEIGHTS = {
  blossom: 700,
  hibiscus: 1000,
  grape: 1700,
  strawberry: 2300,
  cherry: 3200,
  mushroom: 4500,
};
const JACKPOT_WEIGHT = 320;
const PAIR_WEIGHT = 270000;

function buildSpinOutcomeTable() {
  const table = [{ type: "pair", weight: PAIR_WEIGHT }];
  Object.keys(THREE_OF_KIND_WEIGHTS).forEach((key) => {
    table.push({ type: "three", key, weight: THREE_OF_KIND_WEIGHTS[key] });
  });
  table.push({ type: "jackpot", key: "seven", weight: JACKPOT_WEIGHT });
  const used = table.reduce((sum, item) => sum + item.weight, 0);
  table.push({ type: "none", weight: Math.max(0, SPIN_TABLE_TOTAL - used) });
  return table;
}
const SPIN_OUTCOME_TABLE = buildSpinOutcomeTable();

function pickWeighted(table) {
  const total = table.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < table.length; i++) {
    roll -= table[i].weight;
    if (roll <= 0) return table[i];
  }
  return table[table.length - 1];
}

function symbolByKey(key) {
  return SYMBOLS.find((s) => s.key === key) || SYMBOLS[0];
}

function rollSpinResult() {
  const outcome = pickWeighted(SPIN_OUTCOME_TABLE);

  if (outcome.type === "jackpot" || outcome.type === "three") {
    const s = symbolByKey(outcome.key);
    return [s, s, s];
  }

  if (outcome.type === "pair") {
    const pairSymbol = Phaser.Utils.Array.GetRandom(SYMBOLS);
    let oddSymbol = Phaser.Utils.Array.GetRandom(SYMBOLS);
    while (oddSymbol.key === pairSymbol.key) {
      oddSymbol = Phaser.Utils.Array.GetRandom(SYMBOLS);
    }
    const arrangements = [
      [pairSymbol, pairSymbol, oddSymbol],
      [pairSymbol, oddSymbol, pairSymbol],
      [oddSymbol, pairSymbol, pairSymbol],
    ];
    return Phaser.Utils.Array.GetRandom(arrangements);
  }

  const shuffled = Phaser.Utils.Array.Shuffle(SYMBOLS.slice());
  return [shuffled[0], shuffled[1], shuffled[2]];
}

function evaluateSpinResult(a, b, c, bet, jackpotValue) {
  const isThreeOfAKind = a.key === b.key && b.key === c.key;
  const isJackpot = isThreeOfAKind && a.key === "seven";
  const isPair =
    !isThreeOfAKind && (a.key === b.key || a.key === c.key || b.key === c.key);

  if (isJackpot) {
    return { type: "jackpot", win: jackpotValue, symbol: a };
  }
  if (isThreeOfAKind) {
    return { type: "three", win: bet * a.multiplier, symbol: a };
  }
  if (isPair) {
    const pairSymbol = a.key === b.key || a.key === c.key ? a : b;
    return { type: "pair", win: bet * 2, symbol: pairSymbol };
  }
  return { type: "none", win: 0, symbol: null };
}
