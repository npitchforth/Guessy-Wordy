/// <reference types="vite/client" />

import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';

interface SpeechRecognitionProps {
  onResult: (transcript: string, alternatives?: Array<{ transcript: string; confidence: number }>) => void;
  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
  addStatus?: (msg: string) => void;
  expectedWords?: string[];
}

const SpeechRecognition: React.FC<SpeechRecognitionProps> = ({
  onResult,
  isListening,
  setIsListening,
  isProcessing,
  setIsProcessing,
  addStatus,
  expectedWords = []
}) => {
  const [errorMessage, setErrorMessage] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const MIN_RECORDING_DURATION = 100; // Reduced to 100ms for very short words
  const MAX_RECORDING_DURATION = 2000; // Reduced to 2 seconds max
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getMicrophoneButtonClass = () => {
    if (isProcessing) {
      return "bg-gray-400 hover:bg-gray-500 text-white cursor-not-allowed";
    } else if (isListening) {
      return "bg-red-500 hover:bg-red-600 text-white";
    } else {
      return "bg-green-500 hover:bg-green-600 text-white";
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Set to 16kHz directly
          sampleSize: 16,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      // Set a maximum recording duration
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, MAX_RECORDING_DURATION);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          addStatus?.(`Received audio chunk: ${event.data.size} bytes`);
        }
      };

      mediaRecorder.onstop = async () => {
        if (recordingTimeoutRef.current) {
          clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }

        const recordingDuration = Date.now() - recordingStartTimeRef.current;
        addStatus?.(`Recording duration: ${recordingDuration}ms`);

        if (recordingDuration < MIN_RECORDING_DURATION) {
          addStatus?.(`Recording too short (${recordingDuration}ms), minimum is ${MIN_RECORDING_DURATION}ms`);
          setErrorMessage('Recording too short. Please speak for at least 100ms.');
          setIsListening(false);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        addStatus?.(`Total audio size: ${audioBlob.size} bytes`);
        await processAudio(audioBlob);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
      };

      // Start recording and collect all data in a single chunk
      mediaRecorder.start();
      setIsListening(true);
      setErrorMessage('');
      addStatus?.("Recording started");
    } catch (error) {
      console.error('Error starting recording:', error);
      setErrorMessage('Error accessing microphone. Please check permissions.');
      addStatus?.("Error starting recording");
    }
  }, [setIsListening, addStatus]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      addStatus?.("Recording stopped");
    }
  }, [setIsListening, addStatus]);

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    addStatus?.("Processing audio...");

    try {
      // Convert audio to WAV format
      const audioContext = new AudioContext();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      addStatus?.(`Original audio details: ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz, ${audioBuffer.length} samples`);
      
      // Resample to 16kHz
      const resampledBuffer = await resampleAudio(audioBuffer, 16000);
      addStatus?.(`Resampled audio details: ${resampledBuffer.numberOfChannels} channels, ${resampledBuffer.sampleRate}Hz, ${resampledBuffer.length} samples`);
      
      // Create WAV file
      const wavBlob = await convertToWav(resampledBuffer);
      addStatus?.(`Converted to WAV: ${wavBlob.size} bytes`);

      // Get Azure credentials from environment variables
      const subscriptionKey = import.meta.env.VITE_AZURE_SPEECH_KEY;
      const region = import.meta.env.VITE_AZURE_SPEECH_REGION;

      if (!subscriptionKey || !region) {
        throw new Error('Azure Speech credentials not configured');
      }

      // Call Azure Speech to Text API
      const speechContext = expectedWords.length > 0 
        ? `&speechcontext={"phrases":${JSON.stringify(expectedWords)}}`
        : '';
      
      const response = await fetch(
        `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed${speechContext}`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': subscriptionKey,
            'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: wavBlob
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        addStatus?.(`Azure API error: ${response.status} ${response.statusText}`);
        addStatus?.(`Error details: ${errorText}`);
        throw new Error(`Azure API error: ${response.statusText}. Details: ${errorText}`);
      }

      const result = await response.json();
      addStatus?.("Received response from Azure");
      addStatus?.(`Recognition status: ${result.RecognitionStatus}`);
      addStatus?.(`Full response: ${JSON.stringify(result, null, 2)}`);

      if (result.RecognitionStatus === 'Success') {
        const transcript = result.DisplayText;
        const alternatives = result.NBest?.map((item: any) => ({
          transcript: item.Display,
          confidence: item.Confidence
        })) || [];

        onResult(transcript, alternatives);
        addStatus?.("Successfully processed speech");
      } else {
        throw new Error(`Recognition failed: ${result.RecognitionStatus}`);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      setErrorMessage('Error processing speech. Please try again.');
      addStatus?.(`Error processing audio: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const convertToWav = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    const numChannels = 1;
    const sampleRate = 16000;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = audioBuffer.length * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // RIFF chunk length
    view.setUint32(4, 36 + dataSize, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, format, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, byteRate, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, blockAlign, true);
    // bits per sample
    view.setUint16(34, bitDepth, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, dataSize, true);

    // Write the PCM samples
    const offset = 44;
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset + i * 2, value, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const resampleAudio = async (audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> => {
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      Math.round(audioBuffer.length * targetSampleRate / audioBuffer.sampleRate),
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    return await offlineContext.startRendering();
  };

  const toggleRecording = useCallback(() => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isListening, startRecording, stopRecording]);

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`w-16 h-16 rounded-full ${getMicrophoneButtonClass()}`}
      >
        {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </Button>
      {errorMessage && (
        <p className="text-red-500 text-sm mt-2">{errorMessage}</p>
      )}
    </div>
  );
};

export default SpeechRecognition;