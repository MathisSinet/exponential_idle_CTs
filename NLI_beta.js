import { BigNumber } from '../api/BigNumber';
import { theory, QuaternaryEntry } from "../api/Theory";
import { Localization } from "../api/Localization";

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

// Declarations


// Balance



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



// Functions

var init = () => {

}

var updateAvailability = () => {

}

var tick = () => {

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

// UI

var getPrimaryEquation = () => {
    let result = ``;

    theory.primaryEquationHeight = 130

    result += `\\int_{0}^{\\pi}{g(x)dh(x)}`

    return result;
}

var getSecondaryEquation = () => {
    let result = ``;

    return result;
}

var getTertiaryEquation = () => {
    let result = ``;

    return result;
}

var get2DGraphValue = () => {
    return 0;
}

init();