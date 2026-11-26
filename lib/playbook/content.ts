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
}

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
      title: "1. Choose what to trade",
      rules: [
        { rule: "Trade in the direction of the larger trend: price above rising 50- and 200-day averages, weekly trend up.", why: "Trend followers such as Minervini and O'Neil buy strength in confirmed uptrends, because stocks in uptrends keep going more often than stocks that look 'cheap' in downtrends.", inApp: { label: "Ideas: Minervini trend template", href: "/ideas" } },
        { rule: "Prefer the strongest sectors and the strongest stocks in them.", why: "A good stock in a weak sector has a headwind; leaders in strong sectors tend to lead again.", inApp: { label: "Ideas: sector ranking and Focus list", href: "/ideas" } },
        { rule: "Buy at a sensible point: a pullback to a rising average or a breakout from a tight base, not after a run of 10% or more.", why: "Entry near a support level lets you put the stop close, which improves reward against risk. Chasing makes the stop far and the odds worse." },
        { rule: "Skip illiquid and operator-driven stocks.", why: "Wide spreads and sudden circuit limits can stop you out far from where you planned." },
        { rule: "Check upcoming results dates before you enter. Avoid holding through one unless that is the plan.", why: "An earnings gap can jump straight through your stop; your risk is then larger than you sized for." },
      ],
    },
    {
      title: "2. Plan every trade before you enter",
      rules: [
        { rule: "Write entry, stop-loss and target before buying. Do not enter if you cannot.", why: "A plan made while the price is moving is a plan made by emotion.", inApp: { label: "Ideas gives entry, stop and targets", href: "/ideas" } },
        { rule: "Aim for at least 2 times as much reward as risk (2R). Skip trades below about 1.5R.", why: "With 2R winners you can be wrong more often than right and still profit. At 40% winners and 2R, each trade averages +0.2R before costs." },
        { rule: "Place the stop where the idea is wrong (below support or the recent swing low), not at an amount you can afford.", why: "The market does not know your budget. A stop at a meaningful level is respected more often.", inApp: { label: "Backtest: stops below support or an EMA", href: "/strategies" } },
        { rule: "Use a stop-loss order, not a mental stop.", why: "A mental stop is the first thing to move when the trade goes against you.", inApp: { label: "Order ticket: stop-loss and take-profit on every order", href: "/trade" } },
        { rule: "Never move a stop further away. You may tighten it behind a winner.", why: "Widening a stop turns a small planned loss into a large unplanned one." },
      ],
    },
    {
      title: "3. Position sizing and portfolio risk",
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
      title: "4. Manage the trade",
      rules: [
        { rule: "Take the loss when the stop is hit. Do not re-enter the same stock within a day or two out of anger.", why: "A stop-out is the cost of doing business, not a verdict on you." },
        { rule: "Sell part (a third to a half) at the first target, move the stop to breakeven, and let the rest follow a trailing stop.", why: "It banks a gain, removes the risk of a winner turning into a loser and still leaves room for the rare big winner." },
        { rule: "Exit when the reason for the trade is gone: the trend breaks, or the time limit you set passes with nothing happening.", why: "Dead money has a cost. A time stop frees capital for better ideas.", inApp: { label: "Backtest: time stop and trailing stop", href: "/strategies" } },
        { rule: "Review open trades once a day after the close, not every few minutes during it.", why: "Constant watching turns normal noise into emotional decisions." },
      ],
    },
    {
      title: "5. Process and review",
      rules: [
        { rule: "Keep a journal: reason for entry, plan, result in R, what you did right or wrong.", why: "You cannot improve what you do not measure. Patterns in your mistakes are the best coaching available.", inApp: { label: "Portfolio > Analysis: your trade journal", href: "/portfolio?tab=analysis" } },
        { rule: "Judge your process, not one result. A well-executed trade that lost is a good trade.", why: "Outcomes of single trades are random. Sticking to the rules is what you control." },
        { rule: "Test a method on many stocks and years before using real money. Be suspicious of any result from a handful of trades.", why: "Small samples and over-tuned settings look great in history and fail live.", inApp: { label: "Backtest: groups, out-of-sample and optimizer", href: "/strategies" } },
        { rule: "Do paper trading first, then small real size, then scale up only after dozens of trades follow your rules.", why: "It separates a flawed method from flawed execution at a small cost." },
      ],
    },
    {
      title: "6. India-specific notes",
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
      title: "1. Before you trade at all",
      rules: [
        { rule: "Trade only with money whose loss will not change your life. Use a separate pot and never refill it from savings to chase losses.", why: "Desperation destroys discipline. A separate pot makes the true cost visible.", inApp: { label: "Intraday: its own pot and P&L", href: "/intraday" } },
        { rule: "Paper trade your plan for several weeks. Move to small real size only after the results are positive over 50 or more trades.", why: "Most losers skip this. Paper results show whether the method and your execution work.", inApp: { label: "Intraday scorecard replays every pick", href: "/intraday" } },
        { rule: "Decide your maximum daily loss before the open. When it is hit, stop for the day.", why: "Large losses come from trading after you should have stopped. Common limits: about 3 times the per-trade risk, or 2% to 3% of the pot." },
      ],
    },
    {
      title: "2. Risk per trade and margin",
      rules: [
        { rule: "Risk 0.5% to 1% of your own money per trade, measured from entry to stop, not from the margin amount.", why: "Margin gives size, not safety. Risk is set by the stop.", inApp: { label: "Intraday sizes each pick by risk, not by margin", href: "/intraday" } },
        { rule: "Do not use all your buying power. Keep each position well under the maximum and have no more than 2 or 3 open at once.", why: "Full leverage on one idea means one gap can erase a week of gains." },
        { rule: "Make sure reward is at least 1.5 times risk before entering.", why: "At 1.5R you need to win only about 40% of trades to break even before costs, and costs matter a great deal intraday." },
        { rule: "Count charges and slippage in every plan. Skip trades where the target is too small to pay for them.", why: "Costs were a major driver of losses in SEBI's study. A 0.3% target can be gone after brokerage, taxes and slippage." },
        { rule: "Never average down a losing intraday trade and never remove a stop.", why: "With margin a small adverse move becomes a big loss quickly." },
      ],
    },
    {
      title: "3. What to trade",
      rules: [
        { rule: "Trade liquid stocks only: tight spreads, heavy volume and enough daily range to reach your target.", why: "Illiquid stocks gap through stops and trap you.", inApp: { label: "Intraday picks require high turnover and a workable daily range", href: "/intraday" } },
        { rule: "Trade with the day's direction: strong stocks in strong sectors when the index is steady or rising.", why: "Fighting the trend is the classic beginner's trap." },
        { rule: "Focus on one or two simple setups (breakout above the prior high on volume, or a pullback to the day's average in a trend) and master them.", why: "Specialisation beats variety. You learn what a good version looks like." },
        { rule: "Avoid the first 15 minutes after the open unless you have a specific plan, and be cautious near the close.", why: "Opening prices are erratic and spreads wide; closing moves are often exits by others." },
        { rule: "Do not trade on tips, rumours or social media calls.", why: "You do not know the source's entry, exit or motive." },
      ],
    },
    {
      title: "4. Execution",
      rules: [
        { rule: "Enter with a plan: entry trigger, stop, first target, and a time limit. Place the stop at once.", why: "Delay turns a plan into a guess.", inApp: { label: "Place the pick with SL and TP attached", href: "/intraday" } },
        { rule: "Skip the trade if the stock gaps well beyond the entry or through the stop at the open.", why: "The risk-to-reward you planned no longer exists." },
        { rule: "Take profit at the target. A common approach: sell half at 1R and trail the rest.", why: "Intraday moves reverse fast. Banking gains keeps winners from becoming losers." },
        { rule: "Be flat before the 3:15 pm square-off. Do not carry an intraday trade 'to make it a delivery'.", why: "That converts a failed day trade into an unplanned investment, usually a loser." },
        { rule: "No revenge trades: after a loss, wait, walk away for at least 15 minutes, and check your list.", why: "The next trade after a loss is statistically your worst." },
      ],
    },
    {
      title: "5. Psychology and discipline",
      rules: [
        { rule: "Think in series of trades. Any single trade is a coin toss weighted by your edge; only many trades reveal it.", why: "This is the core idea of Mark Douglas's work: accept uncertainty to act without fear." },
        { rule: "Stop after 3 losses in a row, or when you break a rule twice in a day.", why: "It means conditions or your state are wrong. Stepping back protects the pot." },
        { rule: "Do not trade when tired, angry, hungry, distracted or after bad news in your life.", why: "Decision quality drops sharply. Skipping a day is cheap." },
        { rule: "Treat a day with no good setup as a successful day.", why: "Boredom trades are a leading cause of losses and costs." },
        { rule: "Write down why you entered and how you felt. Review your worst day each week.", why: "Patterns of fear, greed and impatience show up in the notes before they show up in the P&L." },
      ],
    },
    {
      title: "6. Review",
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

export const BOOKS = [SWING, INTRADAY] as const;
