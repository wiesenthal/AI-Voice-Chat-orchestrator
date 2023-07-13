import React, { useEffect, useState, useRef } from 'react';

import './ListenButton.css';


const ListenButton = ({ onStartListening, onStopListening }) => {
  //const [isActive, setIsActive] = useState(false);
  // make this a state and a ref so that we can use it in the useEffect
  const [isActive, _setIsActive] = useState(false);
  const isActiveRef = useRef(isActive);
  const setIsActive = (data) => {
    isActiveRef.current = data;
    _setIsActive(data); 
  };

  const handleStartEvent = (event) => {
    event.preventDefault();
    if (!isActiveRef.current) {
      console.log('starting listening');
      onStartListening();
      setIsActive(true);
    }
  };

  const handleStopEvent = (event) => {
    event.preventDefault();
    if (isActiveRef.current) {
      onStopListening();
      setIsActive(false);
    }
  };


  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space') {
        handleStartEvent(event);
      }
    };

    const handleKeyUp = (event) => {
      if (event.code === 'Space') {
        handleStopEvent(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [onStartListening, onStopListening]);

  return (
    <div
      id="listen"
      className={isActive ? 'active' : ''}
      onMouseDown={handleStartEvent}
      onMouseUp={handleStopEvent}
      onTouchStart={handleStartEvent}
      onTouchEnd={handleStopEvent}
    >
      <h1>Listen</h1>
    </div>
  );
};

export default ListenButton;
