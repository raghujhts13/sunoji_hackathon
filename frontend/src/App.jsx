import { useState, useRef, useEffect, useCallback } from 'react'
import { sendAudio, getJoke, getQuote, base64ToAudioBlob, getWeather, getDateTime } from './api'
import { useVoiceActivityDetection } from './hooks/useVoiceActivityDetection'
import './App.css'

// Session states for continuous listening
const SESSION_STATE = {
  IDLE: 'IDLE',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  RESPONDING: 'RESPONDING'
}

function App() {
  // Session state for continuous listening
  const [sessionState, setSessionState] = useState(SESSION_STATE.IDLE)
  const [status, setStatus] = useState("Hi, I'm your AI companion. Click Start to begin.")
  const [audioLevel, setAudioLevel] = useState(0)
  const [isManuallyRecording, setIsManuallyRecording] = useState(false)

  // Refs for continuous recording
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)
  const isProcessingRef = useRef(false)
  const turnCountRef = useRef(0)
  const recordingStartTimeRef = useRef(null)
  const currentAudioRef = useRef(null)
  const audioTimeoutRef = useRef(null)

  // Analysis state
  const [lastAnalysis, setLastAnalysis] = useState(null)

  // Chat history state
  const [chatHistory, setChatHistory] = useState([])

  // User location state
  const [userLocation, setUserLocation] = useState({ latitude: null, longitude: null })
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false)

  // Get user location on mount
  useEffect(() => {
    getUserLocation()
  }, [])

  // Get user's geolocation
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
          setLocationPermissionDenied(false)
          console.log('User location obtained:', position.coords.latitude, position.coords.longitude)
        },
        (error) => {
          console.warn('Could not get user location:', error.message)
          setLocationPermissionDenied(true)

          // Show helpful message based on error type
          if (error.code === error.PERMISSION_DENIED) {
            setStatus("📍 Location access denied. For weather updates, you'll need to specify a city or enable location in your browser settings.")
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            setStatus("📍 Location unavailable. For weather updates, please specify a city.")
          } else if (error.code === error.TIMEOUT) {
            setStatus("📍 Location request timed out. For weather updates, please specify a city.")
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000 // Cache position for 5 minutes
        }
      )
    } else {
      console.warn('Geolocation not supported')
      setLocationPermissionDenied(true)
      setStatus("📍 Location not supported by your browser. For weather updates, please specify a city.")
    }
  }

  // Ref to track current session state (avoids stale closure in callbacks)
  const sessionStateRef = useRef(sessionState)
  useEffect(() => {
    sessionStateRef.current = sessionState
  }, [sessionState])

  // Callback when speech starts (VAD detects voice)
  const handleSpeechStart = useCallback(() => {
    const currentState = sessionStateRef.current
    const isProcessing = isProcessingRef.current
    const recorderState = mediaRecorderRef.current?.state
    
    console.log('Speech detected, state:', currentState, 'processing:', isProcessing, 'MediaRecorder state:', recorderState)
    
    // Strict guard: only start recording if in LISTENING state, not processing, and recorder is ready
    if (currentState !== SESSION_STATE.LISTENING) {
      console.log('Skipping recording - not in LISTENING state')
      return
    }
    
    if (isProcessing) {
      console.log('Skipping recording - already processing')
      return
    }
    
    if (!mediaRecorderRef.current) {
      console.error('MediaRecorder is null')
      return
    }
    
    if (recorderState !== 'inactive') {
      console.warn('MediaRecorder not ready, current state:', recorderState)
      return
    }
    
    // All conditions met - start recording
    console.log('Starting recording...')
    audioChunksRef.current = []
    recordingStartTimeRef.current = Date.now()
    setStatus('🎤 Listening... Speak now')
    
    try {
      mediaRecorderRef.current.start()
      console.log('MediaRecorder started successfully')
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err)
    }
  }, [])

  // Callback when speech ends (2 seconds of silence detected)
  const handleSpeechEnd = useCallback(() => {
    const currentState = sessionStateRef.current
    const isProcessing = isProcessingRef.current
    const recorderState = mediaRecorderRef.current?.state
    
    console.log('Silence detected, state:', currentState, 'processing:', isProcessing, 'MediaRecorder state:', recorderState)
    
    // Strict validation: only process if in LISTENING state and recorder is actually recording
    if (currentState !== SESSION_STATE.LISTENING) {
      console.log('Skipping processing - not in LISTENING state')
      return
    }
    
    if (isProcessing) {
      console.log('Skipping processing - already processing')
      return
    }
    
    if (!mediaRecorderRef.current) {
      console.error('MediaRecorder is null')
      return
    }
    
    if (recorderState !== 'recording') {
      console.log('Skipping processing - MediaRecorder not recording, state:', recorderState)
      return
    }
    
    // Check minimum recording duration (avoid processing very short audio)
    const recordingDuration = Date.now() - (recordingStartTimeRef.current || 0)
    if (recordingDuration < 400) {
      console.log('Recording too short:', recordingDuration, 'ms - ignoring')
      return
    }
    
    // All conditions met - process the recording
    console.log('Processing speech after silence... (duration:', recordingDuration, 'ms)')
    
    // Set processing flag BEFORE stopping recorder to prevent race conditions
    isProcessingRef.current = true
    setSessionState(SESSION_STATE.PROCESSING)
    
    try {
      mediaRecorderRef.current.stop()
      console.log('MediaRecorder stopped')
    } catch (err) {
      console.error('Failed to stop MediaRecorder:', err)
      // Reset on error
      isProcessingRef.current = false
      setSessionState(SESSION_STATE.LISTENING)
    }
  }, [])

  // Initialize VAD for continuous voice-activated recording
  const { startVAD, stopVAD, getAudioLevel, resetSpeechState } = useVoiceActivityDetection({
    onSpeechStart: handleSpeechStart,
    onSpeechEnd: handleSpeechEnd,
    silenceThreshold: 3,     // Sensitive threshold for speech detection
    silenceDuration: 2000,    // 2 seconds of silence triggers transcription
    speechMinDuration: 500    // Minimum 500ms of speech required
  })

  // Update audio level for visualization
  useEffect(() => {
    let animationFrame
    const updateLevel = () => {
      if (sessionState === SESSION_STATE.LISTENING) {
        setAudioLevel(getAudioLevel())
      }
      animationFrame = requestAnimationFrame(updateLevel)
    }

    if (sessionState === SESSION_STATE.LISTENING) {
      updateLevel()
    }

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [sessionState, getAudioLevel])

  // Initialize microphone stream on first use
  const initializeMicrophone = async () => {
    if (streamRef.current) return true

    try {
      console.log('Initializing microphone...')
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      })
      streamRef.current = stream

      // Initialize MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          audioChunksRef.current = []
          await processAudio(audioBlob)
        } else {
          isProcessingRef.current = false
          setIsManuallyRecording(false)
          setSessionState(SESSION_STATE.IDLE)
        }
      }

      console.log('Microphone initialized successfully')
      return true
    } catch (error) {
      console.error("Error accessing microphone:", error)
      setStatus("Error accessing microphone. Please allow permissions.")
      return false
    }
  }

  // Cleanup microphone resources
  const cleanupMicrophone = () => {
    console.log('Cleaning up microphone...')

    stopVAD()

    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      mediaRecorderRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    // Stop any playing audio
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause()
        currentAudioRef.current.src = ''
        currentAudioRef.current = null
      } catch (e) {
        console.warn('Error stopping audio during cleanup:', e)
      }
    }
    
    // Clear audio timeout
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current)
      audioTimeoutRef.current = null
    }

    audioChunksRef.current = []
    isProcessingRef.current = false
    setSessionState(SESSION_STATE.IDLE)
    setAudioLevel(0)
    setStatus("Hi, I'm your AI companion. Click Start to begin.")
  }

  // Start continuous listening session
  const startSession = async () => {
    try {
      console.log('Starting continuous listening session...')

      const initialized = await initializeMicrophone()
      if (!initialized) return

      // Start VAD for continuous listening
      await startVAD(streamRef.current)

      // Update state
      turnCountRef.current = 0
      setSessionState(SESSION_STATE.LISTENING)
      setStatus("🎙️ Listening continuously... Speak anytime, I'll respond after you pause.")
      setLastAnalysis(null)

    } catch (error) {
      console.error("Error starting session:", error)
      setStatus("Error accessing microphone. Please allow permissions.")
    }
  }

  // Stop continuous listening session
  const stopSession = () => {
    console.log('Stopping session...')
    cleanupMicrophone()
  }

  // Toggle session (for main button)
  const toggleSession = () => {
    if (sessionState === SESSION_STATE.IDLE) {
      startSession()
    } else {
      stopSession()
    }
  }

  // Resume listening after response
  const resumeListening = () => {
    console.log('=== RESUMING LISTENING ===')
    console.log('Before resume - processing:', isProcessingRef.current, 'state:', sessionStateRef.current, 'MediaRecorder:', mediaRecorderRef.current?.state)
    
    // Clear any existing audio timeout
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current)
      audioTimeoutRef.current = null
    }
    
    // Stop and cleanup current audio if playing
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause()
        currentAudioRef.current.src = ''
        currentAudioRef.current = null
      } catch (e) {
        console.warn('Error cleaning up audio:', e)
      }
    }
    
    // Clear audio chunks from any previous incomplete recordings
    audioChunksRef.current = []
    
    // Reset all state flags BEFORE transitioning state
    isProcessingRef.current = false
    resetSpeechState()
    
    // Ensure MediaRecorder is in inactive state
    if (mediaRecorderRef.current) {
      const recorderState = mediaRecorderRef.current.state
      if (recorderState === 'recording' || recorderState === 'paused') {
        console.warn('MediaRecorder still active during resume, stopping it. State:', recorderState)
        try {
          mediaRecorderRef.current.stop()
        } catch (e) {
          console.warn('Error stopping MediaRecorder during resume:', e)
        }
      }
    }
    
    // Transition to LISTENING state
    setSessionState(SESSION_STATE.LISTENING)
    setStatus("🎙️ Ready for your next question... Speak anytime.")
    
    console.log('After resume - processing:', isProcessingRef.current, 'state:', SESSION_STATE.LISTENING, 'MediaRecorder:', mediaRecorderRef.current?.state)
    console.log('=== READY FOR NEXT INPUT ===')
  }

  // Process audio and get AI response
  const processAudio = async (audioBlob) => {
    // Validate audio blob
    if (!audioBlob || audioBlob.size === 0) {
      console.error('Invalid audio blob - size is 0')
      setStatus("Recording failed. Please try again.")
      isProcessingRef.current = false
      resumeListening()
      return
    }

    console.log(`Processing audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`)
    
    // Ensure processing state is set
    isProcessingRef.current = true
    setSessionState(SESSION_STATE.PROCESSING)
    setStatus("🤔 Processing...")

    try {
      const isFirstMessage = turnCountRef.current === 0
      turnCountRef.current += 1

      const response = await sendAudio(
        audioBlob,
        userLocation.latitude,
        userLocation.longitude,
        isFirstMessage
      )

      // Set analysis info
      setLastAnalysis({
        transcript: response.transcript,
        intent: response.intent,
        tone: response.tone,
        confidence: response.confidence
      })

      // Add user message to chat history
      const userMessage = {
        id: Date.now(),
        type: 'user',
        text: response.transcript,
        intent: response.intent,
        tone: response.tone,
        timestamp: new Date()
      }

      // Add AI response to chat history
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        text: response.response_text,
        timestamp: new Date()
      }

      setChatHistory(prev => [...prev, userMessage, aiMessage])

      // Play audio response
      if (response.audio_base64) {
        setSessionState(SESSION_STATE.RESPONDING)
        setStatus("🔊 Speaking...")

        const responseBlob = base64ToAudioBlob(response.audio_base64)
        const audioUrl = URL.createObjectURL(responseBlob)
        const audio = new Audio(audioUrl)
        currentAudioRef.current = audio

        let hasEnded = false
        
        const cleanup = () => {
          if (hasEnded) return
          hasEnded = true
          
          URL.revokeObjectURL(audioUrl)
          currentAudioRef.current = null
          
          if (audioTimeoutRef.current) {
            clearTimeout(audioTimeoutRef.current)
            audioTimeoutRef.current = null
          }
          
          resumeListening()
        }

        audio.onended = () => {
          console.log('Audio playback ended normally')
          cleanup()
        }

        audio.onerror = (e) => {
          console.error('Audio playback error:', e)
          cleanup()
        }

        try {
          await audio.play()
          
          // Safety timeout: force resume after 30 seconds
          audioTimeoutRef.current = setTimeout(() => {
            console.warn('Audio playback timeout - forcing resume')
            cleanup()
          }, 30000)
        } catch (playError) {
          console.error('Error playing audio:', playError)
          cleanup()
        }
      } else {
        setStatus(response.response_text || "Ready for your next question...")
        resumeListening()
      }
    } catch (error) {
      console.error("Error processing audio:", error)
      setStatus("Sorry, I had trouble understanding. Please continue...")
      resumeListening()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMicrophone()
    }
  }, [])

  const handleJoke = async () => {
    try {
      const joke = await getJoke()
      setStatus(joke)
    } catch (error) {
      setStatus("Couldn't think of a joke right now.")
    }
  }

  const handleQuote = async () => {
    try {
      const quote = await getQuote()
      setStatus(quote)
    } catch (error) {
      setStatus("Couldn't find a quote right now.")
    }
  }

  const handleWeather = async () => {
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const weatherData = await getWeather(
                null,
                position.coords.latitude,
                position.coords.longitude
              )
              setStatus(weatherData.formatted_response)
            } catch (error) {
              setStatus("Couldn't get weather data. Try asking me directly!")
            }
          },
          async (error) => {
            const location = prompt('Enter your city name for weather:')
            if (location) {
              try {
                const weatherData = await getWeather(location, null, null)
                setStatus(weatherData.formatted_response)
              } catch (err) {
                setStatus(`Couldn't find weather for ${location}.`)
              }
            } else {
              setStatus("I need a location to check the weather!")
            }
          }
        )
      } else {
        const location = prompt('Enter your city name for weather:')
        if (location) {
          const weatherData = await getWeather(location, null, null)
          setStatus(weatherData.formatted_response)
        } else {
          setStatus("I need a location to check the weather!")
        }
      }
    } catch (error) {
      setStatus("Couldn't get weather information.")
    }
  }

  const handleDateTime = async () => {
    try {
      const dateTimeData = await getDateTime('Asia/Kolkata')
      setStatus(dateTimeData.formatted_response)
    } catch (error) {
      setStatus("Couldn't get the time right now.")
    }
  }

  const getToneEmoji = (tone) => {
    const emojis = {
      happy: '😊',
      sad: '😢',
      frustrated: '😤',
      neutral: '😐',
      anxious: '😰',
      excited: '🤩'
    }
    return emojis[tone] || '😐'
  }

  const getIntentIcon = (intent) => {
    const icons = {
      venting: '💭',
      seeking_advice: '💡',
      casual_chat: '💬',
      question: '❓'
    }
    return icons[intent] || '💬'
  }

  return (
    <div className="app-container">
      {/* Background gradient overlay */}
      <div className="background-overlay"></div>

      <header className="header">
        <h1 className="title">
          <span className="title-icon">🎙️</span>
          AI Voice Companion
        </h1>
      </header>

      <main className="main-content">
        {/* Chat History */}
        <div className="chat-container">
          <div className="chat-history">
            {chatHistory.length === 0 ? (
              <div className="chat-empty">
                <span className="chat-empty-icon">💬</span>
                <p>Start speaking to begin the conversation</p>
              </div>
            ) : (
              chatHistory.map(message => (
                <div key={message.id} className={`chat-message ${message.type}`}>
                  <div className="message-content">
                    <p className="message-text">{message.text}</p>
                    {message.type === 'user' && message.intent && (
                      <div className="message-analysis">
                        <span className="mini-badge tone">
                          {getToneEmoji(message.tone)} {message.tone}
                        </span>
                        <span className="mini-badge intent">
                          {getIntentIcon(message.intent)} {message.intent.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="message-time">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Status indicator */}
          <div className="chat-status">
            <p>{status}</p>
          </div>
        </div>

        {/* Microphone Button */}
        <div className="mic-container">
          <button
            className={`mic-button ${sessionState === 'LISTENING' ? 'active' : ''} ${sessionState === 'PROCESSING' ? 'processing' : ''} ${sessionState === 'RESPONDING' ? 'responding' : ''}`}
            onClick={toggleSession}
            disabled={sessionState === 'PROCESSING'}
          >
            <div className="mic-inner">
              {sessionState === 'PROCESSING' ? (
                <div className="spinner"></div>
              ) : sessionState === 'RESPONDING' ? (
                <>
                  <span className="mic-icon">🔊</span>
                  <span className="mic-label">Speaking</span>
                </>
              ) : (
                <>
                  <span className="mic-icon">
                    {sessionState === 'IDLE' ? '🎤' : '⏹️'}
                  </span>
                  <span className="mic-label">
                    {sessionState === 'IDLE' ? 'Start' : 'Stop'}
                  </span>
                </>
              )}
            </div>
          </button>
          {sessionState === 'LISTENING' && (
            <div className="listening-indicator">
              <div className="audio-level" style={{ transform: `scaleY(${Math.max(0.1, audioLevel / 100)})` }}></div>
            </div>
          )}
          {sessionState === 'LISTENING' && <div className="recording-pulse"></div>}
        </div>

        {/* Action Buttons */}
        <div className="actions">
          <button className="action-btn" onClick={handleJoke} disabled={sessionState !== 'IDLE'}>
            😄 Tell me a Joke
          </button>
          <button className="action-btn" onClick={handleQuote} disabled={sessionState !== 'IDLE'}>
            ✨ Inspire Me
          </button>
          <button className="action-btn" onClick={handleWeather} disabled={sessionState !== 'IDLE'}>
            🌤️ Weather
          </button>
          <button className="action-btn" onClick={handleDateTime} disabled={sessionState !== 'IDLE'}>
            🕐 Time
          </button>
        </div>
      </main>
    </div>
  )
}

export default App
