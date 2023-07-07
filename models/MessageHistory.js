// This class should store and manage the message history for the orchestrator
class MessageHistory {
    constructor() {
        this.message_history = [];
    }
    setMessage(role, id, content) {
        role = role.toLowerCase();
        var index = this.message_history.findIndex((element) => {
            return element.id == id && element.role.toLowerCase() == role;
        });
        if (index == -1)
            this.message_history.push({ role: role, id: id, content: content });
        else
            this.message_history[index].content = content;
    }
    getGPTFormattedMessages() {
        var gpt_formatted_messages = this.message_history.map((element) => {
            return { role: element.role.toLowerCase(), content: element.content };
        });
        return gpt_formatted_messages;
    }
}

export default MessageHistory;