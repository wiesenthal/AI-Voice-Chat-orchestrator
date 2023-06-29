import React, { useState } from 'react';
import './App.css';
import TalkToIt from './components/TalkToIt';
import LogInScreen from './components/LogInScreen';

function App() {
  const [user, setUser] = useState(null);

  return (
    <div className="App">
      {
    user ?
      <TalkToIt user={user}/>
      :
      <LogInScreen user={user} setUser={setUser} />
      }
    </div>
  )
}

export default App;
