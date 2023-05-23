const shouldRead = (text) => {
    // check if text ends with a comma or a punctuation mark
    // if it does, return true
    // else return false
    const punctuation = [',', '.', '?', '!', ":", ";", "-"];
    const lastChar = text[text.length - 1];
    return punctuation.includes(lastChar);
}

exports.shouldRead = shouldRead;