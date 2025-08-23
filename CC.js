import { BigNumber } from '../api/BigNumber';
import { CompositeCost, ExponentialCost, FirstFreeCost, FreeCost, LinearCost } from '../api/Costs';
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

/*
    Utils
*/

let bigNumArray = (array) => array.map(x => BigNumber.from(x));

/*
    Variables
*/
let c = 1n;
let cBigNum = BigNumber.from(c);
let c0 = 1n;
let c0BigNum = BigNumber.from(c0);
let ctimer = 0;
let t = 0;

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
const q1Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.22)));
const getq1 = (level) => Utils.getStepwisePowerSum(level, 2, 8, 0);

const q2Cost = new ExponentialCost(1e4, Math.log2(8));
const getq2 = (level) => BigNumber.TWO.pow(level);

/*
    Perma upgrades
*/
const permaCosts = bigNumArray(['1e8', '1e20', '1e24']);

/*
    Milestones
*/
var cooldownMs, terminateEarlyMs, c0SkipMs;

const milestoneCosts = [
    125, 150, 175, // cooldown ms
    225, // c < c0 ms
    250, 275, // c0 skip ms
    300 // stage 2 start
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
        c0SkipMs.canBeRefunded = () => true;
    }
}

var updateAvailability = () => {
    terminateEarlyMs.isAvailable = cooldownMs.level == cooldown.length - 1;
    c0SkipMs.isAvailable = terminateEarlyMs.level == 1;
}


var tick = (elapsedTime, multiplier) => {
    if (!q1.level) return;

    ctimer += elapsedTime * 10;
    let turned = false;
    while(ctimer + 1e-8 >= cooldown[cooldownMs.level])
    {
        turned = true;
        ctimer -= cooldown[cooldownMs.level];
        cIterProgBar.progressTo(0, 33, Easing.LINEAR);

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
            t++;
        }
        else {
            if(c % 2n != 0)
                c = 3n * c + 1n;
            else
                c /= 2n;
            cBigNum = BigNumber.from(c);
            t++;
        }

        theory.invalidateSecondaryEquation();
        theory.invalidateTertiaryEquation();
    }
    if(!turned)
        cIterProgBar.progressTo(Math.min(1,
            (ctimer / (cooldown[cooldownMs.level] - 1))), 95,
        Easing.LINEAR);

    const dt = BigNumber.from(elapsedTime * multiplier);
    const bonus = theory.publicationMultiplier;

    const vq1 = getq1(q1.level);
    const vq2 = getq2(q2.level);

    const rhodot = bonus * vq1 * vq2 * t * c0BigNum;

    currency.value += rhodot * dt;
}

var postPublish = () => {
    t = 0;
    ctimer = 0;
    c = c0;
    cBigNum = BigNumber.from(c);
}

var getInternalState = () => JSON.stringify
({
    t,
    c: c.toString(),
    c0: c0.toString(),
    ctimer,
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


    theory.invalidatePrimaryEquation();
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

    const c0IncSteps = [1, 2, 4]

    let result = `\\begin{matrix}c\\leftarrow\\begin{cases}`
    + `c/2&\\text{{if }}{{c\\equiv0\\text{ (mod 2)}}}\\\\`
    + `3c+1&\\text{{if }}{{c\\equiv1\\text{ (mod 2)}}}`
    + `\\end{cases}\\\\`
    + (terminateEarlyMs.level == 0 
        ? `c = 1 \\Rightarrow {c_0} \\leftarrow {c_0} + ${c0IncSteps[c0SkipMs.level]}; c \\leftarrow c_0`
        : `c < {c_0} \\Rightarrow {c_0} \\leftarrow {c_0} + ${c0IncSteps[c0SkipMs.level]}; c \\leftarrow c_0`)
    + `\\end{matrix}`;

    return result;
}

var getSecondaryEquation = () => {
    theory.secondaryEquationHeight = 80;
    theory.secondaryEquationScale = 1.2;

    cStr = `c=${cBigNum.toString(0)}`;
    c0Str = `c0=${c0BigNum.toString(0)}`;

    let result = "\\begin{matrix}";
    result += `\\dot{\\rho} = {q_1}{q_2}{t}{c_0}\\\\`;
    result += `${cStr}\\\\${c0Str}`;
    result += `\\end{matrix}`;

    return result;
}

var getTertiaryEquation = () => {
    return `${theory.latexSymbol} = \\max \\rho^{${tauRate}} \\quad t = ${t}`;
}

init();