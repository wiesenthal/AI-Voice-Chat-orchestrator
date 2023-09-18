export function prepareTranscriptsAndResponses(transcripts, responses) {
    const transcriptsAndResponses = [];

    let transcriptIndex = 0;
    let responseIndex = 0;

    // merge transcripts and responses
    while (transcriptIndex < transcripts.length || responseIndex < responses.length)
    {
        if (transcriptIndex >= transcripts.length)
        {
            let response = responses[responseIndex];
            response.messageType = 'response';
            transcriptsAndResponses.push(response);
            responseIndex++;
            continue;
        }

        if (responseIndex >= responses.length)
        {
            let transcript = transcripts[transcriptIndex];
            transcript.messageType = 'transcript';
            transcriptsAndResponses.push(transcript);
            transcriptIndex++;
            continue;
        }

        let transcript = transcripts[transcriptIndex];
        let response = responses[responseIndex];

        if (transcript.timestamp < response.timestamp)
        {
            transcript.messageType = 'transcript';
            transcriptsAndResponses.push(transcript);
            transcriptIndex++;
        }
        else
        {
            response.messageType = 'response';
            transcriptsAndResponses.push(response);
            responseIndex++;
        }
    }
    
    console.log(transcriptsAndResponses);

    return transcriptsAndResponses;
}