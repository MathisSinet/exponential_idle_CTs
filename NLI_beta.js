import { BigNumber, parseBigNumber } from '../api/BigNumber';
import { theory, QuaternaryEntry } from "../api/Theory";
import { Localization } from "../api/Localization";
import { ExponentialCost, FirstFreeCost, FreeCost } from '../api/Costs';
import { Utils } from '../api/Utils';
import { log } from 'winjs';
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

///////////////
// Declarations

const PHI = BigNumber.from((1 + Math.sqrt(5))/2);
const ZERO = BigNumber.ZERO;
const ONE = BigNumber.ONE;

var alphaMode = false;

let maxh = ZERO;

// Currencies
var currencyRho;
var currencyAlpha;

// Upgrades
var a0, a1, a2;
var b0, b1;
var a0a, a1a, a2a;
var b0a, b1a;

// UI
var rhodot = ZERO;
var alphadot = ZERO;
var cur_h = ZERO;

//////////
// Balance

const pubMultExp = 0.1;
const rhoExponent = 0.2;
const maxhExponent = 0.2;

const permaCosts = [
    1e8,
    1e5,
    1e5
]

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
var getB0 = (level) => BigNumber.TWO.pow(level) - ONE;

const b1Cost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
const b1aCost = new FirstFreeCost(new ExponentialCost(10, Math.log2(1.01)));
var getB1 = (level) => BigNumber.TWO.pow(level) - ONE;

var getPublicationMultiplier = (tau) => tau.pow(pubMultExp);

var getPublicationMultiplierFormula = (symbol) => `{${symbol}}^{${pubMultExp}}`;

var getTau = () => currencyRho.value.pow(rhoExponent) * maxh.pow(maxhExponent);

//var getCurrencyFromTau = (tau) => [value, symbol];

////////
// Utils

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

        a0a = theory.createUpgrade(11, currencyAlpha, a0aCost);
        a0a.getDescription = (_) => Utils.getMath(getDesc(a0a.level));
        a0a.getInfo = (amount) => Utils.getMathTo(getInfo(a0a.level), getInfo(a0a.level + amount));
    }

    {
        let getDesc = (level) => `a_1=2^{${level}}`;
        let getInfo = (level) => `a_1=${getA1(level).toString(0)}`;

        a1 = theory.createUpgrade(2, currencyRho, a1Cost);
        a1.getDescription = (_) => Utils.getMath(getDesc(a1.level));
        a1.getInfo = (amount) => Utils.getMathTo(getInfo(a1.level), getInfo(a1.level + amount));

        
        a1a = theory.createUpgrade(12, currencyAlpha, a1aCost);
        a1a.getDescription = (_) => Utils.getMath(getDesc(a1a.level));
        a1a.getInfo = (amount) => Utils.getMathTo(getInfo(a1a.level), getInfo(a1a.level + amount));
    }

    {
        let getDesc = (level) => `a_2=2^{${level}}`;
        let getInfo = (level) => `a_2=${getA2(level).toString(0)}`;

        a2 = theory.createUpgrade(3, currencyRho, a2Cost);
        a2.getDescription = (_) => Utils.getMath(getDesc(a2.level));
        a2.getInfo = (amount) => Utils.getMathTo(getInfo(a2.level), getInfo(a2.level + amount));

        
        a2a = theory.createUpgrade(13, currencyAlpha, a2aCost);
        a2a.getDescription = (_) => Utils.getMath(getDesc(a2a.level));
        a2a.getInfo = (amount) => Utils.getMathTo(getInfo(a2a.level), getInfo(a2a.level + amount));
    }

    {
        let getDesc = (level) => `b_0=2^{${level}}-1`;
        let getInfo = (level) => `b_0=${getB0(level).toString(0)}`;

        b0 = theory.createUpgrade(4, currencyRho, b0Cost);
        b0.getDescription = (_) => Utils.getMath(getDesc(b0.level));
        b0.getInfo = (amount) => Utils.getMathTo(getInfo(b0.level), getInfo(b0.level + amount));
        
        b0a = theory.createUpgrade(14, currencyAlpha, b0aCost);
        b0a.getDescription = (_) => Utils.getMath(getDesc(b0a.level));
        b0a.getInfo = (amount) => Utils.getMathTo(getInfo(b0a.level), getInfo(b0a.level + amount));
    }

    {
        let getDesc = (level) => `b_1=2^{${level}}-1`;
        let getInfo = (level) => `b_1=${getB1(level).toString(0)}`;

        b1 = theory.createUpgrade(5, currencyRho, b1Cost);
        b1.getDescription = (_) => Utils.getMath(getDesc(b1.level));
        b1.getInfo = (amount) => Utils.getMathTo(getInfo(b1.level), getInfo(b1.level + amount));

        b1a = theory.createUpgrade(15, currencyAlpha, b1aCost);
        b1a.getDescription = (_) => Utils.getMath(getDesc(b1a.level));
        b1a.getInfo = (amount) => Utils.getMathTo(getInfo(b1a.level), getInfo(b1a.level + amount));
    }

    /////////////////////
    // Permanent Upgrades
    theory.createPublicationUpgrade(0, currencyRho, permaCosts[0]);
    //theory.createBuyAllUpgrade(1, currencyRho, permaCosts[1]);
    //theory.createAutoBuyerUpgrade(2, currencyRho, permaCosts[2]);

    ///////////////////////
    //// Milestone Upgrades

    
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
}

var tick = (elapsedTime, multiplier) => {
    const dt = elapsedTime * multiplier;
    const bonus = theory.publicationMultiplier;

    const va0 = getA0((alphaMode ? a0a : a0).level);
    const va1 = getA1((alphaMode ? a1a : a1).level);
    const va2 = getA2((alphaMode ? a2a : a2).level);

    const vb0 = getB0((alphaMode ? b0a : b0).level);
    const vb1 = getB1((alphaMode ? b1a : b1).level);

    const k = [va0, va1, va2];
    const h = [vb0, vb1];

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
    maxh: maxh.toBase64String()
})

var setInternalState = (stateStr) => {
    if (!stateStr) return;

    const state = JSON.parse(stateStr);

    alphaMode = state.alphaMode ?? false;
    maxh = BigNumber.fromBase64String(state.maxh ?? ZERO.toBase64String());
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

var createMilestoneUpgradeUI = () => {
    return ui.createStackLayout({
        orientation: StackOrientation.HORIZONTAL,
        horizontalOptions: LayoutOptions.START_AND_EXPAND,
        margin: new Thickness(0,2,0,0),
        children: [
            ui.createImage({
                useTint: false,
                opacity: 0.5,
                source: ImageSource.REFUND,
                widthRequest: getImageSize(ui.screenWidth),
                heightRequest: getImageSize(ui.screenWidth),
                aspect: Aspect.ASPECT_FILL,
                margin: new Thickness(0,0,0,0),
                onTouched: (e) => {
                if (e.type.isReleased()) {
                    log("refund");
                }
                },
                isVisible: true,
                horizontalOptions: LayoutOptions.END,
                verticalOptions: LayoutOptions.CENTER,
            }),
            ui.createFrame({
                horizontalOptions: LayoutOptions.FILL_AND_EXPAND,
                verticalOptions: LayoutOptions.FILL_AND_EXPAND,
                widthRequest: ui.screenWidth,
                heightRequest: Math.round(ui.screenHeight / 13),
                content:
                ui.createLatexLabel({
                    opacity: 0.8,
                    margin: new Thickness(8,3,0,0),
                    text: Utils.getMath("x = \\text{dummy}"),
                    verticalOptions: LayoutOptions.CENTER
                })
            })
            
        ]
    })
}

var createMilestoneMenu = () => {
    let menu = ui.createPopup({
        title: Localization.get("PublicationPopupMilestones"),
        content: ui.createStackLayout({
            children: [
                ui.createLatexLabel({
                    margin: new Thickness(0, 0, 0, 6),
                    text: Utils.getMath("T = f(\\tau, \\max{h})"),
                    horizontalTextAlignment: TextAlignment.CENTER,
                    verticalTextAlignment: TextAlignment.CENTER
                }),
                ui.createLatexLabel({
                    margin: new Thickness(0, 0, 0, 6),
                    text: Utils.getMath("T = 0"),
                    horizontalTextAlignment: TextAlignment.CENTER,
                    verticalTextAlignment: TextAlignment.CENTER
                }),
                ui.createLatexLabel({
                    margin: new Thickness(0, 0, 0, 6),
                    text: Localization.format(Localization.get("PublicationPopupMileDesc"), Utils.getMath("T=10")),
                    horizontalTextAlignment: TextAlignment.CENTER,
                    verticalTextAlignment: TextAlignment.CENTER
                }),
                ui.createScrollView({
                    content: ui.createStackLayout({
                        children: [
                            createMilestoneUpgradeUI(),
                            createMilestoneUpgradeUI()
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

    result += `k(x) = {a_2}x^2 + {a_1}x + a_0\\\\h(x) = {b_1}x + b_0\\\\`;
    if (alphaMode) {
        result += `\\dot{\\alpha} = ${alphadot.toString()}`;
    }
    else {
        result += `\\dot{\\rho} = ${rhodot.toString()}`;
    }

    result += `\\\\${theory.latexSymbol}=\\max{\\rho^{${rhoExponent}}} \\times \\max{(h(\\phi))^{${maxhExponent}}}`;

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