// NSE regular session: Mon-Fri 09:15-15:30 IST (exchange holidays not yet modelled).
export function istParts(d = new Date()) {
  const ist = new Date(d.getTime() + (5.5 * 60 + d.getTimezoneOffset()) * 60000);
  return { day: ist.getDay(), minutes: ist.getHours() * 60 + ist.getMinutes(), text: ist.toTimeString().slice(0, 8) };
}

export function isMarketOpen(d = new Date()) {
  const { day, minutes } = istParts(d);
  return day >= 1 && day <= 5 && minutes >= 9 * 60 + 15 && minutes < 15 * 60 + 30;
}
