import { ExponentialCost, FreeCost, LinearCost } from "../api/Costs";
import { Localization } from "../api/Localization";
import { BigNumber } from "./api/BigNumber";
import { theory, QuaternaryEntry } from "../api/Theory";
import { log, Utils } from "../api/Utils";
import { game } from "../api/Game"

var id = "mathis_qol";
var name = "Mathis QoL";
var description = "QoL by Mathis S."
;
var authors = "Mathis S.";
var version = 1;

var stage = 0;

var g_elapsedTime = 0;
var g_multiplier = 0;

var upgradeCost = upgrade => upgrade.cost.getCost(upgrade.level);
var toBig = number => BigNumber.from(number);
var publicationMultiplier = theory => theory.nextPublicationMultiplier / theory.publicationMultiplier;
var getR9 = () => (game.sigmaTotal / 20) ** game.researchUpgrades[8].level;

var quaternaryEntries = [];

function formatBigNumberPrecision(number, precision = 4) {
    if (number < BigNumber.from(1e6)) {
      return number.toString();
    }
    const log10 = number.log10().toNumber();
    const exp = Math.floor(log10);
    const dec = 10**(log10 - exp);
    return `${dec.toPrecision(precision)}e${exp}`;
  }

var init = () => {

}

var updateAvailability = () => {

}

var tick = (elapsedTime, multiplier) => {
    g_elapsedTime = elapsedTime;
    g_multiplier = multiplier;
    theory.invalidatePrimaryEquation()
    theory.invalidateSecondaryEquation();
    theory.invalidateQuaternaryValues()
}

var getT6r = (theory) => {
    let string = theory.tertiaryEquation;
    let begin  = string.indexOf("r=");
    let end    = string.indexOf(",", begin);
    return parseBigNumber(string.substring(begin + 2, end)).max(Number.MIN_VALUE);
}

var getPrimaryEquation = () => {
    let result = "";

    if (stage == 0) { 
        theory.primaryEquationHeight = 80;
        theory.primaryEquationScale = 1;
        result += `\\text{Mathis QoL V0.1}\\\\`
    }
    else {
        theory.primaryEquationHeight = 1;
    }

    return result;
}

var getSecondaryEquation = () => {
    let result = "";
    if (stage == 0) {
        theory.secondaryEquationHeight = 30;
        if (game.activeTheory.id == 4){ // t5
            let theory = game.activeTheory;
            let upgrades = theory.upgrades;
            let c2 = BigNumber.TWO.pow(upgrades[3].level);
            let c3 = BigNumber.TWO.pow(upgrades[4].level*1.1);
            let qmax = c2 * c3;
            let qflip = qmax * BigNumber.from(2/3)
            result += "q \\text{ flip point:}" + qflip.toString() + "\\\\";
            result += "q \\text{ cap:}" + qmax.toString();
        }
        else if (game.activeTheory.id == 5) // t6
        {
            const theory = game.activeTheory;
            const upgrades = theory.upgrades;
            const c5 = BigNumber.TWO.pow(upgrades[8].level);
            const r = getT6r(theory);
            const c1 = getStepwise(upgrades[4].level, 2, 10, 1, 1.15);
            const c2 = BigNumber.TWO.pow(upgrades[5].level);
    
            const ratio = (c5 * r / BigNumber.TWO) / (c1 * c2);
    
            result += "\\text{term ratio:}" + ratio.toString(3);
        }
    }
    else {
        theory.secondaryEquationHeight = 200;
        const th = game.activeTheory;
        const currencies = th.currencies;
        const upgrades = th.upgrades;

        result += `${th.latexSymbol} = ${formatBigNumberPrecision(th.tau)}`;
        for (let i = 0; i < currencies.length; i++) {
            result += `\\\\ ${currencies[i].symbol} = ${formatBigNumberPrecision(currencies[i].value)}`;
        }
        for (let j = 0; j < upgrades.length; j++) {
            result += `\\\\ ${upgrades[j].description.split('(')[1].split("=")[0]} \\text{cost} = ${formatBigNumberPrecision(upgrades[j].cost.getCost(upgrades[j].level))}`;
        }
    }

    return result;
}

var getQuaternaryEntries = () => {
    if (game.activeTheory.id == 6) // t7
    {
        if (quaternaryEntries = [])
        {
            quaternaryEntries.push(new QuaternaryEntry("{c_1}{c_2}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_3}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_6}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_4}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_5}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_6}", null));
        }
        let theory = game.activeTheory;
        let upgrades = theory.upgrades;
    
        let bonus = theory.publicationMultiplier;
        let rho1 = theory.currencies[0].value;
        let rho2 = theory.currencies[1].value;
        let vc1 = getStepwise(upgrades[1].level, 2, 10, 1, 1.15);
        let vc2 = BigNumber.TWO.pow(upgrades[2].level);
        let vc3 = BigNumber.TWO.pow(upgrades[3].level);
        let vc4 = BigNumber.TWO.pow(upgrades[4].level);
        let vc5 = BigNumber.TWO.pow(upgrades[5].level);
        let vc6 = BigNumber.TWO.pow(upgrades[6].level);
        let rho1Sqrt = rho1.max(BigNumber.ONE).sqrt();
        let rho2Sqrt = rho2.max(BigNumber.ONE).sqrt();
    
        let drho11 = vc1 * vc2;
        let drho12 = (BigNumber.from(1.5) * vc3 * rho1Sqrt);
        let drho13 = (BigNumber.HALF * vc6 * rho2Sqrt / rho1Sqrt);
        let drho21 = vc4;
        let drho22 = (BigNumber.from(1.5) * vc5 * rho2Sqrt);
        let drho23 = (BigNumber.HALF * vc6 * rho1Sqrt / rho2Sqrt);
    
        let rho1tot = drho11 + drho12 + drho13;
        let rho2tot = drho21 + drho22 + drho23;
    
        quaternaryEntries[0].value = (BigNumber.HUNDRED * drho11 / rho1tot).toString(3);
        quaternaryEntries[1].value = (BigNumber.HUNDRED * drho12 / rho1tot).toString(3);
        quaternaryEntries[2].value = (BigNumber.HUNDRED * drho13 / rho1tot).toString(3);
        quaternaryEntries[3].value = (BigNumber.HUNDRED * drho21 / rho2tot).toString(3);
        quaternaryEntries[4].value = (BigNumber.HUNDRED * drho22 / rho2tot).toString(3);
        quaternaryEntries[5].value = (BigNumber.HUNDRED * drho23 / rho2tot).toString(3);
    }
    else if (game.activeTheory.id == 2) // t3
    {
        if (quaternaryEntries = [])
        {
            quaternaryEntries.push(new QuaternaryEntry("{c_{11}}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_{12}}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_{13}}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_{21}}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_{22}}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_{23}}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_{31}}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_{32}}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_{33}}", null));
        }
        let theory = game.activeTheory;
        let upgrades = theory.upgrades;

        let vc11 = BigNumber.TWO.pow(upgrades[3].level);
        let vc12 = BigNumber.TWO.pow(upgrades[4].level);
        let vc13 = BigNumber.TWO.pow(upgrades[5].level);
        let vc21 = BigNumber.TWO.pow(upgrades[6].level);
        let vc22 = BigNumber.TWO.pow(upgrades[7].level);
        let vc23 = BigNumber.TWO.pow(upgrades[8].level);
        let vc31 = BigNumber.TWO.pow(upgrades[9].level);
        let vc32 = BigNumber.TWO.pow(upgrades[10].level);
        let vc33 = BigNumber.TWO.pow(upgrades[11].level);
        let vb1 = getStepwise(upgrades[0].level, 2, 10, 0, 1.1);
        let vb2 = getStepwise(upgrades[1].level, 2, 10, 0, 1.1);
        let vb3 = getStepwise(upgrades[2].level, 2, 10, 0, 1.1);

        let drho11 = vc11 * vb1;
        let drho12 = vc12 * vb2;
        let drho13 = vc13 * vb3;
        let drho21 = vc21 * vb1;
        let drho22 = vc22 * vb2;
        let drho23 = vc23 * vb3;
        let drho31 = vc31 * vb1;
        let drho32 = vc32 * vb2;
        let drho33 = vc33 * vb3;

        let rho1tot = drho11 + drho12 + drho13;
        let rho2tot = drho21 + drho22 + drho23;
        let rho3tot = drho31 + drho32 + drho33;

        quaternaryEntries[0].value = (BigNumber.HUNDRED * drho11 / rho1tot).toString(3);
        quaternaryEntries[1].value = (BigNumber.HUNDRED * drho12 / rho1tot).toString(3);
        quaternaryEntries[2].value = (BigNumber.HUNDRED * drho13 / rho1tot).toString(3);
        quaternaryEntries[3].value = (BigNumber.HUNDRED * drho21 / rho2tot).toString(3);
        quaternaryEntries[4].value = (BigNumber.HUNDRED * drho22 / rho2tot).toString(3);
        quaternaryEntries[5].value = (BigNumber.HUNDRED * drho23 / rho2tot).toString(3);
        quaternaryEntries[6].value = (BigNumber.HUNDRED * drho31 / rho3tot).toString(3);
        quaternaryEntries[7].value = (BigNumber.HUNDRED * drho32 / rho3tot).toString(3);
        quaternaryEntries[8].value = (BigNumber.HUNDRED * drho33 / rho3tot).toString(3);

    }
    else if (game.activeTheory.id == 0) // t1
    {
        if (quaternaryEntries = [])
        {
            quaternaryEntries.push(new QuaternaryEntry("{c_{12}}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_{3}}", null));
            quaternaryEntries.push(new QuaternaryEntry("{c_{4}}", null));
        }

        let theory = game.activeTheory;
        let upgrades = theory.upgrades;

        let rho = theory.currencies[0].value
        let vc1 = getStepwise(upgrades[2].level, 2, 10, 1, 1.15);
        let vc2 = BigNumber.TWO.pow(upgrades[3].level);
        let vc3 = BigNumber.TEN.pow(upgrades[4].level);
        let vc4 = BigNumber.TEN.pow(upgrades[5].level);

        let term1 = vc1 * vc2 * (BigNumber.ONE + rho.max(BigNumber.ONE).log() / BigNumber.HUNDRED);
        let term2 = vc3 * rho.pow(0.2);
        let term3 = vc4 * rho.pow(0.3);

        let rhotot = term1 + term2 + term3;

        quaternaryEntries[0].value = (BigNumber.HUNDRED * term1 / rhotot).toString(3);
        quaternaryEntries[1].value = (BigNumber.HUNDRED * term2 / rhotot).toString(3);
        quaternaryEntries[2].value = (BigNumber.HUNDRED * term3 / rhotot).toString(3);
    }
    else {
        quaternaryEntries = [];
    }

    return quaternaryEntries;
}

var canGoToPreviousStage = () => stage > 0;
var goToPreviousStage = () => {
  stage--;
  theory.invalidatePrimaryEquation();
  theory.invalidateSecondaryEquation();
  //theory.invalidateTertiaryEquation();
};
var canGoToNextStage = () => stage < 1;
var goToNextStage = () => {
  stage++;
  theory.invalidatePrimaryEquation();
  theory.invalidateSecondaryEquation();
  //theory.invalidateTertiaryEquation();
};

//var getSecondaryEquation = () => theory.latexSymbol + "=\\max\\rho";
//var getPublicationMultiplier = (tau) => tau.pow(0.164) / BigNumber.THREE;
//var getPublicationMultiplierFormula = (symbol) => "\\frac{{" + symbol + "}^{0.164}}{3}";
//var getTau = () => BigNumber.ZERO;

var getStepwise = (level, power, cl, off, exp) => {
    return Utils.getStepwisePowerSum(level, power, cl, off).pow(exp)
}

var getInternalState = () => JSON.stringify({
    stage: stage
})

var setInternalState = (stateStr) => {
    if (!stateStr) return;

    /**
     * @param {String} str 
     * @param {BigNumber} defaultValue
     */
    const parseBigNumBSF = (str, defaultValue) => (str ? BigNumber.fromBase64String(str) : defaultValue);

    const state = JSON.parse(stateStr);

    stage = state.stage ?? 0;
}

init();
