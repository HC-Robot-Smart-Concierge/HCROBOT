import { useState, useEffect, useRef } from 'react';

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const shouldListenRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        if (currentTranscript.trim()) {
          setTranscript(currentTranscript);
        }
      };

      recognition.onerror = (event) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setError(event.error);
        }
      };

      recognition.onend = () => {
        if (shouldListenRef.current) {
          setTimeout(() => {
            if (shouldListenRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
                setIsListening(true);
                isListeningRef.current = true;
              } catch (e) {
                // Ignore if already started
              }
            }
          }, 150);
        } else {
          setIsListening(false);
          isListeningRef.current = false;
        }
      };

      recognitionRef.current = recognition;
    } else {
      setError('Browser does not support Web Speech API');
    }
  }, []);

  const startListening = (language = 'vi-VN') => {
    if (recognitionRef.current) {
      setError(null);
      setTranscript('');
      shouldListenRef.current = true;
      recognitionRef.current.lang = language === 'English' ? 'en-US' : 'vi-VN';
      try {
        if (!isListeningRef.current) {
          recognitionRef.current.start();
          setIsListening(true);
          isListeningRef.current = true;
        }
      } catch (err) {
        setIsListening(true);
        isListeningRef.current = true;
      }
    }
  };

  const stopListening = () => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // Ignored
      }
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  const resetTranscript = () => {
    setTranscript('');
  };

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    hasSupport: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };
};

