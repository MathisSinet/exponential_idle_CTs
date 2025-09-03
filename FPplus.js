import { CompositeCost, ExponentialCost, FreeCost, LinearCost } from "../api/Costs";
import { Localization } from "../api/Localization";
import { BigNumber } from "../api/BigNumber";
import { theory, QuaternaryEntry } from "../api/Theory";
import { Utils } from "../api/Utils";

var id = "fractal_patterns_plus";
var name = "Fractal Patterns+";
var description =
  "Mod of the official custom theory 'Fractal Patterns'.\n" +
  "This mod allows you to experience post completion FP gameplay and reach divergence.\n" +
  "To help you to reach divergence, new milestones were added. They speedup the theory by a factor of 3 but make s level cap.\n";
  "Can you reach divergence and reach e20,000ρ? It might take you two years, but the journey and the goal are worth it."
var authors = "xlii (original FP developer)\nMathis S. (mod developer)";
var version = 7;
var releaseOrder = "6";

requiresGameVersion("1.4.33");

const e600 = BigNumber.from("1e600");
//const ee4 = BigNumber.from("ee4");
const ee6 = BigNumber.from("ee6");
const I32_MAX = 2**31-1;

var tauMultiplier = 4;

var currency = BigNumber.ZERO;
var quaternaryEntries;
var rhodot = BigNumber.ZERO;
let qdot = BigNumber.ZERO;
let rdot = BigNumber.ZERO;
var q = BigNumber.ONE;
var r = BigNumber.ONE;
var t_cumulative = BigNumber.ZERO;
var pubtime = 0;
var pubtime_actual = 0;
var A = BigNumber.ONE;
var tvar, c1, c2, q1, q2, r1, n1, s;
var snexp, snboost, nboost, fractalTerm, sterm, expterm, speedupMs;
var autoremove_milestones;

var n = 1;
var prevN = 1;
var T_n = BigNumber.ONE;
var S_n = BigNumber.ONE;
var U_n = BigNumber.ONE;

var updateN_flag = true;
var adBoost = BigNumber.ONE;

var instant_rates = 0;
var instant_rates_actual = 0;

var stage = 1;

const speedup_points = [
  2350, 2425, 2500, 2575, 2800, 
  3300, 3400, 3500, 3600, 3900, 
  4600, 4700, 4850, 4950, 5400, 
  6500, 6750];
const scaps = [
  I32_MAX,
  497, 494, 491, 488, 477,
  465, 464, 463, 462, 461,
  380, 378, 376, 360, 354,
  352, 350
]

function formatNumber(number) {
  if (number === BigNumber.ZERO) return "0";
  if (number < 0.001) {
    const l = number.log10().floor();
    return `${number / BigNumber.TEN.pow(l)}\\text{e-${Math.abs(l)}}`;
  }
  return number.toString(3);
}

function formatRates(number) {
  if (number >= 0.001 || number == 0) {
    return number.toPrecision(5);
  }
  else {
    return number.toExponential(4);
  }
}

function formatRho(number) {
  if (number >= ee6 || number < BigNumber.from(1e6)) {
    return number.toString();
  }
  const log10 = number.log10().toNumber();
  const exp = Math.floor(log10);
  const dec = 10**(log10 - exp);
  return `${dec.toPrecision(4)}e${exp}`;
}

function getTimeString(time) {
  let mins = Math.floor(time / 60);
  let secs = time - 60 * mins;
  let hours = Math.floor(mins / 60);
  mins -= hours * 60;
  let days = Math.floor(hours / 24);
  hours -= days * 24;
  let years = Math.floor(days / 365);
  days -= years * 365;

  const days_f = days.toString().padStart(3, "0");
  const hours_f = hours.toString().padStart(2, "0");
  const mins_f = mins.toString().padStart(2, "0");
  const secs_f = secs.toFixed(1).padStart(4, "0");

  if (years > 0) {
    return `${years}y ${days_f}d ${hours_f}h`;
  }
  else if (days > 0) {
    return `${days}d ${hours_f}:${mins_f}`;
  }
  else {
    return `${hours_f}:${mins_f}:${secs_f}`;
  }
}

var init = () => {
  currency = theory.createCurrency();
  quaternaryEntries = [];

  ///////////////////
  // Regular Upgrades
  // tvar
  {
    let getDesc = (level) => "\\dot{t}=" + getTdot(level).toString(1);
    tvar = theory.createUpgrade(0, currency, new ExponentialCost(1e4, Math.log2(1e4)));
    tvar.getDescription = (_) => Utils.getMath(getDesc(tvar.level));
    tvar.getInfo = (amount) => Utils.getMathTo(getDesc(tvar.level), getDesc(tvar.level + amount));
    tvar.maxLevel = 4;
  }
  // c1
  {
    let getDesc = (level) => "c_1=" + getC1(level).toString(0);
    c1 = theory.createUpgrade(1, currency, new FirstFreeCost(new ExponentialCost(10, Math.log2(1.4))));
    c1.getDescription = (_) => Utils.getMath(getDesc(c1.level));
    c1.getInfo = (amount) => Utils.getMathTo(getDesc(c1.level), getDesc(c1.level + amount));
  }

  // c2
  {
    let getDesc = (level) => "c_2=2^{" + level + "}";
    let getInfo = (level) => "c_2=" + getC2(level).toString(0);
    c2 = theory.createUpgrade(2, currency, new CompositeCost(15, new ExponentialCost(1e15, Math.log2(40)), new ExponentialCost(1e37, Math.log2(16.42))));
    c2.getDescription = (_) => Utils.getMath(getDesc(c2.level));
    c2.getInfo = (amount) => Utils.getMathTo(getInfo(c2.level), getInfo(c2.level + amount));
  }
  // q1
  {
    let getDesc = (level) => "q_1=" + formatNumber(getQ1(level));
    let getInfo = (level) => "q_1=" + formatNumber(getQ1(level));
    q1 = theory.createUpgrade(3, currency, new FirstFreeCost(new ExponentialCost(1e35, Math.log2(12))));
    q1.getDescription = (_) => Utils.getMath(getDesc(q1.level));
    q1.getInfo = (amount) => Utils.getMathTo(getInfo(q1.level), getInfo(q1.level + amount));
  }
  // q2
  {
    let getDesc = (level) => "q_2=2^{" + level + "}";
    let getInfo = (level) => "q_2=" + getQ2(level).toString(0);
    q2 = theory.createUpgrade(4, currency, new ExponentialCost(1e76, Math.log2(1e3)));
    q2.getDescription = (_) => Utils.getMath(getDesc(q2.level));
    q2.getInfo = (amount) => Utils.getMathTo(getInfo(q2.level), getInfo(q2.level + amount));
  }
  // r1
  {
    let getDesc = (level) => "r_1=" + formatNumber(getR1(level));
    let getInfo = (level) => "r_1=" + formatNumber(getR1(level));
    r1 = theory.createUpgrade(
      5,
      currency,
      new CompositeCost(285, new FirstFreeCost(new ExponentialCost(1e80, Math.log2(25))), new FirstFreeCost(new ExponentialCost(BigNumber.from("1e480"), Math.log2(150))))
    );
    r1.getDescription = (_) => Utils.getMath(getDesc(r1.level));
    r1.getInfo = (amount) => Utils.getMathTo(getInfo(r1.level), getInfo(r1.level + amount));
  }
  // n
  {
    let getDesc = (level) => "n=" + getN1(level).toString(0);
    let getInfo = (level) => "n=" + getN1(level).toString(0);
    n1 = theory.createUpgrade(6, currency, new ExponentialCost(1e4, Math.log2(3e6)));
    n1.getDescription = (_) => Utils.getMath(getDesc(n1.level));
    n1.getInfo = (amount) => Utils.getMathTo(getInfo(n1.level), getInfo(n1.level + amount));
    n1.bought = (_) => (updateN_flag = true);
  }
  // s
  {
    let getDesc = (level) => "s=" + getS(level).toString(2);
    let getInfo = (level) => "s=" + getS(level).toString(2);
    s = theory.createUpgrade(9, currency, new ExponentialCost(BigNumber.from("1e730"), Math.log2(1e30)));
    s.getDescription = (_) => Utils.getMath(getDesc(s.level));
    s.getInfo = (amount) => Utils.getMathTo(getInfo(s.level), getInfo(s.level + amount));
    s.bought = (_) => {
      updateN_flag = true;
      updateAvailability();
    };
  }

  /////////////////////
  // Permanent Upgrades
  theory.createPublicationUpgrade(0, currency, 0);
  theory.createBuyAllUpgrade(1, currency, 0);
  theory.createAutoBuyerUpgrade(2, currency, 0);
  {
    autoremove_milestones = theory.createPermanentUpgrade(3, currency, new FreeCost);
    autoremove_milestones.getDescription = (_) => `Autoremove speedup milestones: ${autoremove_milestones.level ? 'ON' : 'OFF'}`;
    autoremove_milestones.getInfo = (_) => `Automatically remove speedup milestones if the next $s$ after the cap is affordable`;
    autoremove_milestones.boughtOrRefunded = (_) => autoremove_milestones.level %= 2;
  }

  ///////////////////////
  //// Milestone Upgrades
  theory.setMilestoneCost(new CustomCost((total) => BigNumber.from(tauMultiplier*getMilCustomCost(total))));
  function getMilCustomCost(lvl) {
    const unlocks = [Math.log10(5e22), 95, 175, 300, 385, 420, 550, 600, 700, 1500].concat(speedup_points);
    return unlocks[Math.min(lvl, unlocks.length - 1)] * 0.075;
  }
  {
    fractalTerm = theory.createMilestoneUpgrade(0, 2);
    fractalTerm.getDescription = (_) => {
      if (fractalTerm.level === 0) {
        return "Add the Ulam-Warburton fractal";
      }
      return "Add the Sierpinski Triangle fractal";
    };
    fractalTerm.getInfo = (_) => {
      if (fractalTerm.level === 0) {
        return "Add the Ulam-Warburton fractal";
      }
      return "Add the Sierpinski Triangle fractal";
    };
    fractalTerm.boughtOrRefunded = (_) => {
      theory.invalidatePrimaryEquation();
      theory.invalidateTertiaryEquation();
      updateAvailability();
      quaternaryEntries = [];
    };
    fractalTerm.canBeRefunded = () => nboost.level === 0;
  }
  {
    nboost = theory.createMilestoneUpgrade(2, 2);
    nboost.getDescription = (_) => "Improve n variable scaling";

    nboost.getInfo = (_) => "Improve n variable scaling";

    nboost.boughtOrRefunded = (_) => {
      theory.invalidatePrimaryEquation();
      theory.invalidateSecondaryEquation();
      theory.invalidateTertiaryEquation();
      updateAvailability();
      updateN_flag = true;
    };
    nboost.canBeRefunded = (_) => snexp.level === 0;
  }
  {
    snexp = theory.createMilestoneUpgrade(1, 3);
    snexp.description = Localization.getUpgradeIncCustomExpDesc("S_n", "0.6");
    snexp.info = Localization.getUpgradeIncCustomExpInfo("S_n", "0.6");
    snexp.boughtOrRefunded = (_) => {
      updateAvailability();
      theory.invalidatePrimaryEquation();
    };
    snexp.canBeRefunded = () => snboost.level === 0;
  }
  {
    snboost = theory.createMilestoneUpgrade(3, 1);
    snboost.getDescription = (_) => "$S_n$ returns total amount of triangles";
    snboost.getInfo = (_) => "Count all triangles in the sierpinsky triangle";
    snboost.boughtOrRefunded = (_) => theory.invalidatePrimaryEquation();
    snboost.boughtOrRefunded = (_) => {
      S_n = S(Math.floor(Math.sqrt(n)));
      theory.invalidatePrimaryEquation();
      updateAvailability();
    };
    snboost.canBeRefunded = (_) => sterm.level === 0;
  }
  {
    sterm = theory.createMilestoneUpgrade(4, 1);
    sterm.getDescription = () => "$\\text{Add the term }s\\;\\;\\&\\;\\downarrow T_n\\text{exponent by 2}$";
    sterm.getInfo = () => "$\\text{Add the term }s\\;\\;\\&\\;\\downarrow T_n\\text{exponent by 2}$";
    sterm.boughtOrRefunded = (_) => {
      updateAvailability();
      theory.invalidatePrimaryEquation();
    };
    sterm.canBeRefunded = (_) => expterm.level === 0;
  }
  {
    expterm = theory.createMilestoneUpgrade(5, 1);
    expterm.getDescription = () => "$\\text{Improve } \\dot{r} \\text{ equation}$";
    expterm.getInfo = () => `$\\dot{r} = r_1(T_nU_n)^{\\log(\\sqrt{2U_n})}S_{\\lfloor \\sqrt{n} \\rfloor}^{${snexp.level > 0 ? getsnexp(snexp.level).toString(1) : ""}}$`;
    expterm.boughtOrRefunded = (_) => {
      updateAvailability();
      theory.invalidatePrimaryEquation();
    };
  }
  {
    speedupMs = theory.createMilestoneUpgrade(6, 17);
    speedupMs.getDescription = () => 
      `Speedup the theory by $\\times 3$ but decreases $s$ level cap to $${scaps[Math.min(speedupMs.level + 1, 17)]}$`
    speedupMs.boughtOrRefunded = (_) => {
      updateAvailability();
      theory.invalidatePrimaryEquation();
      theory.invalidateSecondaryEquation();
    }
  }

  updateAvailability();
};

function T(n) {
  if (n === 0) return 0;
  if (n > 100000) return BigNumber.from(U_n / 2); // this is to ensure statement limit doesn't screw us up
  let log2N = Math.log2(n);
  if (log2N % 1 === 0) return (2 ** (2 * log2N + 1) + 1) / 3;
  let i = n - 2 ** Math.floor(log2N);
  return (2 ** (2 * Math.floor(log2N) + 1) + 1) / 3 + 2 * T(i) + T(i + 1) - 1;
}
// U(n) calculation helper
// V(n) calculation is O(log n)
// U(n) can be found applying an affine transformation to V(n)
function V(n) {
  if (n === 0) return 0;
  const log2N = Math.log2(n);
  if (log2N % 1 === 0) return 2 ** (2 * log2N);
  const i = n - 2 ** Math.floor(log2N);
  return 2 ** (2 * Math.floor(log2N)) + 3 * this.V(i);
}
function U(n) {
  return (4/3)*V(n) - (1/3);
}
function S(n) {
  if (n === 0) return BigNumber.ZERO;
  if (snboost.level === 0) return BigNumber.THREE.pow(n - 1);
  return BigNumber.from(1 / 3) * (BigNumber.TWO * BigNumber.THREE.pow(n) - BigNumber.THREE);
}
function approx(n) {
  n++;
  return BigNumber.from(1 / 6) * (BigNumber.TWO.pow(2 * n) + BigNumber.TWO);
}

function updateN() {
  U_n = BigNumber.from(U(n));
  T_n = BigNumber.from(T(n));
  S_n = S(Math.floor(Math.sqrt(n)));
}

var updateAvailability = () => {
  q1.isAvailable = fractalTerm.level > 0;
  q2.isAvailable = fractalTerm.level > 0;
  r1.isAvailable = fractalTerm.level > 1;
  s.isAvailable = sterm.level > 0;
  snexp.isAvailable = nboost.level === 2;
  nboost.isAvailable = fractalTerm.level === 2;
  snboost.isAvailable = snexp.level === 3;
  sterm.isAvailable = snboost.level === 1;
  expterm.isAvailable = sterm.level === 1;
  speedupMs.isAvailable = expterm.level === 1;

  s.maxLevel = scaps[speedupMs.level];
  let max_speedup_milestones = 17;
  while (s.level > scaps[max_speedup_milestones]) max_speedup_milestones--;
  speedupMs.level = Math.min(speedupMs.level, max_speedup_milestones);
  speedupMs.maxLevel = max_speedup_milestones;
  speedupMs.isAvailable = speedupMs.isAvailable && speedupMs.maxLevel > 0;
};

var tick = (elapsedTime, multiplier) => {
  const speedup = getspeedup(speedupMs.level);
  multiplier = BigNumber.from(multiplier) * speedup;
  const dt = BigNumber.from(elapsedTime * multiplier);
  const bonus = theory.publicationMultiplier;
  adBoost = multiplier;

  if (c1.level === 0) return;
  if (updateN_flag) {
    prevN = n;
    //n is clamped at 20000 because of computation reasons. takes ~40k days to reach (XLII)
    // You need better algorithms :P
    n = getN1(n1.level);
    updateN();
    updateN_flag = false;
    theory.invalidateTertiaryEquation();
  }
  t_cumulative += getTdot(tvar.level) * dt;
  pubtime += elapsedTime;
  pubtime_actual += elapsedTime * speedup.toNumber();

  A = fractalTerm.level > 0 ? approx(q2.level) : 1;

  qdot = (getQ1(q1.level) * A * U_n.pow(7 + (sterm.level > 0 ? getS(s.level).toNumber() : 0))) / BigNumber.THOUSAND;
  q += fractalTerm.level > 0 ? qdot * dt : 0;

  if (expterm.level === 0) rdot = getR1(r1.level) * (T_n * U_n).pow(BigNumber.from(Math.log10(n))) * S_n ** getsnexp(snexp.level);
  else rdot = getR1(r1.level) * (T_n * U_n).pow(Math.log10(U_n * 2) / 2) * S_n.pow(getsnexp(snexp.level));

  r += fractalTerm.level > 1 ? rdot * dt : 0;

  rhodot = bonus * getC1(c1.level) * getC2(c2.level) * T_n.pow(7 + (sterm.level > 0 ? getS(s.level).toNumber() - 2 : 0)) * t_cumulative;
  rhodot *= fractalTerm.level > 0 ? q : BigNumber.ONE;
  rhodot *= fractalTerm.level > 1 ? r : BigNumber.ONE;

  const prev_tau = getTau();
  currency.value += rhodot * dt;
  const new_tau = getTau();

  instant_rates = ((new_tau.log10() - prev_tau.log10()) / (elapsedTime / 3600)).toNumber();
  instant_rates_actual = ((new_tau.log10() - prev_tau.log10()) / (elapsedTime * speedup.toNumber() / 3600)).toNumber();

  if (autoremove_milestones.level == 1
    && speedupMs.level > 0
    && s.level == scaps[speedupMs.level] 
    && currency.value * BigNumber.from(1.001) > s.cost.getCost(s.level + 1)) {
      speedupMs.level--;
      updateAvailability();
    }
  if (stage >= 2) theory.invalidatePrimaryEquation();
  if (stage >= 2) theory.invalidateSecondaryEquation();
  theory.invalidateTertiaryEquation();
  theory.invalidateQuaternaryValues();
};

var postPublish = () => {
  q = BigNumber.ONE;
  r = BigNumber.ONE;
  rhodot = BigNumber.ZERO;
  qdot = BigNumber.ZERO;
  rdot = BigNumber.ZERO;
  t_cumulative = BigNumber.ZERO;
  pubtime = 0;
  pubtime_actual = 0;
  prevN = 1;
  n = 1;
  U_n = BigNumber.ONE;
  T_n = BigNumber.ONE;
  S_n = BigNumber.ONE;
  //maxUDN = BigNumber.ONE; // WTF is this
  updateN_flag = true;
  A = BigNumber.ONE;
  theory.invalidateTertiaryEquation();
  theory.invalidateQuaternaryValues();
  updateAvailability();
};
var getInternalState = () => `${q} ${r} ${t_cumulative} ${pubtime} ${pubtime_actual}`;

var setInternalState = (state) => {
  let values = state.split(" ");
  if (values.length > 0) q = parseBigNumber(values[0]);
  if (values.length > 1) r = parseBigNumber(values[1]);
  if (values.length > 2) t_cumulative = parseBigNumber(values[2]);
  if (values.length > 3) pubtime = parseFloat(values[3]);
  if (values.length > 4) pubtime_actual = parseFloat(values[4]);

  updateN_flag = true;
};

var getPrimaryEquation = () => {
  switch (stage) {
    case 0: {
      theory.primaryEquationHeight = 150;
      theory.primaryEquationScale = 0.65;
      let result = "T_{2^k+i}=\\begin{cases}\\frac{2^{2k+1}+1}{3},  & \\text{if } i = 0,  \\\\ T_{2^k}+2T_i + T_{i+1}-1, & \\text{if } 1 < i \\leq 2^k \\end{cases}\\\\";
      if (fractalTerm.level > 0) {
        result += "u_0 = 0,\\ u_1 = 1,\\ \\dots,\\ u_n=4(3^{w_{n-1}-1})\\\\";
        result += "w_n = n-\\sum_{k=1}^{\\infty}\\left\\lfloor\\frac{n}{2^k}\\right\\rfloor \\\\";
        result += "U_n = \\sum_{i=0}^n u_i";
      }
      if (fractalTerm.level > 1) result += snboost.level === 0 ? ", \\qquad S_n = 3^{n-1}" : ", \\qquad S_n = \\frac{1}{2}(3^n-1)";
      return result;
    }
    case 1: {
      theory.primaryEquationHeight = fractalTerm.level === 0 ? 60 : 110;
      theory.primaryEquationScale = fractalTerm.level === 0 ? 1.2 : 0.97;
      let result = `\\dot{\\rho} = c_1c_2`;
      if (fractalTerm.level > 0) result += "q" + (fractalTerm.level > 1 ? "r" : "");
      result += "t";
      result += `T_n^{${7 - (sterm.level === 0 ? 0 : 2) + (sterm.level > 0 ? "+s" : "")}}`;
      if (fractalTerm.level > 0) result += `\\\\\\\\ \\dot{q} = q_1AU_n^{7${sterm.level > 0 ? "+s" : ""}}/1000`;
      if (fractalTerm.level > 1) {
        if (expterm.level === 0) result += `\\\\\\\\ \\dot{r} = r_1(T_nU_n)^{\\log(n)}S_{\\lfloor \\sqrt{n} \\rfloor}^{${snexp.level > 0 ? getsnexp(snexp.level).toString(1) : ""}}`;
        else result += `\\\\\\\\ \\dot{r} = r_1(T_nU_n)^{\\log(\\sqrt{2U_n})}S_{\\lfloor \\sqrt{n} \\rfloor}`;
      }
      return result;
    }
    case 2: {
      theory.primaryEquationHeight = 65;
      theory.primaryEquationScale = 0.9;
      let result = ``;
      result += `\\text{Current speed multiplier:} ${getspeedup(speedupMs.level)}\\\\`;
      result += `\\text{Publication time: ${getTimeString(pubtime)}} \\\\`;
      result += `\\text{Publication time (actual): ${getTimeString(pubtime_actual)}}`;
      return result;
    }
    case 3: {
      theory.primaryEquationHeight = 65;
      theory.primaryEquationScale = 0.9;
      let result = ``;
      result += `\\rho = ${formatRho(currency.value)}\\\\`;
      result += `\\dot{\\rho} = ${formatRho(rhodot * adBoost)}\\\\`;
      if (theory.canPublish) {
        result += `\\max{\\rho} = ${formatRho(getCurrencyFromTau(theory.tau)[0])}`;
      }
      return result;
    }
  }
  return "";
};

var getSecondaryEquation = () => {
  if (stage === 0) return "";
  switch (stage) {
    case 0: return "";
    case 1: {
      theory.secondaryEquationHeight = 50;
      theory.secondaryEquationScale = 1;
      let result = "\\begin{matrix}";
      if (fractalTerm.level > 0) result += `A = (2-U_{q_2}/T_{q_2})^{-1} \\qquad `;
      result += "\\\\ {}\\end{matrix}";
      return result;
    }
    case 2: {
      if (theory.tauPublished < BigNumber.ONE) return "";
      theory.secondaryEquationHeight = 120;
      theory.secondaryEquationScale = 0.95;
      let result = "";
      const dws = `\\,\\,`;
      const th_cumulative = formatRates(((theory.tau.log10() - theory.tauPublished.log10()) / (pubtime / 3600)).toNumber());
      const th_cumulative_actual = formatRates(((theory.tau.log10() - theory.tauPublished.log10()) / (pubtime_actual / 3600)).toNumber());
      const rates_str = `\\tau/\\text{hr}${dws}\\text{rates}`;
      result += `\\text{Cumulative}${dws}${rates_str}:\\\\`;
      result += `\\text{Current:}${th_cumulative}\\\\`;
      result += `\\text{Actual:}${th_cumulative_actual}\\\\`;
      result += `\\text{Instant}${dws}${rates_str}:\\\\`;
      result += `\\text{Current:}${formatRates(instant_rates)}\\\\`;
      result += `\\text{Actual:}${formatRates(instant_rates_actual)}\\\\`;
      return result;
    }
    case 3: {
      theory.secondaryEquationHeight = 150;
      theory.secondaryEquationScale = 0.95;
      let result = ``;
      const formatCost = (upg, cost) => `${upg}\\,\\,\\text{cost}\\,=${formatRho(cost)}\\\\`;
      const getCost = (upg) => upg.cost.getCost(upg.level);
      result += formatCost("c_1", getCost(c1));
      result += formatCost("c_2", getCost(c2));
      result += formatCost("q_1", getCost(q1));
      result += formatCost("q_2", getCost(q2));
      result += formatCost("r_1", getCost(r1));
      result += formatCost("n", getCost(n1));
      result += formatCost("s", getCost(s));
      return result;
    }
  }
  return "";
};
var getTertiaryEquation = () => {
  let result = "\\begin{matrix}";
  if (stage === 0) {
    result += "T_n=" + T_n.toString(0);
    if (fractalTerm.level > 0) result += ",&U_n=" + U_n.toString(0);
    if (fractalTerm.level > 1) result += "\\\\\\\\ S_{\\lfloor \\sqrt{n} \\rfloor}=" + S_n.toString(0);
  } else {
    result += theory.latexSymbol + "=\\max\\rho^{0.3}";
  }
  result += "\\\\ {}\\end{matrix}";
  return result;
};
var getQuaternaryEntries = () => {
  // log(JSON.stringify(quaternaryEntries))
  if (stage >= 2) return quaternaryEntries;
  if (quaternaryEntries.length == 0) {
    quaternaryEntries.push(new QuaternaryEntry(null, ''));
    quaternaryEntries.push(new QuaternaryEntry("n", null));
    if (stage === 0) {
      if (fractalTerm.level > 0) quaternaryEntries.push(new QuaternaryEntry("\\dot{q}_{{}\\,}", null));
      if (fractalTerm.level > 1) quaternaryEntries.push(new QuaternaryEntry("\\dot{r}_{{}\\,}", null));
      quaternaryEntries.push(new QuaternaryEntry("\\dot{\\rho}_{{}\\,}", null));
    } else {
      quaternaryEntries.push(new QuaternaryEntry("t_{{}\\,}", null));
      if (fractalTerm.level > 0) quaternaryEntries.push(new QuaternaryEntry("q", null));
      if (fractalTerm.level > 1) quaternaryEntries.push(new QuaternaryEntry("r", null));
      if (fractalTerm.level > 0) quaternaryEntries.push(new QuaternaryEntry("A_{{}\\,}", null));
    }
    quaternaryEntries.push(new QuaternaryEntry(null, ''));
  }

  quaternaryEntries[1].value = BigNumber.from(n).toString(0);
  if (stage === 0) {
    if (fractalTerm.level > 0) quaternaryEntries[2].value = (adBoost * qdot).toString(3);
    if (fractalTerm.level > 1) quaternaryEntries[3].value = (adBoost * rdot).toString(3);
    quaternaryEntries[fractalTerm.level + 2].value = (adBoost * rhodot).toString(3, 5);
  } else {
    quaternaryEntries[2].value = t_cumulative.toString(2);
    if (fractalTerm.level > 0) quaternaryEntries[3].value = q.toString(2);
    if (fractalTerm.level > 1) quaternaryEntries[4].value = r.toString(2);
    if (fractalTerm.level > 0) quaternaryEntries[fractalTerm.level > 1 ? 5 : 4].value = A.toString(2);
  }

  return quaternaryEntries;
};
var canGoToPreviousStage = () => stage > 0;
var goToPreviousStage = () => {
  stage--;
  theory.invalidatePrimaryEquation();
  theory.invalidateSecondaryEquation();
  theory.invalidateTertiaryEquation();
  quaternaryEntries = [];
  theory.invalidateQuaternaryValues();
};
var canGoToNextStage = () => stage < 3;
var goToNextStage = () => {
  stage++;
  theory.invalidatePrimaryEquation();
  theory.invalidateSecondaryEquation();
  theory.invalidateTertiaryEquation();
  quaternaryEntries = [];
  theory.invalidateQuaternaryValues();
};

var getPublicationMultiplier = (tau) => (tau.pow(1.324/tauMultiplier) * BigNumber.FIVE).max(BigNumber.ONE);
var getPublicationMultiplierFormula = (symbol) => "5" + symbol + "^{0.331}";
var getTau = () => currency.value.pow(0.075*tauMultiplier).max(e600)
var getCurrencyFromTau = (tau) => [tau.max(BigNumber.ONE).pow(1 / (0.075*tauMultiplier)), currency.symbol];
var get2DGraphValue = () => currency.value.sign * (BigNumber.ONE + currency.value.abs()).log10().toNumber();

let stepwiseSum = (level, base, length) => {
  if (level <= length) return level;
  level -= length;
  let cycles = Math.floor(level / length);
  let mod = level - cycles * length;
  return base * (cycles + 1) * ((length * cycles) / 2 + mod) + length + level;
};

var getTdot = (level) => BigNumber.from(0.2 + level / 5);
var getC1 = (level) => Utils.getStepwisePowerSum(level, 150, 100, 0);
var getC2 = (level) => BigNumber.TWO.pow(level);
var getQ1 = (level) => (level === 0 ? BigNumber.ZERO : Utils.getStepwisePowerSum(level, 10, 10, 0) / BigNumber.from(1 + 1000 / level ** 1.5));
var getQ2 = (level) => BigNumber.TWO.pow(level);
var getR1 = (level) => (level === 0 ? BigNumber.ZERO : Utils.getStepwisePowerSum(level, 2, 5, 0) / BigNumber.from(1 + 1e9 / level ** 4));
var getN1 = (level) => {
  const term2 = nboost.level > 0 ? Math.floor(stepwiseSum(Math.max(0, level - 30), 1, 35) * 2) : 0;
  const term3 = nboost.level > 1 ? Math.floor(stepwiseSum(Math.max(0, level - 69), 1, 30) * 2.4) : 0;
  return BigNumber.from(1 + stepwiseSum(level, 1, 40) + term2 + term3);
};
var getS = (level) => {
  let cutoffs = [32, 39];
  if (level < cutoffs[0]) return BigNumber.from(1 + level * 0.15);
  if (level < cutoffs[1]) return BigNumber.from(getS(cutoffs[0] - 1) + 0.15 + (level - cutoffs[0]) * 0.2);
  return BigNumber.from(getS(cutoffs[1] - 1) + 0.2 + (level - cutoffs[1]) * 0.15);
};
var getsnexp = (level) => BigNumber.from(1 + level * 0.6);
var getspeedup = (level) => BigNumber.THREE.pow(level);

init();
