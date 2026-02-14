import React, { useState, useRef } from 'react';
import { MessageCircle, X } from 'lucide-react';

export default function ChatBubble({ isOpen, onToggle }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.current.x;
    const newY = e.clientY - dragStart.current.y;
    
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = (e) => {
    if (isDragging) {
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - dragStart.current.x - position.x, 2) +
        Math.pow(e.clientY - dragStart.current.y - position.y, 2)
      );
      
      if (dragDistance < 5) {
        onToggle();
      }
      
      setIsDragging(false);
    }
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  return (
    <button
      onMouseDown={handleMouseDown}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 text-white shadow-2xl shadow-purple-500/50 hover:shadow-2xl hover:scale-110 transition-all duration-300"
    >
      {isOpen ? (
        <X className="w-6 h-6" />
      ) : (
        <MessageCircle className="w-6 h-6" />
      )}
    </button>
  );
}