import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { HOMOPHONE_MAP } from '@/data/homonyms';

// Add Web Speech API type definitions
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
    speechRecognition: SpeechRecognition | null;
  }
}

// Define the SpeechRecognition interface
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (event: Event) => void;
  onend: (event: Event) => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionProps {
  onResult: (transcript: string, alternatives?: Array<{ transcript: string; confidence: number }>) => void;
  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
  addStatus?: (msg: string) => void;
}

const SpeechRecognition: React.FC<SpeechRecognitionProps> = ({ 
  onResult, 
  isListening, 
  setIsListening,
  isProcessing,
  setIsProcessing,
  addStatus
}) => {
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastTranscript, setLastTranscript] = useState<string>('');
  const [recognitionInstance, setRecognitionInstance] = useState<SpeechRecognition | null>(null);

  // For short word auto-finalization
  const interimTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastInterim = useRef<string | null>(null);
  const lastAlternatives = useRef<any[]>([]);
  const hasProcessedAnswer = useRef<boolean>(false);

  // Use a ref for guarding result processing
  const isHandlingResultRef = useRef(false);

  const getMicrophoneButtonClass = () => {
    if (isProcessing) {
      return "bg-gray-400 hover:bg-gray-500 text-white cursor-not-allowed";
    } else if (isListening) {
      return "bg-red-500 hover:bg-red-600 text-white";
    } else {
      return "bg-green-500 hover:bg-green-600 text-white";
    }
  };

  const stopRecognition = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (recognitionInstance) {
        try {
          recognitionInstance.stop();
          setRecognitionInstance(null);
          window.speechRecognition = null;
          addStatus?.("Recognition stopped.");
        } catch (error) {
          console.error('Error stopping recognition:', error);
          addStatus?.("Error stopping recognition.");
        }
      }
      setIsListening(false);
      setTimeout(resolve, 100);
    });
  }, [recognitionInstance, setIsListening, addStatus]);

  const processTranscript = async (transcript: string, alternatives: Array<{ transcript: string; confidence: number }>) => {
    if (hasProcessedAnswer.current) return;
    hasProcessedAnswer.current = true;
    addStatus?.(`Processing transcript: "${transcript}"`);
    setIsProcessing(true);
    setIsListening(false);
    try {
      const normalizedTranscript = transcript.trim().toLowerCase();
      addStatus?.(`Normalized transcript: "${normalizedTranscript}"`);
      onResult(normalizedTranscript, alternatives);
      addStatus?.("Called onResult with transcript.");
      await new Promise(resolve => setTimeout(resolve, 500));
      addStatus?.("Processing complete (waited 500ms for UI feedback).");
    } catch (error) {
      console.error('Error processing transcript:', error);
      setErrorMessage('Error processing speech. Please try again.');
      addStatus?.("Error processing transcript.");
    } finally {
      setIsProcessing(false);
      setIsListening(false);
      if (recognitionInstance) {
        try {
          recognitionInstance.stop();
          setRecognitionInstance(null);
          window.speechRecognition = null;
          addStatus?.("Recognition stopped after processing.");
        } catch (error) {
          console.error('Error stopping recognition:', error);
          addStatus?.("Error stopping recognition in finally.");
        }
      }
      isHandlingResultRef.current = false;
      addStatus?.("Result processing unlocked.");
    }
  };

  const initializeRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setErrorMessage('Speech recognition is not supported in this browser.');
      addStatus?.("Speech recognition not supported in browser.");
      return null;
    }
    if (window.speechRecognition) {
      try {
        window.speechRecognition.stop();
        window.speechRecognition = null;
        addStatus?.("Stopped existing global recognition instance.");
      } catch (error) {
        console.error('Error stopping existing recognition:', error);
        addStatus?.("Error stopping existing global recognition.");
      }
    }
    if (recognitionInstance) {
      try {
        recognitionInstance.stop();
        setRecognitionInstance(null);
        addStatus?.("Stopped existing component recognition instance.");
      } catch (error) {
        console.error('Error stopping existing recognition:', error);
        addStatus?.("Error stopping existing component recognition.");
      }
    }
    return new Promise<SpeechRecognition | null>((resolve) => {
      setTimeout(() => {
        try {
          const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
          const recognition = new SpeechRecognitionAPI();

          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = 'en-AU';

          recognition.onstart = () => {
            addStatus?.("Listening started (onstart).");
            setIsListening(true);
            setLastTranscript('');
            setIsProcessing(false);
            setErrorMessage('');
            hasProcessedAnswer.current = false;
            lastInterim.current = null;
            lastAlternatives.current = [];
            if (interimTimeoutRef.current) {
              clearTimeout(interimTimeoutRef.current);
              interimTimeoutRef.current = null;
            }
          };

          recognition.onend = () => {
            addStatus?.("Listening ended (onend).");
            if (interimTimeoutRef.current) {
              clearTimeout(interimTimeoutRef.current);
              interimTimeoutRef.current = null;
            }
            // If no answer was processed yet, and we have an interim, process it
            if (!hasProcessedAnswer.current && lastInterim.current) {
              addStatus?.(`Recognition ended, processing last interim: "${lastInterim.current}"`);
              processTranscript(lastInterim.current, lastAlternatives.current);
              lastInterim.current = null;
              lastAlternatives.current = [];
            }
            setRecognitionInstance(null);
            window.speechRecognition = null;
          };

          recognition.onresult = (event: SpeechRecognitionEvent) => {
            setErrorMessage('');
            try {
              if (hasProcessedAnswer.current) {
                addStatus?.("Already processed an answer, ignoring further results.");
                return;
              }
              const resultIndex = event.results.length - 1;
              const result = event.results[resultIndex];
              const alternatives = Array.from({ length: event.results[0].length }, (_, i) => ({
                transcript: event.results[0][i].transcript,
                confidence: event.results[0][i].confidence || 0
              }));
              alternatives.sort((a, b) => b.confidence - a.confidence);

              // FINAL RESULT: process only if not already processed
              if (result.isFinal) {
                if (interimTimeoutRef.current) {
                  clearTimeout(interimTimeoutRef.current);
                  interimTimeoutRef.current = null;
                }
                addStatus?.("Final result received and locked for processing.");
                const bestMatch = alternatives[0];
                setLastTranscript(bestMatch.transcript);
                processTranscript(bestMatch.transcript, alternatives);
                lastInterim.current = null;
                lastAlternatives.current = [];
                return;
              }

              // INTERIM RESULT: start/reset a 300ms timer
              if (alternatives[0].transcript.trim()) {
                lastInterim.current = alternatives[0].transcript;
                lastAlternatives.current = alternatives;
                addStatus?.(`Interim result: "${alternatives[0].transcript}" (starting 300ms timer)`);
                if (interimTimeoutRef.current) {
                  clearTimeout(interimTimeoutRef.current);
                }
                interimTimeoutRef.current = setTimeout(() => {
                  if (hasProcessedAnswer.current) return;
                  addStatus?.(`300ms silence after interim, using "${lastInterim.current}" as answer`);
                  processTranscript(lastInterim.current, lastAlternatives.current);
                  lastInterim.current = null;
                  lastAlternatives.current = [];
                  if (recognitionInstance) recognitionInstance.stop();
                }, 300);
              }
            } catch (error) {
              console.error('Error in onresult:', error);
              isHandlingResultRef.current = false;
              addStatus?.("Error in onresult handler.");
            }
          };

          recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            addStatus?.(`Recognition error: ${event.error}`);
            setIsProcessing(false);
            setIsListening(false);
            if (interimTimeoutRef.current) {
              clearTimeout(interimTimeoutRef.current);
              interimTimeoutRef.current = null;
            }
            if (event.error === 'not-allowed') {
              setErrorMessage('Microphone access was denied. Please allow microphone access in your browser settings and try again.');
              stopRecognition();
            } else if (event.error === 'no-speech') {
              setErrorMessage('No speech detected. Please try speaking again.');
              stopRecognition();
            } else if (event.error === 'audio-capture') {
              setErrorMessage('No microphone was found. Please ensure your microphone is properly connected.');
              stopRecognition();
            } else if (event.error === 'network') {
              setErrorMessage('Network error occurred. Please check your internet connection.');
              stopRecognition();
            } else if (event.error === 'aborted') {
              addStatus?.('Recognition aborted - this is normal during cleanup.');
              stopRecognition();
            } else {
              setErrorMessage('There was an error with speech recognition. Please try again.');
              stopRecognition();
            }
            isHandlingResultRef.current = false;
            hasProcessedAnswer.current = true;
          };

          setRecognitionInstance(recognition);
          window.speechRecognition = recognition;
          resolve(recognition);
        } catch (error) {
          console.error('Error creating speech recognition:', error);
          setErrorMessage('Failed to initialize speech recognition. Please try again.');
          addStatus?.("Error creating speech recognition instance.");
          resolve(null);
        }
      }, 100);
    });
  }, [processTranscript, stopRecognition, recognitionInstance, setIsProcessing, addStatus]);

  const toggleListening = useCallback(async () => {
    addStatus?.(`Toggle listening called. isListening: ${isListening}, isProcessing: ${isProcessing}`);
    if (isListening) {
      await stopRecognition();
      isHandlingResultRef.current = false;
      hasProcessedAnswer.current = false;
      addStatus?.("Stopped listening on toggle.");
    } else {
      if (window.speechRecognition) {
        try {
          window.speechRecognition.stop();
          window.speechRecognition = null;
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error('Error stopping existing recognition:', error);
          addStatus?.("Error stopping global recognition in toggle.");
        }
      }

      const recognition = await initializeRecognition();
      if (recognition) {
        try {
          addStatus?.("Starting recognition instance.");
          isHandlingResultRef.current = false;
          hasProcessedAnswer.current = false;
          recognition.start();
        } catch (error) {
          console.error('Error starting speech recognition:', error);
          setErrorMessage('There was an error with speech recognition. Please try again.');
          setIsListening(false);
          setIsProcessing(false);
          setRecognitionInstance(null);
          window.speechRecognition = null;
          isHandlingResultRef.current = false;
          hasProcessedAnswer.current = false;
          addStatus?.("Error starting recognition instance.");
        }
      }
    }
  }, [isListening, initializeRecognition, stopRecognition, isProcessing, setIsListening, setIsProcessing, addStatus]);

  useEffect(() => {
    return () => {
      stopRecognition();
      isHandlingResultRef.current = false;
      hasProcessedAnswer.current = false;
      if (interimTimeoutRef.current) {
        clearTimeout(interimTimeoutRef.current);
        interimTimeoutRef.current = null;
      }
      addStatus?.("Component unmounted, recognition stopped.");
    };
  }, [stopRecognition, addStatus]);

  return (
    <div className="flex flex-col items-center mt-6">
      {errorMessage && (
        <p className="text-red-500 mb-4">{errorMessage}</p>
      )}
      <Button
        onClick={toggleListening}
        className={`rounded-full w-16 h-16 flex items-center justify-center ${getMicrophoneButtonClass()}`}
        aria-label={isListening ? 'Stop listening' : 'Start listening'}
        disabled={isProcessing}
      >
        {isListening ? <MicOff size={24} /> : <Mic size={24} />}
      </Button>
      <p className="mt-3 text-gray-600">
        {isProcessing 
          ? 'Processing...' 
          : isListening 
            ? 'Listening...' 
            : 'Tap to speak'}
      </p>
      {lastTranscript && (
        <div className="mt-2 text-xs text-gray-500">
          <span>Last heard: </span>
          <strong>{lastTranscript}</strong>
        </div>
      )}
    </div>
  );
};

export default SpeechRecognition;