import React, { useState } from 'react';
import './App.css';
import TalkToIt from './components/TalkToIt';
import LogInScreen from './components/LogInScreen';

function App() {
  const [isLoggedIn, setLoggedIn] = useState(false);

  return (
    <div className="App">
      {
    isLoggedIn ?
      <TalkToIt/>
      :
      <LogInScreen isLoggedIn={isLoggedIn} setLoggedIn={setLoggedIn} />
      }
    </div>
  )
}

export default App;
