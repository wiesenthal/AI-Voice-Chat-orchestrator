import React, { useEffect, useState } from 'react';

const ListenButton = ({ onStartListening, onStopListening }) => {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        onStartListening();
        setIsActive(true);
      }
    };

    const handleKeyUp = (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        onStopListening();
        setIsActive(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [onStartListening, onStopListening]);

  const handleMouseDown = (event) => {
    event.preventDefault();
    onStartListening();
    setIsActive(true);
  };

  const handleMouseUp = (event) => {
    event.preventDefault();
    onStopListening();
    setIsActive(false);
  };

  const handleTouchStart = (event) => {
    event.preventDefault();
    onStartListening();
    setIsActive(true);
  };

  const handleTouchEnd = (event) => {
    event.preventDefault();
    onStopListening();
    setIsActive(false);
  };

  return (
    <div
      id="listen"
      className={isActive ? 'active' : ''}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <h1>Listen</h1>
    </div>
  );
};

export default ListenButton;
