import { BigNumber } from '../api/BigNumber';
import { theory, QuaternaryEntry } from "../api/Theory";
import { Localization } from "../api/Localization";
import { ExponentialCost, FirstFreeCost, FreeCost } from '../api/Costs';
import { Utils } from '../api/Utils';
import { log } from 'winjs';

var id = "nli_beta";

const phi = BigNumber.from((1 + Math.sqrt(5))/2)
const ZERO = BigNumber.ZERO
const ONE = BigNumber.ONE


var getName = (language) => {
    const names =
    {
        en: 'Non-Linear Integration Beta',
    };

    return names[language] || names.en;
}

var getDescription = (language) => {
    const descs =
    {
        en: "A custom theory about the Riemann-Stieltjes integral\n" +
    "Now in development",
    };

    return descs[language] || descs.en;
}

var authors = "Snaeky - Idea\nMathis S. - Coding";
var version = 1;

///////////////
// Localization

// From RZ's code
const locStrings =
{
    example:
    {
        pubTime: '{0}',
    },
    en:
    {
        pubTime: 'Publication time: {0}',
    }
};

// From RZ's code
const menuLang = Localization.language;
/**
 * Returns a localised string.
 * @param {string} name the internal name of the string.
 * @returns {string} the string.
 */
let getLoc = (name, lang = menuLang) =>
{
    if(lang in locStrings && name in locStrings[lang])
        return locStrings[lang][name];

    if(name in locStrings.en)
        return locStrings.en[name];

    return `String missing: ${lang}.${name}`;
}

///////////////
// Declarations

var alphaMode = false;

// Currencies
var currencyRho;
var currencyAlpha;

// Upgrades
var a0, a1, a2;
var b0, b1;
var switcher;

// UI
var rhodot = ZERO;
var alphadot = ZERO;


//////////
// Balance

const a0Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
var getA0 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 0)

const a1Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
var getA1 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 0)

const a2Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
var getA2 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 0)

const b0Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
var getB0 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 0)

const b1Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
var getB1 = (level) => Utils.getStepwisePowerSum(level, 2, 10, 0)

var getPublicationMultiplier = (tau) => BigNumber.ZERO;

var getPublicationMultiplierFormula = (symbol) => "";

var getTau = () => currencyRho.value;

//var getCurrencyFromTau = (tau) => [value, symbol];

////////
// Utils

let getTimeString = (time) =>
{
    let minutes = Math.floor(time / 60);
    let seconds = time - minutes*60;
    let timeString;
    if(minutes >= 60)
    {
        let hours = Math.floor(minutes / 60);
        if (hours >= 24)
        {
            let days = Math.floor(hours / 24);
            hours -= days*24;
            minutes -= hours*60 + days*60*24;
            timeString = `
                ${days}d  
                ${hours}:${
                minutes.toString().padStart(2, '0')}:${
                seconds.toFixed(1).padStart(4, '0')}`;
        }
        else {
            minutes -= hours*60;
            timeString = `${hours}:${
            minutes.toString().padStart(2, '0')}:${
            seconds.toFixed(1).padStart(4, '0')}`;
        }
    }
    else
    {
        timeString = `${minutes.toString()}:${
        seconds.toFixed(1).padStart(4, '0')}`;
    }
    return timeString;
};

// Computes the Riemann-Stieltjes integral from two polynomials
var rspInt = (poly1, poly2, lBound, hBound) => {
    var res = BigNumber.ZERO;

    for (let i=0; i<poly1.length; i++){
        for (let j=1; j<poly2.length; j++){
            res += BigNumber.from(j/(i+j)) * poly1[i] * poly2[j] * (hBound.pow(i+j) - lBound.pow(i+j))
        }
    }

    return res;
}


////////////
// Functions

var switchMode = () => {
    alphaMode = !alphaMode;
    theory.invalidatePrimaryEquation();
    theory.invalidateSecondaryEquation();

    a0.level = 0;
    a1.level = 0;
    a2.level = 0;
    b0.level = 0;
    b1.level = 0;

    rhodot = ZERO;
    alphadot = ZERO;
}

var init = () => {
    currencyRho = theory.createCurrency();
    currencyAlpha = theory.createCurrency("α", "\\alpha");

    ///////////////////
    // Regular Upgrades

    {
        switcher = theory.createUpgrade(0, currencyRho, new FreeCost);
        switcher.getDescription = (_) => "Switch";
        switcher.getInfo = (_) => "Switch";
        switcher.bought = (_) => {
            switcher.level = 0;
            switchMode();
        }
        switcher.isAutoBuyable = false;
    }

    {
        let getDesc = (level) => `a_0=${getA0(level).toString(0)}`;
        a0 = theory.createUpgrade(1, currencyRho, a0Cost);
        a0.getDescription = (_) => Utils.getMath(getDesc(a0.level));
        a0.getInfo = (amount) => Utils.getMathTo(getDesc(a0.level), getDesc(a0.level + amount));
    }
    {
        let getDesc = (level) => `a_1=${getA1(level).toString(0)}`;
        a1 = theory.createUpgrade(2, currencyRho, a1Cost);
        a1.getDescription = (_) => Utils.getMath(getDesc(a1.level));
        a1.getInfo = (amount) => Utils.getMathTo(getDesc(a1.level), getDesc(a1.level + amount));
    }
    {
        let getDesc = (level) => `a_2=${getA2(level).toString(0)}`;
        a2 = theory.createUpgrade(3, currencyRho, a2Cost);
        a2.getDescription = (_) => Utils.getMath(getDesc(a2.level));
        a2.getInfo = (amount) => Utils.getMathTo(getDesc(a2.level), getDesc(a2.level + amount));
    }

    {
        let getDesc = (level) => `b_0=${getB0(level).toString(0)}`;
        b0 = theory.createUpgrade(4, currencyAlpha, b0Cost);
        b0.getDescription = (_) => Utils.getMath(getDesc(b0.level));
        b0.getInfo = (amount) => Utils.getMathTo(getDesc(b0.level), getDesc(b0.level + amount));
    }
    {
        let getDesc = (level) => `b_1=${getB1(level).toString(0)}`;
        b1 = theory.createUpgrade(5, currencyAlpha, b0Cost);
        b1.getDescription = (_) => Utils.getMath(getDesc(b1.level));
        b1.getInfo = (amount) => Utils.getMathTo(getDesc(b1.level), getDesc(b1.level + amount));
    }
    

    /////////////////////
    // Permanent Upgrades


    ///////////////////////
    //// Milestone Upgrades

    

}

var updateAvailability = () => {

}

var tick = (elapsedTime, multiplier) => {
    if (a0.level === 0){
        return;
    }

    const dt = elapsedTime * multiplier;

    const va0 = getA0(a0.level);
    const va1 = getA1(a1.level);
    const va2 = getA2(a2.level);

    const vb0 = getB0(b0.level);
    const vb1 = getB1(b1.level);

    const k = [va0, va1, va2];
    const h = [vb0, vb1];

    if (alphaMode) {
        const integral = rspInt(h, k, ZERO, phi);
        alphadot = integral * multiplier;
        currencyAlpha.value += alphadot * elapsedTime;
    }
    else {
        const integral = rspInt(k, h, ZERO, phi);
        rhodot = integral * multiplier;
        currencyRho.value += rhodot * elapsedTime;
    }
    
    theory.invalidateSecondaryEquation()
}

var postPublish = () => {

}

var getInternalState = () => JSON.stringify({
    version
})

var setInternalState = (stateStr) => {
    if (!stateStr) return;

    const state = JSON.parse(stateStr)
}


/////
// UI

var getPrimaryEquation = () => {
    let result = ``;

    theory.primaryEquationHeight = 110
    theory.primaryEquationScale = 1.2

    if (alphaMode) {
        result += `\\dot{\\alpha}=\\int_{0}^{\\phi}{h(x)dk(x)}`;
    }
    else {
        result += `\\dot{\\rho}=\\int_{0}^{\\phi}{k(x)dh(x)}`;
    }
    

    return result;
}

var getSecondaryEquation = () => {
    let result = ``;

    theory.secondaryEquationHeight = 80;
    theory.secondaryEquationScale = 1.1;

    result += `k(x) = {a_2}x^2 + {a_1}x + a_0\\\\h(x) = {b_1}x + b_0\\\\`;
    if (alphaMode) {
        result += `\\dot{\\alpha} = ${alphadot.toString()}`;
    }
    else {
        result += `\\dot{\\rho} = ${rhodot.toString()}`;
    }

    return result;
}

var getTertiaryEquation = () => {
    let result = ``;

    result += `${theory.latexSymbol}=\\max\\rho`;

    return result;
}

var get2DGraphValue = () => currencyRho.value.sign * (BigNumber.ONE + currencyRho.value.abs()).log10().toNumber()

init();