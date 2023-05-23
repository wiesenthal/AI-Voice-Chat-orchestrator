userIDTimestampMap = {};

const timeDiffThreshold = 2000;

const shouldRespond = (data) => {
    return data.final;
}

exports.shouldRespond = shouldRespond;