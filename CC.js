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

// Constants

const ZERO = BigNumber.ZERO;

// Utils

let bigNumArray = (array) => array.map(x => BigNumber.from(x));

// Variables
let c = 1n;
let cBigNum = BigNumber.from(c);
let c0 = 1n;
let c0BigNum = BigNumber.from(c0);
let ctimer = 0;
let t = 0;

// Balance
const tauRate = 0.04;
const pubExp = 3.01;
var getPublicationMultiplier = (tau) => tau.pow(pubExp);
var getPublicationMultiplierFormula = (symbol) =>
`{${symbol}}^{${pubExp}}`;

// Upgrades
const q1Cost = new FirstFreeCost(new ExponentialCost(1000, 1.5));
const getq1 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 0);

const q2Cost = new ExponentialCost(2.2e7, 6);
const getq2 = (level) => BigNumber.TWO.pow(level);

var getTau = () => currency.value.pow(tauRate);

var getCurrencyFromTau = (tau) =>
[
    tau.max(BigNumber.ONE).pow(BigNumber.ONE / tauRate),
    currency.symbol
];

// Milestones
var cooldownMs;

const milestoneCost = new CustomCost((level) =>
{
    if(level == 0) return BigNumber.from(30 * tauRate);
    if(level == 1) return BigNumber.from(45 * tauRate);
    if(level == 2) return BigNumber.from(75 * tauRate);
    if(level == 3) return BigNumber.from(105 * tauRate);
    if(level == 4) return BigNumber.from(150 * tauRate);
    if(level == 5) return BigNumber.from(210 * tauRate);
    if(level == 6) return BigNumber.from(270 * tauRate);
    if(level == 7) return BigNumber.from(330 * tauRate);
    if(level == 8) return BigNumber.from(390 * tauRate);
    if(level == 9) return BigNumber.from(450 * tauRate);
    return BigNumber.from(-1);
});

const cooldown = [40, 20, 10, 5];
const permaCosts = bigNumArray(['1e12', '1e20', '1e24']);

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

    /* Interval speed-up
    */
    {
        let getInfo = (level, amount = 1) => `c update interval =
            ${cooldown[level] || cooldown[level - amount]}`;
        cooldownMs = theory.createMilestoneUpgrade(0, cooldown.length - 1);
        cooldownMs.getDescription = (amount) =>
        {
            return Localization.getUpgradeDecCustomDesc("c update interval", 
                cooldown[cooldownMs.level] - cooldown[cooldownMs.level + amount] ||
            0)
        };
        cooldownMs.getInfo = (amount) =>
        {
            return Localization.getUpgradeDecCustomInfo("the interval between c updates", 
                cooldown[cooldownMs.level] - cooldown[cooldownMs.level + amount] ||
            0)
        }
        cooldownMs.boughtOrRefunded = (_) =>
        {
            updateAvailability();
        };
        cooldownMs.canBeRefunded = (amount) => true;
    }
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

        if (c == 1n) {
            c0 += 1n;
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

        //theory.invalidatePrimaryEquation();
        theory.invalidateSecondaryEquation();
    }
    if(!turned)
        cIterProgBar.progressTo(Math.min(1,
            (ctimer / (cooldown[cooldownMs.level] - 1))), 95,
        Easing.LINEAR);

    const dt = BigNumber.from(elapsedTime * multiplier);

    const vq1 = getq1(q1.level);
    const vq2 = getq2(q2.level);

    const rhodot = vq1 * vq2 * t * c0BigNum;

    currency.value += rhodot * dt;

    theory.invalidateTertiaryEquation();
}

var postPublish = () => {
    t = 0;
    ctimer = 0;
    c = c0;
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

    let result = `\\begin{matrix}c\\leftarrow\\begin{cases}`
    + `c/2&\\text{{if }}{{c\\equiv0\\text{ (mod 2)}}}\\\\`
    + `3c+1&\\text{{if }}{{c\\equiv1\\text{ (mod 2)}}}`
    + `\\end{cases}\\\\`
    + `c = 1 \\Rightarrow {c_0} \\leftarrow {c_0} + 1; c \\leftarrow c_0`
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