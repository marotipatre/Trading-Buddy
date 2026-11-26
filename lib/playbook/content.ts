/**
 * Two rule books, paraphrased from widely taught professional practice and the well-known books listed in each reading
 * list. No text is copied from any book. Numbers marked as conventions are common practice, not laws.
 */
export interface Rule { rule: string; why: string; inApp?: { label: string; href: string } }
export interface Section { title: string; intro?: string; rules: Rule[] }
export interface Book {
  id: "swing" | "intraday";
  title: string;
  tagline: string;
  facts: { text: string; href?: string }[];
  sections: Section[];
  checklist: string[];
  routine: { when: string; what: string }[];
  mistakes: { mistake: string; fix: string }[];
  reading: { title: string; author: string; why: string }[];
  /** Concrete setups with entry, stop and target rules. */
  setups: { name: string; when: string; entry: string; stop: string; target: string; avoid: string }[];
  /** Small reference tables (numbers worth memorising). */
  tables: { title: string; note?: string; head: string[]; rows: string[][] }[];
  /** Stages to pass before risking more. */
  stages: { stage: string; do: string; passWhen: string }[];
  /** The short pledge: read before each session. */
  constitution: string[];
  /** Numbers to track every month, and what good looks like. */
  scorecard: { metric: string; how: string; target: string }[];
}



const SWING_GRADE: Section = {
  title: "Grade every setup before you size it",
  intro: "A simple grading rule keeps you from giving every idea the same size.",
  rules: [
    { rule: "A setup earns an A only if all of these are true: market trend healthy, sector in the top third, stock in a stage-2 uptrend, entry within 5% of a clean pivot, volume confirmation, and at least 3R of room to the next resistance. Size: your full planned risk.", why: "Quality varies enormously between setups. Matching size to quality is a free improvement in expectancy." },
    { rule: "A B setup fails one of those tests. Size: half your normal risk. A C setup fails two or more: skip it.", why: "Most losing months come from taking C setups out of boredom or hope." },
    { rule: "Write the grade in the journal. After 50 trades compare results by grade. If your A trades do not beat your B trades, your grading criteria need work.", why: "The grade is a testable hypothesis about your own edge." },
  ],
};
const SWING_EXIT: Section = {
  title: "Exit playbook: winners decide your year",
  rules: [
    { rule: "Pick your trailing method before entry. Options: the lowest low of the last 10 days (fast), the 20-day EMA (medium), or a chandelier stop at 3 times ATR below the highest high (volatility-aware).", why: "Chandelier-style ATR stops adapt to each stock's volatility; the 20-day EMA suits steady trends; the 10-day low suits fast, climactic moves. A trailing method chosen in advance cannot be argued with in the moment." },
    { rule: "At 1R of profit, consider moving the stop to breakeven. At 2R, sell a third to a half.", why: "Banking part of the gain lowers the chance a winner becomes a loser, and a breakeven stop makes the remaining position free to run." },
    { rule: "Never let a trade that was up more than 2R turn into a loss.", why: "That outcome is almost always an unmanaged winner, one of the most expensive habits in swing trading." },
    { rule: "Treat a climax as a sell signal: a stock more than about 25% to 30% above its 50-day average on a volume spike and a wide-range day often marks a short-term top.", why: "Parabolic runs end quickly. Selling into strength is easier than selling into a collapse." },
    { rule: "Use a time stop: if a trade has gone nowhere in 10 to 15 sessions, exit and redeploy the capital.", why: "Capital stuck in a stalled trade is an opportunity cost, and stalled trades tend to resolve downwards when the market weakens." },
    { rule: "Exit rules are for the whole position. Do not average a loser. Do not move a stop away.", why: "Both turn a planned small loss into an open-ended one." },
  ],
};
const SWING_PYRAMID: Section = {
  title: "Adding to winners and managing the book",
  rules: [
    { rule: "Add to a position only after it is in profit, and only if the combined stop keeps total risk at or below your original risk.", why: "Pyramiding on strength adds to the winners you have evidence for. Adding to losers adds to the ones you have evidence against." },
    { rule: "Make each add smaller than the last (for example 100%, 50%, 25%).", why: "It keeps the average cost below the current price and the risk shape sensible." },
    { rule: "Know your portfolio heat: the sum of risk across all open trades if every stop were hit. Keep it under about 6% of capital.", why: "Stocks are correlated in sell-offs, so many open positions can lose at once.", inApp: { label: "Ideas: mixed portfolio shows loss if all stops hit", href: "/ideas" } },
    { rule: "Review weak holdings weekly: any stock below its 50-day average or lagging its sector for three weeks is a candidate to replace.", why: "Money in laggards is money not in leaders.", inApp: { label: "Portfolio review: Hold / Add / Trim / Exit", href: "/portfolio?tab=review" } },
    { rule: "Keep cash as a position. When few setups grade A, hold more cash and wait.", why: "The edge is selectivity. Fully invested all the time means taking C setups." },
  ],
};
const SWING_EVENTS: Section = {
  title: "Events and news",
  rules: [
    { rule: "Know the results date of every stock you hold. Either exit or reduce size before it, or accept the gap and size so a 10% to 15% gap beyond your stop is survivable.", why: "Gaps ignore stop-losses. The only protection is size." },
    { rule: "On Union Budget day, RBI policy days and major global events, avoid starting new full-size positions.", why: "Volatility spikes and direction changes quickly; wait for the move to settle." },
    { rule: "Trade the reaction to news, not the headline. A stock that falls on good news or does not rise on it is telling you something.", why: "Price is the cleanest signal of what the market believes." },
    { rule: "Treat news-feed headlines as clues, not signals. Confirm with price and volume.", why: "Headlines are noisy and often already priced in.", inApp: { label: "Trade page: news and broker calls panel", href: "/trade" } },
  ],
};

const SWING_REGIME: Section = {
  title: "Check the market first",
  intro: "Most stocks follow the market. The best setups fail more often when the index is falling.",
  rules: [
    { rule: "Before buying, look at the Nifty 50 and a broad index (Nifty 500 or Midcap 150). Are they above their 50-day and 200-day averages and are those rising?", why: "William O'Neil's 'M' in CANSLIM: roughly three of four stocks move with the market. Buying breakouts in a downtrending index is swimming upstream.", inApp: { label: "Ideas: sector table shows the market's 1-month move", href: "/ideas" } },
    { rule: "In a healthy market take full-size positions. In a choppy market halve your size. In a downtrend (index below a falling 200-day average) hold mostly cash.", why: "Position size is the cheapest risk control: the same setups produce smaller losses when you size down in bad conditions." },
    { rule: "Watch breadth: the share of stocks above their 50-day average. Sharp falls in breadth while the index holds up are a warning.", why: "Narrow rallies lead to failed breakouts. The Ideas sector table shows how many stocks in each sector are in uptrends.", inApp: { label: "Ideas: share of each sector in an uptrend", href: "/ideas" } },
    { rule: "Track India VIX. A jump above its recent range means wider swings: widen stops and cut size, or wait.", why: "Volatility is risk. Fixed-percent stops get hit more often when volatility spikes." },
  ],
};
const SWING_SETUPS: Section = {
  title: "Trend, momentum and mean-reversion rules from the pros",
  rules: [
    { rule: "Use a volume check on breakouts: volume at least 40% to 50% above its 50-day average on the breakout day.", why: "O'Neil and Minervini both require demand evidence. A breakout on thin volume fails far more often." },
    { rule: "Do not chase: buy within about 5% of the breakout level. Beyond that, the stop is too far for a good reward-to-risk.", why: "Distance from the pivot is distance from your stop. Chasing is how a 6% stop becomes 12%." },
    { rule: "Prefer tight, quiet consolidations before breakouts (volatility contraction): each pullback shallower than the last.", why: "Minervini's VCP idea: supply dries up when sellers are exhausted, so the next push meets little resistance." },
    { rule: "Turtle-style trend rule: enter on a 20-day high close, exit on a 10-day low; size positions by volatility (ATR).", why: "A simple, tested trend-following rule set made public by Richard Dennis's Turtles. Many trades lose; a few large winners pay for all.", inApp: { label: "Backtest: '20-day breakout' preset", href: "/strategies" } },
    { rule: "For pullback entries use an uptrend filter (price above the 200-day average) and wait for RSI to cool to the 40s before buying near the 20-day average.", why: "Larry Connors-style pullbacks work best in uptrends; buying dips in downtrends is catching knives.", inApp: { label: "Ideas: Pullback in an uptrend method", href: "/ideas" } },
    { rule: "Never trade a method you have not seen work on many stocks over several years. Check the number of trades, not just the return.", why: "Backtests of 15 trades are noise. The Backtest page shows the win rate with a confidence range.", inApp: { label: "Backtest: win probability with confidence range", href: "/strategies" } },
  ],
};
const SWING_EXPECTANCY: Section = {
  title: "Expectancy and drawdown: know your numbers",
  rules: [
    { rule: "Measure every trade in R (profit divided by the amount you risked). Expectancy = (win rate x average win in R) minus (loss rate x average loss in R).", why: "Van Tharp's central idea. A 35% win rate with 3R winners gives +0.4R per trade; a 70% win rate with 0.3R winners and 1R losers gives about -0.09R.", inApp: { label: "Portfolio > Analysis: expectancy in R", href: "/portfolio?tab=analysis" } },
    { rule: "Set a monthly loss limit (Alexander Elder's 6% rule is one version: if your account falls 6% in a month, stop opening new trades until next month).", why: "It stops a bad run from becoming a disaster and forces a review while your head is clear." },
    { rule: "Cut size by half after a 5% to 10% drawdown from your peak and return to full size only after you earn back half of it.", why: "Drawdowns raise the odds that your thinking is off or the market has changed. Smaller size buys time and keeps recovery realistic." },
    { rule: "Keep the number of trades you need to judge a method in mind: at least 30, and 100 or more before trusting averages.", why: "Streaks of 5 to 8 losses happen in sound systems. A small sample cannot tell skill from luck." },
    { rule: "Do not compound too fast. Increase size only as capital grows, never because you feel lucky.", why: "Risk of ruin falls with fixed fractional sizing and rises sharply when size follows emotion." },
  ],
};
const SWING_PSY: Section = {
  title: "Psychology: protocols that actually help",
  rules: [
    { rule: "Write if-then rules in advance: 'If the stock closes below X, I sell at the open.' Pre-commit. Do not decide in the moment.", why: "Pre-commitment beats willpower. Research on implementation intentions shows planned responses are carried out far more reliably." },
    { rule: "Beware the disposition effect: people sell winners too early and hold losers too long. Counter it with trailing stops and fixed stop-losses.", why: "It is one of the best-documented investor biases (loss aversion from Kahneman and Tversky's work)." },
    { rule: "Run a pre-mortem before a big position: imagine it failed and list why. If the reasons are plausible, shrink the size or skip.", why: "It surfaces risks overconfidence hides." },
    { rule: "Check positions at fixed times, not constantly. Avoid looking at P&L during the day if it makes you act.", why: "Frequent checking increases the pain of normal swings and the urge to interfere." },
    { rule: "Size so that a full loss on any single trade does not affect your sleep or mood.", why: "If a position keeps you awake, it is too big. Fear makes you exit good trades early." },
    { rule: "Take a break after your biggest win and your biggest loss. Both distort judgment.", why: "Euphoria and anger both lead to oversized, rule-breaking trades." },
    { rule: "Keep one rule for yourself: 'I follow the plan.' Score each trade on whether you did, regardless of profit.", why: "You control process, not outcome. A process score tends to lift results over time." },
  ],
};
const SWING_INDIA: Section = {
  title: "India: costs, tax and market structure",
  intro: "Rules change. Check current figures with your broker or a tax advisor before relying on them.",
  rules: [
    { rule: "Short-term capital gains on listed equity held under a year were taxed at 20%, and long-term gains above Rs 1.25 lakh a year at 12.5% (rates since July 2024; they have changed before).", why: "Tax is a cost on every winning swing trade. A 10% pre-tax gain is closer to 8% after tax and charges." },
    { rule: "Check the circuit band and delivery volume. Stocks that hit 5% or 10% circuits can be impossible to exit.", why: "A stop-loss does not help if there are no sellers' buyers." },
    { rule: "Avoid the ASM/GSM watch lists and stocks under trade-for-trade settlement.", why: "These carry extra margin rules and are flagged by the exchange for unusual risk." },
    { rule: "Be careful with results season, Union Budget, RBI policy days and global events. Reduce size or skip trades that could gap beyond your stop.", why: "Gaps go through stops. Size to survive a gap, not just a normal stop-out." },
    { rule: "Prefer stocks in the Nifty 200 for swing trades until you have a track record.", why: "Liquidity and information quality are better than in small caps, so your stops behave as expected." },
  ],
};

export const SWING: Book = {
  id: "swing",
  title: "Swing trading rule book",
  tagline: "Holding for days to weeks. Your edge is patience, small losses and a sound process, repeated many times.",
  facts: [
    { text: "Most of a trader's results come from a few trades. Cutting losers short and letting winners run matters more than being right often." },
    { text: "Momentum and trend following have a long record in Indian equities (the Nifty200 Momentum 30 index has returned roughly 19–20% a year since 2005 against about 15% for the broad Nifty 200), but with long stretches of underperformance.", href: "https://freefincal.com/nifty200-momentum-30-index-a-new-strategy-index-from-the-nse/" },
    { text: "A 10% loss needs an 11% gain to recover, a 30% loss needs 43%, a 50% loss needs 100%. Protecting capital comes first." },
  ],
  sections: [
    {
      title: "Choose what to trade",
      rules: [
        { rule: "Trade in the direction of the larger trend: price above rising 50- and 200-day averages, weekly trend up.", why: "Trend followers such as Minervini and O'Neil buy strength in confirmed uptrends, because stocks in uptrends keep going more often than stocks that look 'cheap' in downtrends.", inApp: { label: "Ideas: Minervini trend template", href: "/ideas" } },
        { rule: "Prefer the strongest sectors and the strongest stocks in them.", why: "A good stock in a weak sector has a headwind; leaders in strong sectors tend to lead again.", inApp: { label: "Ideas: sector ranking and Focus list", href: "/ideas" } },
        { rule: "Buy at a sensible point: a pullback to a rising average or a breakout from a tight base, not after a run of 10% or more.", why: "Entry near a support level lets you put the stop close, which improves reward against risk. Chasing makes the stop far and the odds worse." },
        { rule: "Skip illiquid and operator-driven stocks.", why: "Wide spreads and sudden circuit limits can stop you out far from where you planned." },
        { rule: "Check upcoming results dates before you enter. Avoid holding through one unless that is the plan.", why: "An earnings gap can jump straight through your stop; your risk is then larger than you sized for." },
      ],
    },
    {
      title: "Plan every trade before you enter",
      rules: [
        { rule: "Write entry, stop-loss and target before buying. Do not enter if you cannot.", why: "A plan made while the price is moving is a plan made by emotion.", inApp: { label: "Ideas gives entry, stop and targets", href: "/ideas" } },
        { rule: "Aim for at least 2 times as much reward as risk (2R). Skip trades below about 1.5R.", why: "With 2R winners you can be wrong more often than right and still profit. At 40% winners and 2R, each trade averages +0.2R before costs." },
        { rule: "Place the stop where the idea is wrong (below support or the recent swing low), not at an amount you can afford.", why: "The market does not know your budget. A stop at a meaningful level is respected more often.", inApp: { label: "Backtest: stops below support or an EMA", href: "/strategies" } },
        { rule: "Use a stop-loss order, not a mental stop.", why: "A mental stop is the first thing to move when the trade goes against you.", inApp: { label: "Order ticket: stop-loss and take-profit on every order", href: "/trade" } },
        { rule: "Never move a stop further away. You may tighten it behind a winner.", why: "Widening a stop turns a small planned loss into a large unplanned one." },
      ],
    },
    {
      title: "Position sizing and portfolio risk",
      intro: "Risk is decided by position size, not by hope. These are common conventions; pick your own and keep them.",
      rules: [
        { rule: "Risk about 0.5% to 1% of your capital on a single trade (many professionals use 1% or less; 2% is considered the upper end).", why: "At 1% risk, ten losses in a row cost about 10%. At 10% risk per trade the same run ends the account.", inApp: { label: "Ideas sizes each trade to your risk setting", href: "/ideas" } },
        { rule: "Shares = (capital x risk %) divided by (entry minus stop).", why: "It keeps every trade the same size in risk terms, whatever the price or volatility." },
        { rule: "Hold 5 to 10 positions, no more than 2 in one sector, and keep part of the money in cash.", why: "Spreading across sectors protects you from one bad group; cash lets you act on new setups." },
        { rule: "Limit total open risk (the sum of all stop distances) to about 5% to 6% of capital.", why: "Stocks fall together in a market drop, so open positions are more connected than they look." },
        { rule: "Cut size, do not add risk, after a losing streak. Return to full size after wins.", why: "Drawdowns are when judgment is worst. Smaller size gives you time to recover your thinking.", inApp: { label: "Portfolio review: concentration warnings", href: "/portfolio?tab=review" } },
      ],
    },
    {
      title: "Manage the trade",
      rules: [
        { rule: "Take the loss when the stop is hit. Do not re-enter the same stock within a day or two out of anger.", why: "A stop-out is the cost of doing business, not a verdict on you." },
        { rule: "Sell part (a third to a half) at the first target, move the stop to breakeven, and let the rest follow a trailing stop.", why: "It banks a gain, removes the risk of a winner turning into a loser and still leaves room for the rare big winner." },
        { rule: "Exit when the reason for the trade is gone: the trend breaks, or the time limit you set passes with nothing happening.", why: "Dead money has a cost. A time stop frees capital for better ideas.", inApp: { label: "Backtest: time stop and trailing stop", href: "/strategies" } },
        { rule: "Review open trades once a day after the close, not every few minutes during it.", why: "Constant watching turns normal noise into emotional decisions." },
      ],
    },
    {
      title: "Process and review",
      rules: [
        { rule: "Keep a journal: reason for entry, plan, result in R, what you did right or wrong.", why: "You cannot improve what you do not measure. Patterns in your mistakes are the best coaching available.", inApp: { label: "Portfolio > Analysis: your trade journal", href: "/portfolio?tab=analysis" } },
        { rule: "Judge your process, not one result. A well-executed trade that lost is a good trade.", why: "Outcomes of single trades are random. Sticking to the rules is what you control." },
        { rule: "Test a method on many stocks and years before using real money. Be suspicious of any result from a handful of trades.", why: "Small samples and over-tuned settings look great in history and fail live.", inApp: { label: "Backtest: groups, out-of-sample and optimizer", href: "/strategies" } },
        { rule: "Do paper trading first, then small real size, then scale up only after dozens of trades follow your rules.", why: "It separates a flawed method from flawed execution at a small cost." },
      ],
    },
    {
      title: "India-specific notes",
      rules: [
        { rule: "Delivery (CNC) trades carry securities transaction tax and other charges. Include costs when you judge a setup.", why: "Charges come off every round trip; short holds with small targets suffer most.", inApp: { label: "Backtests include Indian charges and slippage", href: "/strategies" } },
        { rule: "Gaps are common around results, global moves and news. A stop-loss order may fill below your price in a gap.", why: "Size so that a gap beyond your stop is survivable." },
        { rule: "Avoid concentration in small caps and SME stocks unless you accept very wide swings and thin liquidity.", why: "They can fall faster than the stop can get you out." },
      ],
    },
  ],
  checklist: [
    "The stock is in an uptrend on the daily and weekly chart.",
    "Its sector is also strong.",
    "I know my entry, stop-loss and target, and the reward is at least 2 times the risk.",
    "My risk on this trade is 1% of capital or less, and total open risk stays within about 6%.",
    "No results announcement or major event before my planned exit, or I accept it.",
    "I have placed the stop-loss order, not just decided it.",
    "I am calm. I am not trying to win back a loss or catching up on a missed move.",
  ],
  routine: [
    { when: "Weekend", what: "Scan with Ideas, review sector strength, pick a short list, write a plan for each." },
    { when: "Before the open", what: "Check overnight news and global markets. Cancel plans for anything that changed." },
    { when: "During the day", what: "Place planned orders. Otherwise do nothing; avoid watching every tick." },
    { when: "After the close", what: "Update stops, note what happened, write the journal entry." },
    { when: "End of month", what: "Review results in R, win rate, average winner and loser, and rule breaks. Adjust one thing at a time." },
  ],
  mistakes: [
    { mistake: "Moving the stop away to avoid a loss", fix: "Write the stop before entering and place the order. Treat moving it away as a rule break to log." },
    { mistake: "Averaging down on a losing stock", fix: "Add only to winners, and only at planned points. A loser is not 'cheaper', it is wrong." },
    { mistake: "Selling winners too early, holding losers too long", fix: "Use partial profits and a trailing stop; give losers a fixed exit." },
    { mistake: "Fear of missing out after a big move", fix: "There is always another setup. Wait for a pullback or skip it." },
    { mistake: "Over-trading from boredom", fix: "Set a maximum number of open positions. No setup means no trade." },
    { mistake: "Betting big after a win streak", fix: "Keep size tied to the 1% rule. Confidence is not an edge." },
    { mistake: "Seeking tips instead of a process", fix: "Trade only setups you can write down and test." },
  ],
  setups: [], tables: [], stages: [], scorecard: [], constitution: [],
  reading: [
    { title: "Trade Like a Stock Market Wizard", author: "Mark Minervini", why: "Trend template, risk control and cutting losses fast." },
    { title: "How to Make Money in Stocks", author: "William O'Neil", why: "Leaders, bases and the discipline of cutting losses at 7–8%." },
    { title: "Trade Your Way to Financial Freedom", author: "Van K. Tharp", why: "R-multiples, expectancy and position sizing." },
    { title: "Trading in the Zone", author: "Mark Douglas", why: "Thinking in probabilities and accepting that any single trade can lose." },
    { title: "Come Into My Trading Room", author: "Alexander Elder", why: "The 2% and 6% rules and a trading plan." },
    { title: "Market Wizards", author: "Jack Schwager", why: "Interviews showing that great traders differ in method but share risk discipline." },
    { title: "Technical Analysis of the Financial Markets", author: "John Murphy", why: "A broad reference for trends, support and resistance and indicators." },
    { title: "Thinking, Fast and Slow", author: "Daniel Kahneman", why: "The biases (loss aversion, overconfidence) that cause trading mistakes." },
  ],
};

const find = (all: Section[], t: string): Section => { const f = all.find((s) => s.title.includes(t)); if (!f) throw new Error(`missing section: ${t}`); return f; };
const joinSections = (a: Section, b: Section, title: string): Section => ({ title, intro: b.intro ?? a.intro, rules: [...a.rules, ...b.rules.filter((r) => !a.rules.some((x) => x.rule === r.rule))] });
{
  const all = [...SWING.sections, SWING_REGIME, SWING_GRADE, SWING_SETUPS, SWING_EXPECTANCY, SWING_PSY, SWING_INDIA, SWING_EXIT, SWING_PYRAMID, SWING_EVENTS];
  const india = joinSections(find(all, "India: costs"), find(all, "India-specific notes"), "India: costs, tax and market structure");
  SWING.sections = [
    find(all, "Check the market first"), find(all, "Choose what to trade"), find(all, "Trend, momentum"), find(all, "Grade every setup"), find(all, "Plan every trade"),
    find(all, "Position sizing"), find(all, "Manage the trade"), find(all, "Exit playbook"), find(all, "Adding to winners"), find(all, "Expectancy and drawdown"),
    find(all, "Events and news"), find(all, "Psychology: protocols"), find(all, "Process and review"), india,
  ];
}

SWING.setups = [
  { name: "Pullback to a rising average", when: "Stock in an uptrend (above rising 50 and 200-day averages) falls back to its 20-day or 50-day average on lighter volume and RSI cools into the 40s.", entry: "Buy when price turns up: a close above the prior day's high, or a buy-stop just above it.", stop: "Below the pullback low (or the swing low) with a small buffer. Skip if the stop is over about 7% away.", target: "The prior high, then a trailing stop under the 10-day low or 20-day average. Aim for 2R or more.", avoid: "The average is flat or falling, the pullback is on rising volume, or the market is in a downtrend." },
  { name: "Base breakout", when: "Stock is in an uptrend and has traded in a tight range of 3 to 8 weeks, volatility shrinking, near its high.", entry: "Buy-stop just above the top of the range on a day with volume at least 40% above average.", stop: "Below the low of the last contraction, usually 4% to 8% below the entry.", target: "Sell a third to a half at 2R to 3R, trail the rest under the 20-day average.", avoid: "Breakouts on thin volume, more than 5% above the pivot, or into a market downtrend." },
  { name: "Trend continuation (flag)", when: "A sharp rise on volume followed by a short, shallow sideways or slightly down drift (about 5 to 15 days).", entry: "Buy the break above the drift's high.", stop: "Below the flag low.", target: "Roughly the height of the prior rise measured from the breakout, or a trailing stop.", avoid: "Flags that drift down on heavy volume or last more than about three weeks." },
  { name: "Support bounce", when: "Price returns to a level that held before (a prior swing low or rising trendline) in a larger uptrend.", entry: "Buy after the first sign of buyers: a close back above support or a bullish candle at the level.", stop: "Just below the support level (1% to 1.5% buffer).", target: "The next resistance, at least 2R away.", avoid: "Support that has been tested many times (it weakens), or a break on volume." },
];
SWING.tables = [
  { title: "What a loss costs you to recover", note: "Why capital protection comes first.", head: ["Loss", "Gain needed to get back"], rows: [["5%", "5.3%"], ["10%", "11.1%"], ["20%", "25%"], ["30%", "42.9%"], ["50%", "100%"]] },
  { title: "Expectancy examples (before costs)", note: "A high win rate does not guarantee profit.", head: ["Win rate", "Avg win", "Avg loss", "Expectancy per trade"], rows: [["35%", "3.0R", "1.0R", "+0.40R"], ["45%", "2.0R", "1.0R", "+0.35R"], ["60%", "1.0R", "1.0R", "+0.20R"], ["70%", "0.3R", "1.0R", "-0.09R"]] },
  { title: "Losing streaks to expect", note: "Chance of at least one run of this many losses in 100 trades at a given win rate (computed; use the calculator for other cases).", head: ["Win rate", "5 in a row", "8 in a row", "10 in a row"], rows: [["50%", "about 81%", "about 17%", "about 4%"], ["40%", "about 98%", "about 49%", "about 20%"], ["30%", "about 100%", "about 86%", "about 58%"]] },
];
SWING.stages = [
  { stage: "1. Paper trade", do: "Follow the rule book with paper money, one position size, journal every trade.", passWhen: "At least 50 trades, expectancy above 0 after costs, and you followed your plan on 90% of them." },
  { stage: "2. Small real size", do: "Trade with 10% to 25% of your intended size.", passWhen: "Another 50 trades with results in line with paper trading and no major rule breaks." },
  { stage: "3. Build up", do: "Raise size by about a quarter at a time, never after one good week.", passWhen: "Each step: a month with drawdown within your limit and a clean journal." },
  { stage: "4. Review and refine", do: "Quarterly: change at most one rule at a time and test it first.", passWhen: "A change is accepted only if it helps over many trades, not a few." },
];
SWING.scorecard = [
  { metric: "Expectancy (R per trade)", how: "Average of all trades in R", target: "Above +0.2R after costs" },
  { metric: "Win rate with its range", how: "Winners divided by trades, 95% range", target: "Depends on payoff. 35% to 50% with 2R winners is fine" },
  { metric: "Average winner / average loser", how: "In R", target: "Winner at least 1.5 times the loser" },
  { metric: "Maximum drawdown", how: "Largest peak-to-trough fall", target: "Within your own limit (for example 10% to 15%)" },
  { metric: "Rule-following rate", how: "Trades that followed the plan divided by all trades", target: "90% or more" },
  { metric: "Costs and tax as share of gross profit", how: "Brokerage, taxes and slippage", target: "Under 25%" },
];



const ID_PREMARKET: Section = {
  title: "Before the open: the pre-market checklist (India)",
  rules: [
    { rule: "Check GIFT Nifty (the successor to SGX Nifty) and overnight US and Asian markets for the likely opening direction.", why: "A gap-up or gap-down open changes which setups are valid." },
    { rule: "Read the provisional FII/DII flows from the previous session and India VIX.", why: "Strong FII selling and a rising VIX mean wider swings and more false breakouts; reduce size or trade less." },
    { rule: "List today's events: results, board meetings, RBI, index expiry, global data. Avoid or cut size on stocks with news.", why: "Event stocks gap and whipsaw. Plan for them or skip." },
    { rule: "Check the F&O ban list and any circuit or surveillance changes on your picks.", why: "Banned or restricted stocks can have limited or margin-heavy trading." },
    { rule: "Write down three things: the day's maximum loss, the setups you will trade, and the one mistake you will avoid.", why: "Committing in writing before the open makes it harder to rationalise later." },
  ],
};
const ID_EXEC: Section = {
  title: "Execution rules",
  rules: [
    { rule: "Look at the spread and depth before you enter. If the bid-ask spread is more than a quarter of your stop distance, skip the stock.", why: "A wide spread eats your edge in slippage on both sides." },
    { rule: "Use limit orders or buy-stops with a small limit when you can. Use market orders only in highly liquid stocks.", why: "Market orders in thin names can fill far from the price you saw." },
    { rule: "Place the stop and target at once (bracket or cover order).", why: "It enforces the exit even if you freeze or the connection drops." },
    { rule: "At +1R, sell half and move the stop on the rest to breakeven. Trail the rest under the last higher low on the 5-minute chart.", why: "Banking half makes the trade risk-free and the remainder can capture a trend day." },
    { rule: "Time stop: if the trade has not moved in your favour within 45 to 60 minutes, exit.", why: "A setup that does not work promptly is usually not working. Freed margin and attention are worth more." },
    { rule: "Never add to a losing intraday position. Never move a stop further away.", why: "Both are how small losses become account-sized ones when margin multiplies the damage." },
  ],
};
const ID_STATES: Section = {
  title: "Your state: green, amber, red",
  intro: "Intraday results depend on you being in a fit state. Decide the state before you click.",
  rules: [
    { rule: "Green: rested, calm, following the plan. Trade normally.", why: "Your normal rules assume your normal judgment." },
    { rule: "Amber: after a loss, a missed move, a long morning or any frustration. Halve your size and take only A setups.", why: "Amber is when mistakes start. Smaller size contains the cost while you reset." },
    { rule: "Red: two rule breaks, revenge urges, anger, fatigue or after hitting a daily limit. Stop. Close the platform.", why: "Red-state trades have the worst expectancy of the day. Skipping them is the single highest-return habit." },
    { rule: "When ahead for the day, protect the gain: if you give back a third of the day's profit, stop. Do not raise size because you are 'playing with the market's money'.", why: "Profits are yours. The green-day trap turns a good day into a flat or red one." },
    { rule: "If you are down and want to 'make it back' today, that urge is the signal to stop.", why: "Chasing losses is the best-documented path to blow-ups." },
  ],
};
const ID_EVENTS: Section = {
  title: "Expiry days and event days",
  intro: "Exchange expiry days and contract schedules have changed over time. Check the current calendar.",
  rules: [
    { rule: "On index expiry days, swings in heavy-weight stocks can be sharper and the last hour erratic. Trade smaller and avoid chasing.", why: "Hedging and expiry unwinds move prices for reasons unrelated to the stock's own news." },
    { rule: "On results day for a stock, skip it unless you are trading the reaction after the first 30 minutes.", why: "Spreads and slippage are at their worst around the release." },
    { rule: "On days with a major scheduled event (RBI policy, Budget, big global data), reduce size or sit out until after the announcement.", why: "Direction is a coin flip around the event, and stops get run." },
  ],
};

const ID_DAY: Section = {
  title: "The trading day, hour by hour (India)",
  intro: "Market hours are 9:15 am to 3:30 pm. Most brokers square off intraday (MIS) positions automatically between about 3:15 and 3:25 pm.",
  rules: [
    { rule: "9:00 to 9:15 pre-open: study gaps and which stocks are active. Do not trade the auction. Cancel plans for picks that gapped past entry or through the stop.", why: "The open sets the day's tone, and many gaps invalidate yesterday's plan." },
    { rule: "9:15 to 9:30: watch. Let the opening range form (the high and low of the first 15 or 30 minutes).", why: "The opening range gives the day's first support and resistance; early trades have wide spreads and false moves." },
    { rule: "9:30 to 11:30: the best window for clean moves. Trade planned setups: opening-range breakouts and pullbacks in the day's direction.", why: "Volume and volatility are highest early, so targets are reached faster." },
    { rule: "11:30 to 1:30: usually slow and choppy. Trade less or not at all.", why: "Lower volume produces more false breakouts and more costs per profit." },
    { rule: "1:30 to 2:30: momentum often returns with later flows. Plan only clear setups.", why: "The afternoon move often decides the day's trend." },
    { rule: "After 2:30: no new trades. Close everything by 3:10 pm yourself rather than leaving it to the broker's auto square-off.", why: "Auto square-off charges a fee and you do not control the price. Closing time moves are erratic." },
  ],
};
const ID_RISK: Section = {
  title: "Hard limits: the rules that protect your pot",
  intro: "The Intraday page enforces the first three for you.",
  rules: [
    { rule: "Daily loss limit: stop for the day when you lose 2% of your pot (3% at most).", why: "Professionals and prop firms use daily loss limits because losses compound emotionally. The day you break this limit is the day accounts die.", inApp: { label: "Intraday page enforces a daily loss limit", href: "/intraday" } },
    { rule: "Three losses in a row: stop for the day.", why: "Either conditions do not suit your setups or you are tilting. Both mean stop.", inApp: { label: "Intraday page locks orders after 3 losses in a row", href: "/intraday" } },
    { rule: "Maximum trades per day: 3 to 5.", why: "SEBI's study found the most frequent traders lost most often. More trades mostly add costs and mistakes.", inApp: { label: "Intraday page caps trades per day", href: "/intraday" } },
    { rule: "Gave back a third or more of the day's profit? Stop.", why: "Green-day giveback is the classic way a good day turns red. Protect what you earned." },
    { rule: "Weekly loss limit of about 5% of the pot. Reaching it means a review day, not a trading day.", why: "It stops a bad week becoming a bad month." },
    { rule: "Do not hold three or more positions in the same sector at once. Treat correlated stocks (for example three banks) as a single trade.", why: "Correlated stocks stop out together, so your real risk is larger than it looks." },
  ],
};
const ID_SETUPS: Section = {
  title: "Setup rules used by professional day traders",
  rules: [
    { rule: "Trade VWAP: be long only above it, short only below it. Use pullbacks to VWAP in a trending day.", why: "VWAP is where the day's average buyer stands. Institutions benchmark to it, so it often acts as support and resistance." },
    { rule: "Identify the day type early. A trend day moves one way with shallow pullbacks; a range day oscillates. Trade breakouts on trend days and fade the edges on range days.", why: "The same entry works on one day and loses on the other. Matching the tool to the day is the edge." },
    { rule: "Opening range breakout: buy above the high of the first 15 or 30 minutes with volume, stop below the range low or the middle, target 1.5R to 2R.", why: "A classic documented approach. It fails often in choppy markets, so use it with the market trend and a filter such as the gap direction." },
    { rule: "Prior-day high or low is a magnet. A clean break of yesterday's high with volume in a strong stock is a valid long trigger.", why: "That is the level the next-session picks use for entry." },
    { rule: "Avoid trades at the extremes of a long run without a pullback: it is where late buyers get trapped.", why: "Entries far from VWAP have wide stops and poor reward to risk." },
    { rule: "If a breakout fails (back inside the range within a few candles), exit at once. Failed breakouts are information.", why: "Fast reversals are often followed by a move in the opposite direction." },
  ],
};
const ID_COSTS: Section = {
  title: "Costs and margin in India",
  intro: "Check your broker's current charges; these are typical.",
  rules: [
    { rule: "Know your break-even per round trip. With brokerage of about Rs 20 a side or less, securities transaction tax of about 0.025% on the sell side, exchange and SEBI fees, GST and slippage, a round trip typically costs several hundredths of a percent plus brokerage.", why: "On a small trade, brokerage can be a larger share of the target than the stock's move. Compute costs before entering." },
    { rule: "Margin (MIS leverage) depends on the stock and your broker, and can be well below 5x. Under SEBI's peak margin rules brokers must collect the required margin up front and may penalise shortfalls.", why: "You may not get the leverage you assume. Do not size trades based on the maximum leverage a screen shows." },
    { rule: "Expect an auto square-off fee if you leave intraday positions to the broker. Avoid it by exiting yourself.", why: "It costs money and the fill is at an unfavourable time." },
    { rule: "Intraday profits are taxed as business income at your slab rate, and losses can be set off against other business income. Keep records.", why: "Tax planning affects the real return. Confirm current rules with an advisor." },
  ],
};
const ID_PSY: Section = {
  title: "Psychology protocols for day traders",
  rules: [
    { rule: "Start each day with a 2-minute routine: read the rules, state the daily loss limit, and name the one mistake you will avoid today.", why: "A fixed routine puts you in a planning state before the emotion starts." },
    { rule: "After every loss, stand up and look away for 10 to 15 minutes before the next trade.", why: "Tilt peaks right after a loss. A short pause breaks the revenge-trade impulse." },
    { rule: "After a big green morning, reduce size for the rest of the day.", why: "Overconfidence after wins is as destructive as fear after losses." },
    { rule: "Use bracket orders or place stops at once so protection does not depend on your mood.", why: "Automation removes the chance to hesitate." },
    { rule: "Limit screen time. Trade only the windows in your plan and close the platform afterwards.", why: "Boredom trades happen when you stare at screens with no plan." },
    { rule: "Never trade while impaired: poor sleep, stress, illness or after an argument.", why: "Decision quality falls quickly. A skipped day costs almost nothing." },
    { rule: "Journal with a screenshot: setup, entry, exit, and how you felt. Review the worst trade each week.", why: "Emotions are visible in notes long before they show up in the profit curve." },
  ],
};

export const INTRADAY: Book = {
  id: "intraday",
  title: "Intraday rule book",
  tagline: "Same-day trades with margin. The aim is to survive, keep losses small and trade only when conditions are good.",
  facts: [
    { text: "SEBI's study of FY2022-23 found about 7 in 10 individual intraday traders in the equity cash segment made a net loss, rising to about 8 in 10 among the most frequent traders; costs made up a large share of the losses.", href: "https://www.sebi.gov.in/media-and-notifications/press-releases/jul-2024/sebi-study-finds-that-7-out-of-10-individual-intraday-traders-in-equity-cash-segment-make-losses_84948.html" },
    { text: "SEBI's earlier studies of futures and options found roughly 9 in 10 active individual traders lost money (about 89–90% in FY22, per press reports of SEBI's study)." },
    { text: "Margin multiplies gains and losses equally. At 5x, a 1% move against you costs 5% of your own money, and a 20% adverse move wipes it out." },
  ],
  sections: [
    {
      title: "Before you trade at all",
      rules: [
        { rule: "Trade only with money whose loss will not change your life. Use a separate pot and never refill it from savings to chase losses.", why: "Desperation destroys discipline. A separate pot makes the true cost visible.", inApp: { label: "Intraday: its own pot and P&L", href: "/intraday" } },
        { rule: "Paper trade your plan for several weeks. Move to small real size only after the results are positive over 50 or more trades.", why: "Most losers skip this. Paper results show whether the method and your execution work.", inApp: { label: "Intraday scorecard replays every pick", href: "/intraday" } },
        { rule: "Decide your maximum daily loss before the open. When it is hit, stop for the day.", why: "Large losses come from trading after you should have stopped. Common limits: about 3 times the per-trade risk, or 2% to 3% of the pot." },
      ],
    },
    {
      title: "Risk per trade and margin",
      rules: [
        { rule: "Risk 0.5% to 1% of your own money per trade, measured from entry to stop, not from the margin amount.", why: "Margin gives size, not safety. Risk is set by the stop.", inApp: { label: "Intraday sizes each pick by risk, not by margin", href: "/intraday" } },
        { rule: "Do not use all your buying power. Keep each position well under the maximum and have no more than 2 or 3 open at once.", why: "Full leverage on one idea means one gap can erase a week of gains." },
        { rule: "Make sure reward is at least 1.5 times risk before entering.", why: "At 1.5R you need to win only about 40% of trades to break even before costs, and costs matter a great deal intraday." },
        { rule: "Count charges and slippage in every plan. Skip trades where the target is too small to pay for them.", why: "Costs were a major driver of losses in SEBI's study. A 0.3% target can be gone after brokerage, taxes and slippage." },
        { rule: "Never average down a losing intraday trade and never remove a stop.", why: "With margin a small adverse move becomes a big loss quickly." },
      ],
    },
    {
      title: "What to trade",
      rules: [
        { rule: "Trade liquid stocks only: tight spreads, heavy volume and enough daily range to reach your target.", why: "Illiquid stocks gap through stops and trap you.", inApp: { label: "Intraday picks require high turnover and a workable daily range", href: "/intraday" } },
        { rule: "Trade with the day's direction: strong stocks in strong sectors when the index is steady or rising.", why: "Fighting the trend is the classic beginner's trap." },
        { rule: "Focus on one or two simple setups (breakout above the prior high on volume, or a pullback to the day's average in a trend) and master them.", why: "Specialisation beats variety. You learn what a good version looks like." },
        { rule: "Avoid the first 15 minutes after the open unless you have a specific plan, and be cautious near the close.", why: "Opening prices are erratic and spreads wide; closing moves are often exits by others." },
        { rule: "Do not trade on tips, rumours or social media calls.", why: "You do not know the source's entry, exit or motive." },
      ],
    },
    {
      title: "Execution",
      rules: [
        { rule: "Enter with a plan: entry trigger, stop, first target, and a time limit. Place the stop at once.", why: "Delay turns a plan into a guess.", inApp: { label: "Place the pick with SL and TP attached", href: "/intraday" } },
        { rule: "Skip the trade if the stock gaps well beyond the entry or through the stop at the open.", why: "The risk-to-reward you planned no longer exists." },
        { rule: "Take profit at the target. A common approach: sell half at 1R and trail the rest.", why: "Intraday moves reverse fast. Banking gains keeps winners from becoming losers." },
        { rule: "Be flat before the 3:15 pm square-off. Do not carry an intraday trade 'to make it a delivery'.", why: "That converts a failed day trade into an unplanned investment, usually a loser." },
        { rule: "No revenge trades: after a loss, wait, walk away for at least 15 minutes, and check your list.", why: "The next trade after a loss is statistically your worst." },
      ],
    },
    {
      title: "Psychology and discipline",
      rules: [
        { rule: "Think in series of trades. Any single trade is a coin toss weighted by your edge; only many trades reveal it.", why: "This is the core idea of Mark Douglas's work: accept uncertainty to act without fear." },
        { rule: "Stop after 3 losses in a row, or when you break a rule twice in a day.", why: "It means conditions or your state are wrong. Stepping back protects the pot." },
        { rule: "Do not trade when tired, angry, hungry, distracted or after bad news in your life.", why: "Decision quality drops sharply. Skipping a day is cheap." },
        { rule: "Treat a day with no good setup as a successful day.", why: "Boredom trades are a leading cause of losses and costs." },
        { rule: "Write down why you entered and how you felt. Review your worst day each week.", why: "Patterns of fear, greed and impatience show up in the notes before they show up in the P&L." },
      ],
    },
    {
      title: "Review",
      rules: [
        { rule: "End each day with the journal: setup, result in R, did you follow the plan, one lesson.", why: "Plan adherence is the number to improve." },
        { rule: "Every month, compare results with the scorecard. If the picks do not work, change the method, not the size.", why: "Larger size on a method that does not work only speeds up losses.", inApp: { label: "Intraday scorecard and your results side by side", href: "/intraday" } },
        { rule: "Count total costs (brokerage, taxes, slippage) as a share of gross profit.", why: "If costs eat most of your gross gains, the strategy needs fewer, better trades." },
      ],
    },
  ],
  checklist: [
    "Today's maximum loss is written down and I will stop when it is reached.",
    "The stock is liquid and has a daily range that can reach the target.",
    "Entry, stop, target are written. Reward is at least 1.5 times risk after costs.",
    "My risk on this trade is 1% of my own money or less, and I am not using all the margin.",
    "The stop order is placed with the trade.",
    "I am not revenge trading, and I have not had 3 losses in a row today.",
    "I will be flat by 3:15 pm.",
  ],
  routine: [
    { when: "Evening before", what: "Scan for next-session picks. Read each plan. Write the day's maximum loss." },
    { when: "8:45 to 9:15", what: "Check global markets, the index trend and overnight news for the picks." },
    { when: "9:15 to 9:30", what: "Watch only. Cancel plans for any pick that gapped past its entry or through its stop." },
    { when: "9:30 to 2:30", what: "Take only planned setups, with stops placed. Log each trade as it happens." },
    { when: "2:30 to 3:15", what: "Close what is left. No new trades late in the day." },
    { when: "After the close", what: "Journal, compare with the scorecard, and stop for the day." },
  ],
  mistakes: [
    { mistake: "Trading too often", fix: "Cap trades per day (for example 3). More trades means more costs, and SEBI found frequent traders lost most often." },
    { mistake: "Using full 5x margin", fix: "Size by risk to the stop. Keep margin use under half of what is available." },
    { mistake: "Revenge trading after a loss", fix: "Mandatory break after each loss, and a hard daily loss limit." },
    { mistake: "Letting a loss run hoping it returns", fix: "A stop order at entry, never moved away." },
    { mistake: "Taking profits too soon and losses too late", fix: "Pre-set targets and measure results in R." },
    { mistake: "Trading every stock that moves", fix: "Only liquid stocks from the plan. No plan, no trade." },
    { mistake: "Ignoring costs", fix: "Add charges to every plan and skip tiny targets." },
  ],
  setups: [], tables: [], stages: [], scorecard: [], constitution: [],
  reading: [
    { title: "Trading in the Zone", author: "Mark Douglas", why: "The mindset of probabilities and acting without fear." },
    { title: "The Daily Trading Coach", author: "Brett Steenbarger", why: "Practical psychology and habits for active traders." },
    { title: "Reading Price Charts Bar by Bar", author: "Al Brooks", why: "Price action reading for short-term trading." },
    { title: "Come Into My Trading Room", author: "Alexander Elder", why: "Risk rules, the trading plan and the psychology of loss." },
    { title: "Trade Your Way to Financial Freedom", author: "Van K. Tharp", why: "R-multiples, expectancy and sizing." },
    { title: "Market Wizards", author: "Jack Schwager", why: "Short-term traders on discipline and risk." },
    { title: "SEBI study on intraday traders (July 2024)", author: "SEBI", why: "The evidence on how individual intraday traders actually fare in India." },
  ],
};

{
  const ia = [...INTRADAY.sections, ID_PREMARKET, ID_EXEC, ID_EVENTS, ID_DAY, ID_RISK, ID_SETUPS, ID_COSTS, ID_PSY, ID_STATES];
  INTRADAY.sections = [
    find(ia, "Before you trade at all"), find(ia, "Risk per trade and margin"), find(ia, "Hard limits"), find(ia, "Before the open"), find(ia, "What to trade"), find(ia, "Setup rules"),
    find(ia, "The trading day"), joinSections(find(ia, "Execution"), ID_EXEC, "Execution"), find(ia, "Expiry days"), find(ia, "Costs and margin"), find(ia, "Your state"),
    joinSections(find(ia, "Psychology and discipline"), ID_PSY, "Psychology and discipline"), find(ia, "Review"),
  ];
}

INTRADAY.setups = [
  { name: "Opening range breakout (ORB)", when: "Liquid stock in an uptrend, index steady or rising, price breaks the 15- or 30-minute opening range high on volume.", entry: "Buy-stop just above the opening range high after 9:30 (or 9:45).", stop: "Below the opening range low, or the range midpoint if the range is wide.", target: "1.5R to 2R. Sell half at 1R, trail the rest.", avoid: "A narrow, sleepy open, a stock that gapped far above yesterday's close, or a falling index." },
  { name: "Prior-day high break", when: "The pick closed strong on rising volume yesterday and the market is not weak.", entry: "Buy-stop above yesterday's high (this is the plan the next-session picks use).", stop: "About 0.5 to 1.4% below the entry.", target: "1.5R first, 2.5R for the runner.", avoid: "Opens more than 1% above the entry or below the stop. Skip it." },
  { name: "VWAP pullback", when: "A trending stock that has held above VWAP all morning pulls back to VWAP on low volume.", entry: "Buy when a candle closes back up from VWAP.", stop: "Just under VWAP or the pullback low.", target: "The morning high, then the next resistance.", avoid: "VWAP is flat and price keeps crossing it: that is a range day." },
  { name: "Gap and go vs gap fade", when: "The stock gaps on news. If it holds the gap and the first pullback is shallow on volume it can 'go'; if it quickly falls back into the prior range, it often 'fades'.", entry: "Gap-and-go: buy the break of the first 5- to 15-minute high. Fade: only experienced traders; use small size.", stop: "Below the first pullback low (go) or above the gap high (fade).", target: "1.5R to 2R.", avoid: "Gaps on rumours, on stocks with no volume, or in the first 5 minutes." },
];
INTRADAY.tables = [
  { title: "Daily limits to set before the open", head: ["Limit", "Starting point"], rows: [["Max loss per trade", "0.5% to 1% of the pot"], ["Max loss per day", "2% (3% at most)"], ["Max loss per week", "5%"], ["Max trades per day", "3 to 5"], ["Stop after losses in a row", "3"], ["Positions open at once", "2 to 3"]] },
  { title: "Leverage and what a move costs you", note: "Percent of your own money lost for an adverse price move.", head: ["Price move against you", "At 1x", "At 3x", "At 5x"], rows: [["0.5%", "0.5%", "1.5%", "2.5%"], ["1%", "1%", "3%", "5%"], ["2%", "2%", "6%", "10%"], ["5%", "5%", "15%", "25%"]] },
  { title: "Break-even win rate by reward-to-risk", note: "Before costs. Costs push these up.", head: ["Reward : risk", "Win rate needed"], rows: [["1 : 1", "50%"], ["1.5 : 1", "40%"], ["2 : 1", "33%"], ["3 : 1", "25%"]] },
];
INTRADAY.stages = [
  { stage: "1. Paper, small size", do: "Trade the picks in the Intraday pot for at least 4 weeks, following every rule here and journaling.", passWhen: "50 or more trades, positive result after costs, and you followed the plan on 90% of trades." },
  { stage: "2. Compare with the scorecard", do: "Check whether your results match the picks' own scorecard. Differences show execution mistakes.", passWhen: "Your result is within reach of the scorecard's, and the scorecard itself is positive over 50+ picks." },
  { stage: "3. Real money, tiny size", do: "Use real money at a quarter of the intended risk for another 50 trades.", passWhen: "Same results as paper trading and no daily-loss-limit breaches." },
  { stage: "4. Decide honestly", do: "If expectancy is below zero after costs over 100 trades, stop or change the method. Many people should stop here, and that is a good decision.", passWhen: "Continue only if the numbers keep earning their place." },
];
INTRADAY.scorecard = [
  { metric: "Expectancy (R per trade) after costs", how: "Average result of all trades in R, net of charges", target: "Above +0.15R" },
  { metric: "Profit factor", how: "Gross profit divided by gross loss", target: "Above 1.3" },
  { metric: "Rule-following rate", how: "Trades inside plan and limits", target: "95% or more" },
  { metric: "Trades per day", how: "Average", target: "3 to 5 or fewer" },
  { metric: "Costs share of gross profit", how: "Charges divided by gross profit", target: "Under 30%" },
  { metric: "Worst day and longest losing streak", how: "In % of pot and number of trades", target: "Worst day within your daily limit" },
];

SWING.constitution = [
  "I trade a plan, not a feeling. Entry, stop and target are written before I buy.",
  "I risk no more than 1% of my capital on any trade, and no more than about 6% in total.",
  "My stop is an order in the market. I never move it away.",
  "I take the loss the market gives me. A stop-out is the cost of doing business.",
  "I let winners run with a rule, and I do not let a big winner turn into a loser.",
  "I trade with the trend and the strongest sectors. I do not argue with the market.",
  "I do not add to losers, chase moves, or trade from tips.",
  "I judge myself on following the process, not on any single result.",
  "I keep a journal and review it every week.",
  "I protect my capital first. It is the only thing I cannot trade without.",
];

INTRADAY.constitution = [
  "My own money is at risk. I trade only what I can afford to lose, and I never refill the pot to chase losses.",
  "My daily loss limit is set before the open. When it is hit, I stop.",
  "I risk at most 1% of my own money on a trade, measured to my stop, not to my margin.",
  "I take only planned setups in liquid stocks, and only when reward is at least 1.5 times risk after costs.",
  "Every trade has its stop and target placed with it.",
  "Three losses in a row, or two rule breaks, ends my day.",
  "I do not average down, move a stop away, or take a revenge trade.",
  "I am flat before the 3:15 pm square-off. I do not turn a failed day trade into an investment.",
  "A day with no good setup is a good day.",
  "I tag every mistake in the journal. My goal is clean trades, not big days.",
];

export const BOOKS = [SWING, INTRADAY] as const;
