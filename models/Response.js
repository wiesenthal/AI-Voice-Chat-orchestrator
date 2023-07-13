// simple class which stores the words and unreadWords, contains shoudRead function
class Response {
    constructor() {
        this.words = "";
        this.unreadWords = "";
    }

    shouldRead() {
        // check if text ends with a comma or a punctuation mark
        // if it does, return true
        // else return false
        const punctuation = [',', '.', '?', '!', ":", ";", "-", "\"", "'", ")", "]", "}", "…"];
        const lastChar = this.unreadWords.trim()[this.unreadWords.trim().length - 1];

        return punctuation.includes(lastChar);
    }

    addWord(word) {
        this.words += word;
        this.unreadWords += word;
    }

    clearUnreadWords() {
        this.unreadWords = "";
    }

    getWords() {
        return this.words;
    }

    getUnreadWords() {
        return this.unreadWords;
    }

    getFormattedWords(commandID) {
        return {
            "words": this.words,
            "responseId": commandID
        }
    }
}

export default Response;