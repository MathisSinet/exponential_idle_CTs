import { BigNumber, parseBigNumber } from '../api/BigNumber';
import { theory, QuaternaryEntry } from "../api/Theory";
import { Localization } from "../api/Localization";
import { Currency } from '../api/Currency';
import { ExponentialCost, FirstFreeCost, FreeCost } from '../api/Costs';
import { Upgrade } from '../api/Upgrades';
import { Utils, log } from '../api/Utils';
import { ui } from '../api/ui/UI';
import { Aspect } from '../api/ui/properties/Aspect';
import { Color } from '../api/ui/properties/Color';
import { FontAttributes } from '../api/ui/properties/FontAttributes';
import { ImageSource } from '../api/ui/properties/ImageSource';
import { LayoutOptions } from '../api/ui/properties/LayoutOptions';
import { StackOrientation } from '../api/ui/properties/StackOrientation';
import { TextAlignment } from '../api/ui/properties/TextAlignment';
import { Thickness } from '../api/ui/properties/Thickness';
import { TouchType } from '../api/ui/properties/TouchType';

var id = "nli_beta";

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

/**
 * Applies BigNumber.from to all elements in the array
 * @param {(number | string)[]} arr 
 * @returns {BigNumber[]}
 */
var bigNumArray = (arr) => arr.map((val) => BigNumber.from(val));

///////////////
// Declarations

const PHI = BigNumber.from((1 + Math.sqrt(5))/2);
const ZERO = BigNumber.ZERO;
const ONE = BigNumber.ONE;

var alphaMode = true;

let maxh = ZERO;

let milestonesAvailable = 0;
let totalMilestonePoints = 0;
let maxMilestoneThreshold = ZERO;

// Currencies
/** @type {Currency} */
var currencyRho;
/** @type {Currency} */
var currencyAlpha;

// Upgrades
/** @type {Upgrade} */
var a0;
/** @type {Upgrade} */
var a1;
/** @type {Upgrade} */
var a2;
/** @type {Upgrade} */
var b0;
/** @type {Upgrade} */
var b1;
/** @type {Upgrade} */
var a0a;
/** @type {Upgrade} */
var a1a;
/** @type {Upgrade} */
var a2a;
/** @type {Upgrade} */
var b0a;
/** @type {Upgrade} */
var b1a;

// Milestones

/** @type {CustomMilestoneUpgrade[]} */
var milestoneArray = [];

/** @type {CustomMilestoneUpgrade} */
var hTermMs;
/** @type {CustomMilestoneUpgrade} */
var b0baseMs;
/** @type {CustomMilestoneUpgrade} */
var rhoUnlock;

// UI
var rhodot = ZERO;
var alphadot = ZERO;
var cur_h = ZERO;

var milestoneInfoPressed = false;

// Debug
/** @type {Upgrade} */
var debugResetMilestonesUpgrade;

//////////
// Balance

const pubMultExp = 0.1;
const rhoExponent = 0.2;
const maxhExponent = 0.2;

const permaCosts = bigNumArray([
    1e8,
    1e5,
    1e5
]);

const milestoneCosts = bigNumArray([
    '1e15',
    '2e15',
    '2e16'
]);

const milestoneCount = milestoneCosts.length;

const a0Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
const a0aCost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
var getA0 = (level) => BigNumber.TWO.pow(level);

const a1Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
const a1aCost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
var getA1 = (level) => BigNumber.TWO.pow(level);

const a2Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
const a2aCost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
var getA2 = (level) => BigNumber.TWO.pow(level);

const b0Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
const b0aCost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
const b0bases = [1.2, 1.4];
var getB0 = (level) => BigNumber.from(b0bases[b0baseMs.level]).pow(level) - ONE;

const b1Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
const b1aCost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
var getB1 = (level) => BigNumber.TWO.pow(level) - ONE;

var getPublicationMultiplier = (tau) => tau.pow(pubMultExp);

var getPublicationMultiplierFormula = (symbol) => `{${symbol}}^{${pubMultExp}}`;

var getTau = () => (rhoUnlock.level > 0 ? currencyRho.value.pow(rhoExponent) : ONE) * maxh.pow(maxhExponent);

var getMilestoneThreshold = () => theory.tau * maxh;

//var getCurrencyFromTau = (tau) => [value, symbol];

////////
// Utils

/**
 * Round `num` to 5 decimal places
 * @param {Number} num 
 * @returns {Number}
 */
var r5 = (num) => Math.round(num * 10000) / 10000;

class CustomMilestoneUpgrade {
    /**
     * @param {Number} id 
     * @param {Number} maxLevel
     */
    constructor(id, maxLevel) {
        this.innerUpgrade = theory.createPermanentUpgrade(id + 100, currencyRho, new FreeCost)
        this.innerUpgrade.isAvailable = false;
        this.isAvailable = true;
        this.maxLevel = maxLevel;
        /** @type {function():void} */
        this.boughtOrRefunded = () => {};
        milestoneArray.push(this);
    }

    get getDescription() { return this.innerUpgrade.getDescription }
    set getDescription(value) { this.innerUpgrade.getDescription = value }

    get getInfo() { return this.innerUpgrade.getInfo }
    set getInfo(value) { this.innerUpgrade.getInfo = value }

    get canBeRefunded() { return (amount) => (this.innerUpgrade.canBeRefunded(amount) && this.innerUpgrade.level > 0) }
    set canBeRefunded(value) { this.innerUpgrade.canBeRefunded = value }

    get level() { return this.innerUpgrade.level }
    set level(value) { this.innerUpgrade.level = value }

    get maxLevel() { return this.innerUpgrade.maxLevel }
    set maxLevel(value) { this.innerUpgrade.maxLevel = value }

    buy() {
        if (this.level < this.maxLevel && this.isAvailable) {
            this.level += 1; 
            this.boughtOrRefunded();
        }
    }
    refund() {
        if (this.level > 0 && this.canBeRefunded(1)) {
            this.level -= 1; 
            this.boughtOrRefunded();
        }
    }
}

/**
 * Returns a formatted time string
 * @param {Number} time time in seconds
 * @returns {string}
 */
function getTimeString(time) {
  let mins = Math.floor(time / 60);
  let secs = time - 60 * mins;
  let hours = Math.floor(mins / 60);
  mins -= hours * 60;
  let days = Math.floor(hours / 24);
  hours -= days * 24;

  const hours_f = hours.toString().padStart(2, "0");
  const mins_f = mins.toString().padStart(2, "0");
  const secs_f = secs.toFixed(1).padStart(4, "0");

  if (days > 0) {
    return `${days}d ${hours_f}:${mins_f}:${secs_f}`;
  }
  else if (hours > 0) {
    return `${hours}:${mins_f}:${secs_f}`;
  }
  else {
    return `${mins}:${secs_f}`;
  }
}

/** 
 * Evaluates a polynomial at a given point. Inputs must be BigNumbers 
 * @param {BigNumber[]} poly Polynomial to be evaluated
 * @param {BigNumber} point
 */
var evalp = (poly, point) => {
    var res = ZERO;

    for (let i=0; i<poly.length; i++) {
        res += poly[i] * point.pow(i);
    }

    return res;
}

/** 
 * Computes the Riemann-Stieltjes integral from two polynomials 
 * @param {BigNumber[]} poly1
 * @param {BigNumber[]} poly2
 * @param {BigNumber} lBound
 * @param {BigNumber} hBound
 * @returns {BigNumber} Integral of poly1(X) * d(poly2(X)) between lBound and hBound
 * */
var rspInt = (poly1, poly2, lBound, hBound) => {
    var res = ZERO;

    for (let i=0; i<poly1.length; i++){
        for (let j=1; j<poly2.length; j++){
            res += BigNumber.from(j/(i+j)) * poly1[i] * poly2[j] * (hBound.pow(i+j) - lBound.pow(i+j))
        }
    }

    return res;
}


////////////
// Functions

/**
 * Switches the mode between alpha mode and rho mode
 */
var switchMode = () => {
    alphaMode = !alphaMode;

    currencyRho.value = ZERO;
    currencyAlpha.value = ZERO;

    a0.level = 0;
    a1.level = 0;
    a2.level = 0;
    b0.level = 0;
    b1.level = 0;

    a0a.level = 0;
    a1a.level = 0;
    a2a.level = 0;
    b0a.level = 0;
    b1a.level = 0;

    rhodot = ZERO;
    alphadot = ZERO;

    theory.invalidatePrimaryEquation();
    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
    theory.clearGraph();
    updateAvailability();
}

var init = () => {
    currencyRho = theory.createCurrency();
    currencyAlpha = theory.createCurrency("α", "\\alpha");

    ///////////////////
    // Regular Upgrades

    {
        let getDesc = (level) => `a_0=2^{${level}}`;
        let getInfo = (level) => `a_0=${getA0(level).toString(0)}`;

        a0 = theory.createUpgrade(1, currencyRho, a0Cost);
        a0.getDescription = (_) => Utils.getMath(getDesc(a0.level));
        a0.getInfo = (amount) => Utils.getMathTo(getInfo(a0.level), getInfo(a0.level + amount));

        a0a = theory.createUpgrade(21, currencyAlpha, a0aCost);
        a0a.getDescription = (_) => Utils.getMath(getDesc(a0a.level));
        a0a.getInfo = (amount) => Utils.getMathTo(getInfo(a0a.level), getInfo(a0a.level + amount));
    }

    {
        let getDesc = (level) => `a_1=2^{${level}}`;
        let getInfo = (level) => `a_1=${getA1(level).toString(0)}`;

        a1 = theory.createUpgrade(2, currencyRho, a1Cost);
        a1.getDescription = (_) => Utils.getMath(getDesc(a1.level));
        a1.getInfo = (amount) => Utils.getMathTo(getInfo(a1.level), getInfo(a1.level + amount));

        
        a1a = theory.createUpgrade(22, currencyAlpha, a1aCost);
        a1a.getDescription = (_) => Utils.getMath(getDesc(a1a.level));
        a1a.getInfo = (amount) => Utils.getMathTo(getInfo(a1a.level), getInfo(a1a.level + amount));
    }

    {
        let getDesc = (level) => `a_2=2^{${level}}`;
        let getInfo = (level) => `a_2=${getA2(level).toString(0)}`;

        a2 = theory.createUpgrade(3, currencyRho, a2Cost);
        a2.getDescription = (_) => Utils.getMath(getDesc(a2.level));
        a2.getInfo = (amount) => Utils.getMathTo(getInfo(a2.level), getInfo(a2.level + amount));

        
        a2a = theory.createUpgrade(23, currencyAlpha, a2aCost);
        a2a.getDescription = (_) => Utils.getMath(getDesc(a2a.level));
        a2a.getInfo = (amount) => Utils.getMathTo(getInfo(a2a.level), getInfo(a2a.level + amount));
    }

    {
        let getDesc = (level) => `b_0=${b0bases[b0baseMs.level]}^{${level}}-1`;
        let getInfo = (level) => `b_0=${getB0(level).toString(0)}`;

        b0 = theory.createUpgrade(11, currencyRho, b0Cost);
        b0.getDescription = (_) => Utils.getMath(getDesc(b0.level));
        b0.getInfo = (amount) => Utils.getMathTo(getInfo(b0.level), getInfo(b0.level + amount));
        
        b0a = theory.createUpgrade(31, currencyAlpha, b0aCost);
        b0a.getDescription = (_) => Utils.getMath(getDesc(b0a.level));
        b0a.getInfo = (amount) => Utils.getMathTo(getInfo(b0a.level), getInfo(b0a.level + amount));
    }

    {
        let getDesc = (level) => `b_1=2^{${level}}-1`;
        let getInfo = (level) => `b_1=${getB1(level).toString(0)}`;

        b1 = theory.createUpgrade(12, currencyRho, b1Cost);
        b1.getDescription = (_) => Utils.getMath(getDesc(b1.level));
        b1.getInfo = (amount) => Utils.getMathTo(getInfo(b1.level), getInfo(b1.level + amount));

        b1a = theory.createUpgrade(32, currencyAlpha, b1aCost);
        b1a.getDescription = (_) => Utils.getMath(getDesc(b1a.level));
        b1a.getInfo = (amount) => Utils.getMathTo(getInfo(b1a.level), getInfo(b1a.level + amount));
    }

    /////////////////////
    // Permanent Upgrades
    theory.createPublicationUpgrade(0, currencyAlpha, permaCosts[0]);
    //theory.createBuyAllUpgrade(1, currencyAlpha, permaCosts[1]);
    //theory.createAutoBuyerUpgrade(2, currencyAlpha, permaCosts[2]);

    ///////////////////////
    //// Milestone Upgrades

    {
        hTermMs = new CustomMilestoneUpgrade(0, 1);
        hTermMs.getDescription = (_) => Localization.getUpgradeAddTermDesc("b_1");
        hTermMs.getInfo = (_) => Localization.getUpgradeAddTermInfo("b_1");
        hTermMs.boughtOrRefunded = () => {
            theory.invalidateSecondaryEquation();
            updateAvailability();
        }
        hTermMs.canBeRefunded = (_) => b0baseMs.level === 0;
    }
    {
        b0baseMs = new CustomMilestoneUpgrade(1, 1);
        b0baseMs.getDescription = (_) => Localization.getUpgradeIncCustomDesc("b_0 \\text{ base}", `${
            b0baseMs.level < b0baseMs.maxLevel ? r5(b0bases[b0baseMs.level + 1] - b0bases[b0baseMs.level]) : 0
        }`)
        b0baseMs.getInfo = (_) => "$b_0$ base: " + (b0baseMs.level < b0baseMs.maxLevel 
            ? Utils.getMathTo(`${b0bases[b0baseMs.level]}`, `${b0bases[b0baseMs.level + 1]}`)
            : Utils.getMath(`${b0bases[b0baseMs.level]}`));
        b0baseMs.boughtOrRefunded = () => updateAvailability();
        b0baseMs.canBeRefunded = (_) => rhoUnlock.level === 0;
    }
    {
        rhoUnlock = new CustomMilestoneUpgrade(2, 1);
        rhoUnlock.getDescription = (_) => "Unlock $\\rho$";
        rhoUnlock.getInfo = (_) => "Unlock $\\rho$ and unlock the ability to swap the $k$ and $h$ in the integral";
        rhoUnlock.canBeRefunded = (_) => alphaMode;
    }

    ///////////////////
    //// Debug Upgrades

    {
        debugResetMilestonesUpgrade = theory.createPermanentUpgrade(500, currencyRho, new FreeCost);
        debugResetMilestonesUpgrade.description = "[Debug] reset milestones";
        debugResetMilestonesUpgrade.boughtOrRefunded = (_) => {
            debugResetMilestonesUpgrade.level = 0;
            for (let msUpgrade of milestoneArray) {
                msUpgrade.level = 0;
                msUpgrade.boughtOrRefunded();
                milestonesAvailable = 0;
                totalMilestonePoints = 0;
            }
        }
    }
    
    updateAvailability();
}

var updateAvailability = () => {
    // Upgrades
    for (var v of [a0,a1,a2,b0,b1]) {
        v.isAvailable = !alphaMode;
    }
    for (var v of [a0a,a1a,a2a,b0a,b1a]) {
        v.isAvailable = alphaMode;
    }

    a2.isAvailable &&= false;
    a2a.isAvailable &&= false;

    b1.isAvailable &&= hTermMs.level > 0;
    b1a.isAvailable &&= hTermMs.level > 0;

    b0baseMs.isAvailable = hTermMs.level > 0;
    rhoUnlock.isAvailable = b0baseMs.level > 0;
}

var tick = (elapsedTime, multiplier) => {
    const dt = elapsedTime * multiplier;
    const bonus = theory.publicationMultiplier;

    const va0 = getA0((alphaMode ? a0a : a0).level);
    const va1 = getA1((alphaMode ? a1a : a1).level);
    const va2 = getA2((alphaMode ? a2a : a2).level);

    const vb0 = getB0((alphaMode ? b0a : b0).level);
    const vb1 = getB1((alphaMode ? b1a : b1).level);

    let k = [va0, va1];

    let h = [vb0];
    if (hTermMs.level > 0) h.push(vb1);

    cur_h = evalp(h, PHI);
    maxh = maxh.max(cur_h);

    if (alphaMode) {
        const integral = rspInt(h, k, ZERO, PHI);
        alphadot = integral * bonus * multiplier;
        currencyAlpha.value += alphadot * elapsedTime;
    }
    else {
        const integral = rspInt(k, h, ZERO, PHI);
        rhodot = integral * bonus * multiplier;
        currencyRho.value += rhodot * elapsedTime;
    }

    if (totalMilestonePoints < milestoneCount 
        && getMilestoneThreshold() >= milestoneCosts[totalMilestonePoints]
    ) {
        totalMilestonePoints++;
        milestonesAvailable++;
    }
    
    theory.invalidateSecondaryEquation();
    theory.invalidateTertiaryEquation();
}

var postPublish = () => {
    currencyRho.value = ZERO;
    currencyAlpha.value = ZERO;
    maxh = ZERO;

    rhodot = ZERO;
    alphadot = ZERO;

    theory.invalidateSecondaryEquation();
}

var getInternalState = () => JSON.stringify({
    version,
    alphaMode,
    milestonesAvailable,
    totalMilestonePoints,
    maxh: maxh.toBase64String(),
    maxMilestoneThreshold: maxMilestoneThreshold.toBase64String()
})

var setInternalState = (stateStr) => {
    if (!stateStr) return;

    /**
     * @param {String} str 
     * @param {BigNumber} defaultValue
     */
    const parseBigNumBSF = (str, defaultValue) => (str ? BigNumber.fromBase64String(str) : defaultValue);

    const state = JSON.parse(stateStr);

    alphaMode = state.alphaMode ?? false;
    milestonesAvailable = state.milestonesAvailable ?? 0;
    totalMilestonePoints = state.totalMilestonePoints ?? 0;
    maxh = parseBigNumBSF(state.maxh, ZERO);
    maxMilestoneThreshold = parseBigNumBSF(state.maxMilestoneThreshold, ZERO);

}

/////
// UI

/** 
 * UI image size
 * @param {Number} width 
 */
var getImageSize = (width) => {
  if(width >= 1080)
    return 48;
  if(width >= 720)
    return 36;
  if(width >= 360)
    return 24;
  return 20;
}

var createSwitcherFrame = () => {
    let triggerable = true;
    let fontSize = Math.min(ui.screenWidth / 13, ui.screenHeight / 18);
    let targetWidth = 50;

    let label = ui.createLabel({
        margin: new Thickness(0, 0, 0, 0),
        padding: new Thickness(2, 0, 10, 10),
        text: "⇌",
        textColor: Color.TEXT_MEDIUM,
        fontAttributes: FontAttributes.BOLD,
        horizontalTextAlignment: TextAlignment.CENTER,
        verticalTextAlignment: TextAlignment.END,
        fontSize: fontSize,
        opacity: 0,
    })

    let adjustmentDone = false;
    label.onSizeChanged = () => {
        if (!adjustmentDone && label.width > 0) {
            label.fontSize = fontSize * targetWidth / label.width;
            label.opacity = 1;
            adjustmentDone = true;
        }
    };

    label.onTouched = (e) =>
    {
        if(e.type == TouchType.PRESSED)
        {
            label.opacity = 0.4;
        }
        else if(e.type.isReleased())
        {
            label.opacity = 1;
            if(triggerable)
            {
                Sound.playClick();
                createSwitcherMenu().show();
            }
            else
                triggerable = true;
        }
        else if(e.type == TouchType.MOVED && (e.x < 0 || e.y < 0 ||
        e.x > label.width || e.y > label.height))
        {
            label.opacity = 0.4;
            triggerable = false;
        }
    };

    return label;
}

const switcherFrame = createSwitcherFrame();

var getEquationOverlay = () =>
{
    let result = ui.createGrid
    ({
        columnDefinitions: ["1*", "3*", "1*"],
        columnSpacing: 0,
        inputTransparent: true,
        cascadeInputTransparent: false,
        children:
        [
            ui.createGrid
            ({
                row: 0, column: 0,
                isVisible: () => rhoUnlock.level > 0,
                margin: new Thickness(0,0,2,0),
                horizontalOptions: LayoutOptions.START,
                verticalOptions: LayoutOptions.START,
                inputTransparent: true,
                cascadeInputTransparent: false,
                children:
                [
                    switcherFrame
                ]
            }),

            ui.createImage({
                useTint: false,
                source: ImageSource.ARROW_90,
                widthRequest: getImageSize(ui.screenWidth),
                heightRequest: getImageSize(ui.screenWidth),
                aspect: Aspect.ASPECT_FILL,
                margin: new Thickness(0,18,10,0),
                onTouched: (e) => {
                if (e.type.isReleased()) {
                    milestoneInfoPressed = false;
                    createMilestoneMenu().show();
                }
                },
                isVisible: true,
                row: 0,
                column: 2,
                horizontalOptions: LayoutOptions.END,
                verticalOptions: LayoutOptions.START,
            }),
        ]
    });
    return result;
}

var createSwitcherMenu = () => {
    let menu = ui.createPopup({
        title: "Switch Mode",
        isPeekable: true,
        content: ui.createStackLayout({
            children: [
                ui.createLatexLabel({
                    margin: new Thickness(0, 0, 0, 6),
                    text: () => {
                        const newcurrency = Utils.getMath(alphaMode ? "\\rho" : "\\alpha")
                        return `Swap $h$ and $k$ in the integral and switch the currency to ${newcurrency}.`;
                    },
                    horizontalTextAlignment: TextAlignment.CENTER,
                    verticalTextAlignment: TextAlignment.CENTER
                }),
                ui.createLatexLabel({
                    margin: new Thickness(0, 0, 0, 6),
                    text: "Your currencies and levels are reset"+
                    " but $\\max{h(\\phi)}$ is kept.",
                    horizontalTextAlignment: TextAlignment.CENTER,
                    verticalTextAlignment: TextAlignment.CENTER
                }),
                ui.createButton
                ({
                    margin: new Thickness(0, 0, 0, 6),
                    text: () => "Switch Now",
                    onReleased: () => { 
                        switchMode(),
                        menu.hide()
                    }
                })
            ]
        })
    })

    return menu;
}

/**
 * Creates the UI for a milestone upgrade
 * @param {CustomMilestoneUpgrade} milestone 
 * @returns 
 */
var createMilestoneUpgradeUI = (milestone) => {
    let refund_button_pressed = false;
    let refund_button_triggerable = true;
    let frame_triggerable = true;

    let isMilestoneBuyable = () => milestone.level < milestone.maxLevel && milestonesAvailable > 0;

    let refundButton = ui.createImage({
        useTint: false,
        opacity: () => (milestone.canBeRefunded(1) && !refund_button_pressed) ? 0.5 : 0.2,
        source: ImageSource.REFUND,
        widthRequest: getImageSize(ui.screenWidth),
        heightRequest: getImageSize(ui.screenWidth),
        aspect: Aspect.ASPECT_FILL,
        margin: new Thickness(0,0,0,0),
        isVisible: true,
        horizontalOptions: LayoutOptions.END,
        verticalOptions: LayoutOptions.CENTER,
    });

    refundButton.onTouched = (e) =>
    {
        if(!milestone.canBeRefunded(1)) {
            return;
        }
        if(e.type == TouchType.PRESSED)
        {
            refund_button_pressed = true;
        }
        else if(e.type.isReleased())
        {
            refund_button_pressed = false;
            if(refund_button_triggerable)
            {
                Sound.playClick();
                milestone.refund();
                milestonesAvailable++;
            }
            else
                refund_button_triggerable = true;
        }
        else if(e.type == TouchType.MOVED && (e.x < 0 || e.y < 0 ||
        e.x > refundButton.width || e.y > refundButton.height))
        {
            refund_button_pressed = true;
            refund_button_triggerable = false;
        }
    };

    let frame = ui.createFrame({
        horizontalOptions: LayoutOptions.FILL_AND_EXPAND,
        verticalOptions: LayoutOptions.FILL_AND_EXPAND,
        widthRequest: ui.screenWidth,
        heightRequest: Math.round(ui.screenHeight / 13),
        content: ui.createGrid({
            columnDefinitions: ["*", "auto"],
            inputTransparent: true,
            cascadeInputTransparent: true,
            children: [
                ui.createLatexLabel({
                    opacity: () => isMilestoneBuyable() ? 1 : 0.5,
                    margin: new Thickness(10,3,0,0),
                    text: () => milestoneInfoPressed ? milestone.getInfo(1) : milestone.getDescription(1),
                    verticalOptions: LayoutOptions.CENTER,
                    row: 0,
                    column: 0,
                }),
                ui.createLatexLabel({
                    opacity: () => isMilestoneBuyable() ? 1 : 0.5,
                    fontSize: 11,
                    margin: new Thickness(0,0,8,8),
                    text: () => Utils.getMath(`${milestone.level}/${milestone.maxLevel}`),
                    verticalOptions: LayoutOptions.END,
                    row: 0,
                    column: 1,
                }),
            ]
        })
    })

    frame.onTouched = (e) =>
    {
        if (!isMilestoneBuyable()) {
            return;
        }
        if(e.type == TouchType.PRESSED)
        {
            frame.opacity = 0.4;
        }
        else if(e.type.isReleased())
        {
            frame.opacity = 1;
            if(frame_triggerable)
            {
                Sound.playClick();
                milestone.buy();
                milestonesAvailable--;
            }
            else
                frame_triggerable = true;
        }
        else if(e.type == TouchType.MOVED && (e.x < 0 || e.y < 0 ||
        e.x > frame.width || e.y > frame.height))
        {
            frame.opacity = 0.4;
            frame_triggerable = false;
        }
    };

    return ui.createStackLayout({
        orientation: StackOrientation.HORIZONTAL,
        horizontalOptions: LayoutOptions.START_AND_EXPAND,
        margin: new Thickness(0,2,0,0),
        isVisible: () => milestone.isAvailable,
        children: [
            refundButton,
            frame
        ]
    })
}

var createMilestoneMenu = () => {
    let info_button_pressed = false;

    let infoButton = ui.createImage({
        useTint: false,
        opacity: () => info_button_pressed ? 0.5 : 1,
        source: ImageSource.INFO,
        widthRequest: getImageSize(ui.screenWidth),
        heightRequest: getImageSize(ui.screenWidth),
        aspect: Aspect.ASPECT_FILL,
        margin: new Thickness(0,0,0,0),
        isVisible: true,
        horizontalOptions: LayoutOptions.END,
        verticalOptions: LayoutOptions.CENTER,
        column: 1
    });

    infoButton.onTouched = (e) =>
    {
        if(e.type == TouchType.PRESSED)
        {
            info_button_pressed = true;
            milestoneInfoPressed = true;
        }
        else if(e.type.isReleased())
        {
            info_button_pressed = false;
            milestoneInfoPressed = false;
        }
        else if(e.type == TouchType.MOVED && (e.x < 0 || e.y < 0 ||
        e.x > infoButton.width || e.y > infoButton.height))
        {
            info_button_pressed = true;
            milestoneInfoPressed = true;
        }
    };

    let menu = ui.createPopup({
        title: Localization.get("PublicationPopupMilestones"),
        content: ui.createStackLayout({
            children: [
                // Threshold formula
                ui.createLatexLabel({
                    margin: new Thickness(0, 0, 0, 6),
                    text: Utils.getMath("T = f(\\tau, \\max{h})"),
                    horizontalTextAlignment: TextAlignment.CENTER,
                    verticalTextAlignment: TextAlignment.CENTER
                }),
                // Current threshold
                ui.createLatexLabel({
                    margin: new Thickness(0, 0, 0, 8),
                    text: () => Utils.getMath(`T = ${getMilestoneThreshold()}`),
                    horizontalTextAlignment: TextAlignment.CENTER,
                    verticalTextAlignment: TextAlignment.CENTER
                }),
                // Next threshold cost
                ui.createLatexLabel({
                    margin: new Thickness(0, 0, 0, 6),
                    text: () => totalMilestonePoints < milestoneCount 
                        ? Localization.format(
                            Localization.get("PublicationPopupMileDesc"), 
                            Utils.getMath(`T = ${milestoneCosts[totalMilestonePoints]}`)
                        )
                        : Localization.get("PublicationPopupMileDone"),
                    horizontalTextAlignment: TextAlignment.CENTER,
                    verticalTextAlignment: TextAlignment.CENTER
                }),
                // Upgrades left
                ui.createLatexLabel({
                    margin: new Thickness(0, 0, 0, 6),
                    fontSize: 12,
                    text: () => Localization.format(Localization.get("PublicationPopupMileLeft"), milestonesAvailable),
                    horizontalTextAlignment: TextAlignment.CENTER,
                    verticalTextAlignment: TextAlignment.CENTER
                }),
                // Info button
                ui.createGrid({
                    columnDefinitions: ["*", "auto", "*"],
                    horizontalOptions: LayoutOptions.FILL_AND_EXPAND,
                    widthRequest: ui.screenWidth,
                    children: [
                        infoButton
                    ]
                }),
                // Milestone list
                ui.createScrollView({
                    content: ui.createStackLayout({
                        children: [
                            ...milestoneArray.map((upg) => createMilestoneUpgradeUI(upg)),
                        ]
                    })
                })
            ]
        })
    })

    return menu;
}

/**
 * 0 is for rho, 1 is for alpha
 * @param {Number} index 
 * @returns 
 */
var isCurrencyVisible = (index) => !(index ^ alphaMode);

var getPrimaryEquation = () => {
    let result = ``;

    theory.primaryEquationHeight = 100
    theory.primaryEquationScale = 1.25

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

    theory.secondaryEquationHeight = 100;
    theory.secondaryEquationScale = 1.25;

    let k = "{a_1}x + a_0";

    let h = "b_0";
    if (hTermMs.level > 0) h = "{b_1}x + " + h;

    result += `k(x) = ${k}\\\\h(x) = ${h}\\\\`;
    if (alphaMode) {
        result += `\\dot{\\alpha} = ${alphadot.toString()}`;
    }
    else {
        result += `\\dot{\\rho} = ${rhodot.toString()}`;
    }

    if (rhoUnlock.level === 0) result += `\\\\${theory.latexSymbol}=\\max{(h(\\phi))^{${maxhExponent}}}`
    else result += `\\\\${theory.latexSymbol}=\\max{\\rho^{${rhoExponent}}} \\times \\max{(h(\\phi))^{${maxhExponent}}}`;

    return result;
}

var getTertiaryEquation = () => {
    let result = ``;

    result += `h(\\phi)=${cur_h}, \\max{h(\\phi)} = ${maxh}`;
    if (!alphaMode) {
        result += `\\\\ \\max{\\rho^{${rhoExponent}}} \\times \\max{(h(\\phi))^{${maxhExponent}}} = ${getTau()}`;
    }

    return result;
}

var get2DGraphValue = () => alphaMode ?
    currencyAlpha.value.sign * (BigNumber.ONE + currencyAlpha.value.abs()).log10().toNumber()
    : currencyRho.value.sign * (BigNumber.ONE + currencyRho.value.abs()).log10().toNumber()

init();