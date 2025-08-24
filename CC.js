import { BigNumber } from '../api/BigNumber';
import { CompositeCost, ExponentialCost, FirstFreeCost, FreeCost, LinearCost, CustomCost } from '../api/Costs';
import { Localization } from '../api/Localization';
import { Theme } from '../api/Settings';
import { theory } from '../api/Theory';
import { ui } from '../api/ui/UI';
import { Color } from '../api/ui/properties/Color';
import { Utils } from '../api/Utils';
import { LayoutOptions } from '../api/ui/properties/LayoutOptions';
import { ImageSource } from '../api/ui/properties/ImageSource';
import { Aspect } from '../api/ui/properties/Aspect';
import { TouchType } from '../api/ui/properties/TouchType';
import { Thickness } from '../api/ui/properties/Thickness';
import { Easing } from '../api/ui/properties/Easing';
import { ScrollOrientation } from '../api/ui/properties/ScrollOrientation';
import { TextAlignment } from '../api/ui/properties/TextAlignment';
import { log } from 'winjs';

var id = 'collatz_conjecture_new';
var getName = (language) =>
{
    let names =
    {
        en: 'Collatz Conjecture',
    };

    return names[language] || names.en;
}
var getDescription = (language) =>
{
    let descs =
    {
        en:
`Reboot of prop's Collatz Conjecture CT project.`,
    };

    return descs[language] || descs.en;
}

var authors = 
'd4Nf6Bg51-0 (ideas & structuring)\n'+
'Mathis S. (new developer)\n' +
'propfeds (original developer)\n'+
'\nThanks to:\nCipher#9599, the original suggester\n' +
'XLII (contributor to the original version)';
var version = 0.11;

/*
    Constants
*/

const ZERO = BigNumber.ZERO;
const ONE = BigNumber.ONE;

/*
    Utils
*/

let bigNumArray = (array) => array.map(x => BigNumber.from(x));

/*
    Variables
*/

var stage = 1;

let t = 0;
let ctimer = 0;

let c = 1n;
let cBigNum = BigNumber.from(c);
let c0 = 1n;
let c0BigNum = BigNumber.from(c0);

let c1 = 1n;
let c1BigNum = BigNumber.from(c1);
let c1cycle = false;

let T = ONE;
let S = ONE;
let M = ONE;

let T1 = 0;
let S1 = ONE;
let M1 = ONE;

/*
    Main balance parameters
*/
const tauRate = 0.04;
const pubExp = 25 * 0.2;
var getPublicationMultiplier = (tau) => tau.pow(pubExp);
var getPublicationMultiplierFormula = (symbol) =>
`{${symbol}}^{${pubExp}}`;

var getTau = () => currency.value.pow(tauRate);

var getCurrencyFromTau = (tau) =>
[
    tau.max(BigNumber.ONE).pow(BigNumber.ONE / tauRate),
    currency.symbol
];

/*
    Upgrades
*/
var q1, q2, c1upg;

const q1Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.22)));
const getq1 = (level) => Utils.getStepwisePowerSum(level, 2, 8, 0);

const q2Cost = new ExponentialCost(1e4, Math.log2(8));
const getq2 = (level) => BigNumber.TWO.pow(level);

const c1Cost = new ExponentialCost(BigNumber.from("1e300"), 30*Math.log2(10));
const getc1 = (level) => BigNumber.TWO.pow(level+1) - ONE;
const getc1bigint = (level) => (1n << BigInt(level+1)) - 1n;

/*
    Perma upgrades
*/
const permaCosts = bigNumArray([
    '1e15', // pub unlock
    '1e75', // buy all button
    '1e100' // autobuyer
]);

/*
    Milestones
*/
var cooldownMs, terminateEarlyMs, c0SkipMs, c1Ms;

const milestoneCosts = [
    125, 150, 175, // cooldown ms
    225, // c < c0 ms
    250, 275, // c0 skip ms
    300 // stage 2 start, c1 ms
].map((rho) => BigNumber.from(rho * tauRate));

const milestoneCost = new CustomCost((level) =>
{
    if (level < milestoneCosts.length) return milestoneCosts[level];
    return BigNumber.from(-1);
});

const cooldown = [40, 20, 10, 5];

/*
    Main functions
*/

var init = () => {
    currency = theory.createCurrency();

    /*
        Upgrades
    */

    /* q1
    Non-standard (2, 8) stepwise power.
    */
    {
        let getDesc = (level) => `q_1=${getq1(level).toString(0)}`;
        let getInfo = (level) => getDesc(level);
        q1 = theory.createUpgrade(1, currency, q1Cost);
        q1.getDescription = (_) => Utils.getMath(getDesc(q1.level));
        q1.getInfo = (amount) => Utils.getMathTo(getInfo(q1.level), getInfo(q1.level + amount));
    }
    /* q2
    Standard doubling upgrade.
    */
    {
        let getDesc = (level) => `q_2=2^{${level}}`;
        let getInfo = (level) => `q_2=${getq2(level).toString(0)}`;
        q2 = theory.createUpgrade(2, currency, q2Cost);
        q2.getDescription = (_) => Utils.getMath(getDesc(q2.level));
        q2.getInfo = (amount) => Utils.getMathTo(getInfo(q2.level), getInfo(q2.level + amount));
    }

    /* c1
    */
    {
        let getDesc = (level) => `c_1=2^{${level+1}} - 1`;
        let getInfo = (level) => `c_1=${getc1(level).toString(0)}`;
        c1upg = theory.createUpgrade(3, currency, c1Cost);
        c1upg.getDescription = (_) => Utils.getMath(getDesc(c1upg.level));
        c1upg.getInfo = (amount) => Utils.getMathTo(getInfo(c1upg.level), getInfo(c1upg.level + amount));
        c1upg.boughtOrRefunded = (_) => {
            theory.invalidateSecondaryEquation();
            c1 = getc1bigint(c1upg.level);
            c1BigNum = BigNumber.from(c1);
            c1cycle = false;
            T1 = 0;
            S1 = c1BigNum;
            M1 = c1BigNum;
        }
        c1upg.level = 1;
    }

    /*
        Permanent Upgrades
    */

    theory.createPublicationUpgrade(0, currency, permaCosts[0]);
    theory.createBuyAllUpgrade(1, currency, permaCosts[1]);
    theory.createAutoBuyerUpgrade(2, currency, permaCosts[2]);

    /*
        Milestones
    */

    theory.setMilestoneCost(milestoneCost);

    /* Interval speed-up
    */
    {
        cooldownMs = theory.createMilestoneUpgrade(0, cooldown.length - 1);
        cooldownMs.getDescription = (amount) =>
        {
            return `${Localization.getUpgradeDecCustomDesc("\\text{c update interval}", 
                cooldown[cooldownMs.level] - cooldown[cooldownMs.level + amount] ||
            0)} ticks`
        };
        cooldownMs.getInfo = (amount) =>
        {
            return Localization.getUpgradeDecCustomInfo("\\text{the interval between c updates}", 
                cooldown[cooldownMs.level] - cooldown[cooldownMs.level + amount] ||
            0)
        }
        cooldownMs.boughtOrRefunded = (_) =>
        {
            updateAvailability();
        };
        cooldownMs.canBeRefunded = (amount) => terminateEarlyMs.level == 0;
    }

    /* Finish cycle if c < c0
    */
    {
        terminateEarlyMs = theory.createMilestoneUpgrade(1, 1);
        terminateEarlyMs.getDescription = () => "Reset $c$ if $c$ < $c_0$";
        terminateEarlyMs.getInfo = () => "Set $c$ to $c_0$ and increase $c_0$ if $c$ falls below $c_0$";
        terminateEarlyMs.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            updateAvailability();
        }
        terminateEarlyMs.canBeRefunded = () => c0SkipMs.level == 0;
    }

    /* Skips some values of c0
    */
    {
        c0SkipMs = theory.createMilestoneUpgrade(2, 2);
        c0SkipMs.getDescription = () => c0SkipMs.level == 0
            ? "$c_0$ skips even numbers"
            : "$c_0$ only lands on numbers $\\equiv 3\\text{ (mod 4)}$";
        c0SkipMs.boughtOrRefunded = (_) => {
            theory.invalidatePrimaryEquation();
            updateAvailability();
        }
        c0SkipMs.canBeRefunded = () => c1Ms.level == 0;
    }

    /* Unlocks c1
    */
    {
        c1Ms = theory.createMilestoneUpgrade(11, 1);
        c1Ms.getDescription = () => Localization.getUpgradeUnlockDesc("c_1");
        c1Ms.getInfo = () => Localization.getUpgradeUnlockInfo("c_1");
        c1Ms.boughtOrRefunded = (_) => {
            theory.invalidateTertiaryEquation();
            updateAvailability();
        }
        c1Ms.refunded = (_) => stage = 1;
    }

    updateAvailability();
}

var updateAvailability = () => {
    terminateEarlyMs.isAvailable = cooldownMs.level == cooldown.length - 1;
    c0SkipMs.isAvailable = terminateEarlyMs.level == 1;
    c1Ms.isAvailable = c0SkipMs.level == 2;

    c1upg.isAvailable = c1Ms.level == 1;
}


var tick = (elapsedTime, multiplier) => {
    if (!q1.level) return;

    ctimer += elapsedTime * 10;
    let turned = false;
    while(ctimer + 1e-8 >= cooldown[cooldownMs.level])
    {
        t++;
        turned = true;
        ctimer -= cooldown[cooldownMs.level];
        cIterProgBar.progressTo(0, 33, Easing.LINEAR);

        if (c1 == 1n) {
            c1cycle = true;
            c1 = getc1bigint(c1upg.level);
            c1BigNum = BigNumber.from(c1);
        }
        else {
            if(c1 % 2n != 0)
                c1 = 3n * c1 + 1n;
            else
                c1 /= 2n;
            c1BigNum = BigNumber.from(c1);
            if (!c1cycle) T1++;
            S1 += c1BigNum;
            M1 = M1.max(c1BigNum);
        }

        if (c == 1n || (terminateEarlyMs.level == 1 && c < c0)) {
            switch (c0SkipMs.level) {
                case 1:
                    c0 += 1n + (c0 % 2n); break;
                case 2:
                    c0 += (c0 % 4n) == 3n ? 4n : 3n - (c0 % 4n); break;
                default:
                    c0 += 1n; break;
            }
            c = c0;
            cBigNum = BigNumber.from(c);
            c0BigNum = BigNumber.from(c0);
        }
        else {
            if(c % 2n != 0)
                c = 3n * c + 1n;
            else
                c /= 2n;
            cBigNum = BigNumber.from(c);
        }

        theory.invalidateSecondaryEquation();
    }
    if(!turned)
        cIterProgBar.progressTo(Math.min(1,
            (ctimer / (cooldown[cooldownMs.level] - 1))), 95,
        Easing.LINEAR);

    const dt = BigNumber.from(elapsedTime * multiplier);
    const bonus = theory.publicationMultiplier;

    const vq1 = getq1(q1.level);
    const vq2 = getq2(q2.level);

    T += T1 * dt;
    S += S1 * dt;
    M += M1 * dt;

    const rhodot = bonus * vq1 * vq2 * t * T * S * M * c0BigNum;

    currency.value += rhodot * dt;
    
    theory.invalidateTertiaryEquation();
}

var postPublish = () => {
    t = 0;
    ctimer = 0;
    c = c0;
    cBigNum = BigNumber.from(c);

    c1 = 1n;
    c1BigNum = BigNumber.from(c1);
    c1cycle = false;
    T = ONE;
    S = ONE;
    M = ONE;
    T1 = 0;
    S1 = ONE;
    M1 = ONE;

    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
}

var getInternalState = () => JSON.stringify
({
    t,
    c: c.toString(),
    c0: c0.toString(),
    ctimer,

    c1: c1.toString(),
    c1cycle,

    T: T.toBase64String(),
    S: S.toBase64String(),
    M: M.toBase64String(),

    T1,
    S1: S1.toBase64String(),
    M1: M1.toBase64String()
})

var setInternalState = (stateStr) =>
{
    if(!stateStr)
        return;

    let state = JSON.parse(stateStr);

    if ('t' in state)
    {
        t = state.t;
    }
    if('ctimer' in state)
    {
        ctimer = state.ctimer;
        cIterProgBar.progress = Math.min(1,
            (ctimer / (cooldown[cooldownMs.level] - 1)));
    }
    if('c' in state)
    {
        c = BigInt(state.c);
        cBigNum = BigNumber.from(c);
    }
    if('c0' in state)
    {
        c0 = BigInt(state.c0);
        c0BigNum = BigNumber.from(c0);
    }
    if ('c1' in state)
    {
        c1 = BigInt(state.c1);
        c1BigNum = BigNumber.from(c1);
    }
    if ('c1cycle' in state)
    {
        c1cycle = state.c1cycle;
    }

    if ('T' in state)
    {
        T = BigNumber.fromBase64String(state.T);
    }
    if ('S' in state)
    {
        S = BigNumber.fromBase64String(state.S);
    }
    if ('M' in state)
    {
        M = BigNumber.fromBase64String(state.M);
    }

    if ('T1' in state)
    {
        T1 = state.T1;
    }
    if ('S1' in state)
    {
        S1 = BigNumber.fromBase64String(state.S1);
    }
    if ('M1' in state)
    {
        M1 = BigNumber.fromBase64String(state.M1);
    }


    theory.invalidatePrimaryEquation();
    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
}

/////
// UI

const cIterProgBar = ui.createProgressBar
({
    margin: new Thickness(6, 0),
    progressColor: () => Color.TEXT
});

var getEquationOverlay = () =>
{
    let result = ui.createGrid
    ({
        inputTransparent: true,
        cascadeInputTransparent: true,
        columnDefinitions: ['1*', '2*', '1*'],
        children:
        [
            ui.createFrame
            ({
                row: 0,
                column: 1,
                hasShadow: true,
                verticalOptions: LayoutOptions.START,
                cornerRadius: 1,
                content: cIterProgBar
            })
        ]
    });
    return result;
}

var getPrimaryEquation = () => {
    theory.primaryEquationHeight = 100;

    let result = ``;

    if (stage == 1) {
        const c0IncSteps = [1, 2, 4]

        result = `\\begin{matrix}f(n)=\\begin{cases}`
        + `n/2&\\text{{if }}{{n\\equiv0\\text{ (mod 2)}}}\\\\`
        + `3n+1&\\text{{if }}{{n\\equiv1\\text{ (mod 2)}}}`
        + `\\end{cases}\\\\`
        + `c \\leftarrow f(c)\\\\`
        + (terminateEarlyMs.level == 0 
            ? `c = 1 \\Rightarrow {c_0} \\leftarrow {c_0} + ${c0IncSteps[c0SkipMs.level]}; c \\leftarrow c_0`
            : `c < {c_0} \\Rightarrow {c_0} \\leftarrow {c_0} + ${c0IncSteps[c0SkipMs.level]}; c \\leftarrow c_0`)
        + `\\end{matrix}`;
    }
    else {
        result = `\\begin{matrix}`;
        result += `\\dot{T} = T(c_1)\\\\`;
        result += `\\dot{S} = S(c_1)\\\\`;
        result += `\\dot{M} = M(c_1)\\\\`;
        result += `c_1 \\leftarrow f(c_1)\\\\`;
        result += `\\end{matrix}`;
    }
    

    return result;
}

var getSecondaryEquation = () => {
    theory.secondaryEquationHeight = 80;

    let result = ``;

    if (stage == 1) {
        theory.secondaryEquationScale = 1.2;
        const cStr = `c=${cBigNum.toString(0)}`;
        const c0Str = `c_0=${c0BigNum.toString(0)}`;

        result = "\\begin{matrix}";
        result += `\\dot{\\rho} = t{q_1}{q_2}TSM{c_0}\\\\`;
        result += `${cStr}\\\\${c0Str}`;
        result += `\\end{matrix}`;
    }
    else {
        theory.secondaryEquationScale = 1;
        result = "\\begin{matrix}";
        result += `c_1=${c1BigNum.toString(0)}& T(c_1)=${T1}& S(c_1)=${S1.toString(0)}& M(c_1)=${M1.toString(0)}`;
        result += `\\end{matrix}`;
    }
    

    return result;
}

var getTertiaryEquation = () => {
    let result = ``;

    const bottomString = `${theory.latexSymbol} = \\max \\rho^{${tauRate}} \\quad t = ${t}`;

    if (c1Ms.level == 0) {
        result = bottomString;
    }
    else {
        result += `\\begin{matrix}`;
        result += `T = ${T} \\quad S = ${S} \\quad M = ${M}`;
        result += "\\\\";
        result += bottomString;
        result += `\\end{matrix}`;
    }

    return result;
}

var canGoToPreviousStage = () => (stage === 1 && c1Ms.level == 1);
var goToPreviousStage = () => {
  stage--;
  theory.invalidatePrimaryEquation();
  theory.invalidateSecondaryEquation();
  theory.invalidateTertiaryEquation();
  //quaternaryEntries = [];
  //theory.invalidateQuaternaryValues();
};
var canGoToNextStage = () => stage === 0;
var goToNextStage = () => {
  stage++;
  theory.invalidatePrimaryEquation();
  theory.invalidateSecondaryEquation();
  theory.invalidateTertiaryEquation();
  //quaternaryEntries = [];
  //theory.invalidateQuaternaryValues();
};

init();