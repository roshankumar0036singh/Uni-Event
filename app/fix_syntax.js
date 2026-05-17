const fs = require('fs');
const path = require('path');

const filePath = path.join('node_modules', 'is-generator-function', 'index.js');

try {
    let content = fs.readFileSync(filePath, 'utf8');
    console.log('Reading file...');

    // The error resulted in: var getGeneratorFunction = var generatorFunction = ...
    // We want to verify this exists and replace it.

    if (content.includes('var generatorFunction = (function(){')) {
        // We found my previous patch.
        // If it caused "var getGeneratorFunction = var generatorFunction =", we fix it.

        // Regex to fix: "var \w+ = var generatorFunction =" -> "var \w+ ="
        // Or simpler: just replace "var generatorFunction =" with nothing if it follows an assignment?

        // Let's be specific to the error message shown.
        const badString = 'var getGeneratorFunction = var generatorFunction =';
        const fixedString = 'var getGeneratorFunction =';

        if (content.includes(badString)) {
            content = content.replace(badString, fixedString);
            fs.writeFileSync(filePath, content);
            console.log('SUCCESS: Fixed double var declaration syntax error.');
        } else {
            // Maybe the variable name is different?
            // The error log showed: "var getGeneratorFunction = var generatorFunction ="

            // Let's try reset the file entirely to a working state if simple fix fails.
            // This is a known simple library.
            const workingCode = `'use strict';

var toStr = Object.prototype.toString;
var fnToStr = Function.prototype.toString;
var isFnRegex = /^\s*(?:function)?\*/;
var hasToStringTag = typeof Symbol === 'function' && typeof Symbol.toStringTag === 'symbol';
var getProto = Object.getPrototypeOf;

var getGeneratorFunc = function () { // eslint-disable-line consistent-return
	if (!hasToStringTag) {
		return false;
	}
	try {
        // INLINED GENERATOR FUNCTION CONSTRUCTOR
		return Function('return function*() {}')().constructor;
	} catch (e) {
	}
};
var generatorFunc = getGeneratorFunc();
var GeneratorFunction = generatorFunc ? Object.getPrototypeOf(generatorFunc) : false;

module.exports = function isGeneratorFunction(fn) {
	if (typeof fn !== 'function') {
		return false;
	}
	if (isFnRegex.test(fnToStr.call(fn))) {
		return true;
	}
	if (!hasToStringTag) {
		var str = toStr.call(fn);
		return str === '[object GeneratorFunction]';
	}
	if (!getProto) {
		return false;
	}
	return getProto(fn) === GeneratorFunction;
};
`;
            console.log(
                'Could not find exact string match, overwriting file with clean working version.',
            );
            fs.writeFileSync(filePath, workingCode);
        }
    } else {
        console.log('File does not seem to contain the expected patch content. taking no action.');
    }
} catch (e) {
    console.error('Error fixing syntax:', e);
}
