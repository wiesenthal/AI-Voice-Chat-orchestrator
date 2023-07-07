export function streamAudio(socket, users) {
    socket.on('streamAudio', (audioData) => {
      // Your streamAudio logic here...
    });
  }
  
export function startAudio(socket, users) {
socket.on('startAudio', async () => {
    // Your startAudio logic here...
});
}