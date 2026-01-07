import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { chatWithAI, translateToHindi } from '@/lib/openai';
import { mockChatWithAI } from '@/lib/mockAI';

const VoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [hindiResponse, setHindiResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognition = useRef<any>(null);
  const utteranceRef = useRef<any>(null);

  const languages = [
    { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' },
    { code: 'en-IN', name: 'English (India)', flag: '🇮🇳' },
    { code: 'pa-IN', name: 'Punjabi', flag: '🇮🇳' },
    { code: 'mr-IN', name: 'Marathi', flag: '🇮🇳' },
    { code: 'gu-IN', name: 'Gujarati', flag: '🇮🇳' },
  ];

  useEffect(() => {
    console.log('Checking speech recognition support...');
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      console.log('✅ Speech recognition supported');
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = selectedLanguage;
      console.log('Speech recognition initialized with language:', selectedLanguage);

      recognition.current.onresult = async (event: any) => {
        const spokenText = event.results[0][0].transcript;
        setTranscript(spokenText);
        setIsListening(false);
        setIsProcessing(true);

        // Stop recognition to prevent continuous listening
        if (recognition.current) {
          recognition.current.stop();
        }

        try {
          // Use improved voice assistant backend
          const response = await fetch('http://localhost:5000/voice-query', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: spokenText })
          });

          let aiResponse = '';
          let hindiTranslation = '';

          if (response.ok) {
            const data = await response.json();
            aiResponse = data.response.text;
            hindiTranslation = data.response.audio_text;
          } else {
            // Fallback to mock AI
            aiResponse = await mockChatWithAI(spokenText);
            hindiTranslation = aiResponse;
          }

          setResponse(aiResponse);
          setHindiResponse(hindiTranslation);

          // Speak the response
          speakResponse(aiResponse);
        } catch (error) {
          console.error('Voice processing error:', error);
          setResponse('Sorry, I encountered an error processing your request.');
          setHindiResponse('क्षमा करें, मुझे आपके अनुरोध को प्रोसेस करने में त्रुटि हुई।');
        } finally {
          setIsProcessing(false);
        }
      };

      recognition.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        let errorMessage = 'Speech recognition error: ' + event.error;
        if (event.error === 'not-allowed') {
          errorMessage = 'Microphone permission denied. Please allow microphone access in your browser.';
        } else if (event.error === 'no-speech') {
          errorMessage = 'No speech detected. Please try speaking louder.';
        } else if (event.error === 'network') {
          errorMessage = 'Network error. Please check your internet connection.';
        }
        setResponse(errorMessage);
        setHindiResponse('माइक्रोफ़ोन की समस्या है। कृपया अनुमति दें।');
        setIsListening(false);
        setIsProcessing(false);
      };

      recognition.current.onend = () => {
        setIsListening(false);
      };

      recognition.current.onstart = () => {
        console.log('✅ Speech recognition started successfully');
      };
    } else {
      console.error('❌ Speech recognition not supported in this browser');
      setResponse('Speech recognition not supported. Please use Chrome or Edge browser.');
      setHindiResponse('आवाज़ पहचान समर्थित नहीं। Chrome या Edge ब्राउज़र का उपयोग करें।');
    }
  }, [selectedLanguage]);

  const startListening = () => {
    if (recognition.current && !isListening) {
      setTranscript('');
      setResponse('');
      setHindiResponse('');
      setIsListening(true);
      recognition.current.lang = selectedLanguage;
      try {
        recognition.current.start();
      } catch (error) {
        console.error('Speech recognition start error:', error);
        setIsListening(false);
      }
    }
  };

  const stopListening = () => {
    if (recognition.current && isListening) {
      try {
        recognition.current.stop();
      } catch (error) {
        console.error('Speech recognition stop error:', error);
      }
      setIsListening(false);
    }
  };

  const speakResponse = (text: string) => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utteranceRef.current = utterance;
      utterance.lang = selectedLanguage;
      utterance.rate = 0.8;

      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      speechSynthesis.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window && isSpeaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      utteranceRef.current = null;
    }
  };

  const pauseResumeSpeaking = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        if (speechSynthesis.speaking && !speechSynthesis.paused) {
          speechSynthesis.pause();
        } else {
          speechSynthesis.resume();
        }
      }
    }
  };

  const exampleQuestions = [
    { hindi: "गेहूं में रोग आ गया है, क्या करें?", english: "Wheat has disease, what to do?" },
    { hindi: "आज पानी देना चाहिए?", english: "Should I water today?" },
    { hindi: "फसल कब काटनी चाहिए?", english: "When should I harvest?" },
    { hindi: "खाद कितनी डालनी चाहिए?", english: "How much fertilizer to apply?" }
  ];

  return (
    <div className="space-y-6">
      {/* Language Selection */}
      <Card className="p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Languages className="w-5 h-5" />
          Select Language / भाषा चुनें
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {languages.map((lang) => (
            <Button
              key={lang.code}
              variant={selectedLanguage === lang.code ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedLanguage(lang.code)}
              className="justify-start"
            >
              <span className="mr-2">{lang.flag}</span>
              {lang.name}
            </Button>
          ))}
        </div>
      </Card>

      {/* Voice Interface */}
      <Card className="p-6 text-center">
        <div className="space-y-4">
          <motion.div
            className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center ${isListening ? 'bg-red-500 animate-pulse' : 'bg-primary'
              }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button
              size="lg"
              onClick={isListening ? stopListening : startListening}
              disabled={isProcessing}
              className={`w-24 h-24 rounded-full transition-all duration-300 ${isListening ? 'bg-red-600 hover:bg-red-700 animate-pulse' : 'bg-primary hover:bg-primary/90'
                }`}
            >
              {isListening ? (
                <MicOff className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </Button>
          </motion.div>

          <div className="space-y-2">
            <p className="text-lg font-semibold">
              {isListening ? 'सुन रहा हूं... / Listening...' : 'बोलने के लिए दबाएं / Press to Speak'}
            </p>
            {isProcessing && (
              <p className="text-muted-foreground">प्रोसेसिंग... / Processing...</p>
            )}
          </div>
        </div>
      </Card>

      {/* Transcript and Response */}
      {transcript && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Card className="p-4">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Mic className="w-4 h-4" />
              आपने कहा / You said:
            </h4>
            <p className="text-muted-foreground">{transcript}</p>
          </Card>

          {response && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold flex items-center gap-2">
                  🤖 AgriSphere AI का जवाब / Response:
                </h4>
                <div className="flex gap-2">
                  {isSpeaking ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={pauseResumeSpeaking}
                      >
                        {speechSynthesis.paused ? '▶️' : '⏸️'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={stopSpeaking}
                      >
                        ⏹️
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => speakResponse(response || hindiResponse)}
                    >
                      <Volume2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-primary font-medium text-lg leading-relaxed">{response}</p>
              </div>
            </Card>
          )}
        </motion.div >
      )}

      {/* Example Questions */}
      <Card className="p-4">
        <h4 className="font-semibold mb-3">उदाहरण प्रश्न / Example Questions:</h4>
        <div className="grid gap-2">
          {exampleQuestions.map((q, i) => (
            <div key={i} className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTranscript(q.hindi);
                  // Simulate voice processing
                  setIsProcessing(true);
                  setTimeout(async () => {
                    try {
                      // Use improved voice assistant backend
                      const response = await fetch('http://localhost:5000/voice-query', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ text: q.hindi })
                      });

                      let aiResponse = '';
                      let hindiTranslation = '';

                      if (response.ok) {
                        const data = await response.json();
                        aiResponse = data.response.text;
                        hindiTranslation = data.response.audio_text;
                      } else {
                        // Fallback to mock AI
                        aiResponse = await mockChatWithAI(q.hindi);
                        hindiTranslation = aiResponse;
                      }

                      setResponse(aiResponse);
                      setHindiResponse(hindiTranslation);
                      speakResponse(aiResponse);
                    } catch (error) {
                      console.error('Voice query error:', error);
                      setResponse('Sorry, I encountered an error.');
                      setHindiResponse('क्षमा करें, मुझे त्रुटि हुई।');
                    } finally {
                      setIsProcessing(false);
                    }
                  }, 1000);
                }}
                className="text-left justify-start h-auto p-3 w-full"
              >
                <div className="flex-1">
                  <p className="font-medium">{q.hindi}</p>
                  <p className="text-xs text-muted-foreground">{q.english}</p>
                </div>
              </Button>
              {isSpeaking && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={pauseResumeSpeaking}
                  >
                    {speechSynthesis.paused ? '▶️' : '⏸️'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={stopSpeaking}
                  >
                    ⏹️
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Browser Support Note */}
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <p><strong>Note:</strong> Voice recognition requires a modern browser with microphone permissions. Works best in Chrome/Edge.</p>
        <p><strong>नोट:</strong> आवाज़ पहचान के लिए आधुनिक ब्राउज़र और माइक्रोफ़ोन की अनुमति चाहिए।</p>
      </div>
    </div >
  );
};

export default VoiceRecognition;