import { useState, useRef, useEffect, useCallback } from 'react'
import { sendAudio, getJoke, getQuote, getPersonas, createPersona, updatePersona, deletePersona, base64ToAudioBlob, getWeather, getDateTime } from './api'
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

  // Persona state
  const [personas, setPersonas] = useState([])
  const [selectedPersonaId, setSelectedPersonaId] = useState(null)
  const [showPersonaModal, setShowPersonaModal] = useState(false)
  const [newPersonaName, setNewPersonaName] = useState('')
  const [newPersonaPrompt, setNewPersonaPrompt] = useState('')

  // Edit persona state
  const [editingPersonaId, setEditingPersonaId] = useState(null)
  const [editPersonaName, setEditPersonaName] = useState('')
  const [editPersonaPrompt, setEditPersonaPrompt] = useState('')

  // Analysis state
  const [lastAnalysis, setLastAnalysis] = useState(null)

  // Chat history state
  const [chatHistory, setChatHistory] = useState([])

  // User location state
  const [userLocation, setUserLocation] = useState({ latitude: null, longitude: null })
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false)

  // Load personas on mount
  useEffect(() => {
    loadPersonas()
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

  // Load personas from API
  const loadPersonas = async () => {
    try {
      const data = await getPersonas()
      setPersonas(data)
      // Select default persona if none selected
      if (!selectedPersonaId && data.length > 0) {
        const defaultPersona = data.find(p => p.is_default) || data[0]
        setSelectedPersonaId(defaultPersona.id)
      }
    } catch (error) {
      console.error('Failed to load personas:', error)
    }
  }


  // Ref to track current session state (avoids stale closure in callbacks)
  const sessionStateRef = useRef(sessionState)
  useEffect(() => {
    sessionStateRef.current = sessionState
  }, [sessionState])

  // Callback when speech starts (VAD detects voice)
  const handleSpeechStart = useCallback(() => {
    console.log('Speech detected, state:', sessionStateRef.current, 'processing:', isProcessingRef.current)
    if (sessionStateRef.current === SESSION_STATE.LISTENING && !isProcessingRef.current) {
      console.log('Starting recording...')
      audioChunksRef.current = []
      setStatus('🎤 Listening... Speak now')

      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
        mediaRecorderRef.current.start()
        console.log('MediaRecorder started')
      }
    }
  }, [])

  // Callback when speech ends (2 seconds of silence detected)
  const handleSpeechEnd = useCallback(() => {
    console.log('Silence detected, state:', sessionStateRef.current, 'processing:', isProcessingRef.current)
    if (sessionStateRef.current === SESSION_STATE.LISTENING && !isProcessingRef.current) {
      console.log('Processing speech after silence...')
      isProcessingRef.current = true

      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
        console.log('MediaRecorder stopped')
      }
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
    console.log('Resuming continuous listening...')
    isProcessingRef.current = false
    resetSpeechState()
    setSessionState(SESSION_STATE.LISTENING)
    setStatus("🎙️ Ready for your next question... Speak anytime.")
  }

  // Process audio and get AI response
  const processAudio = async (audioBlob) => {
    // Validate audio blob
    if (!audioBlob || audioBlob.size === 0) {
      console.error('Invalid audio blob - size is 0')
      setStatus("Recording failed. Please try again.")
      resumeListening()
      return
    }

    console.log(`Processing audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`)
    
    setSessionState(SESSION_STATE.PROCESSING)
    setStatus("🤔 Processing...")

    try {
      const isFirstMessage = turnCountRef.current === 0
      turnCountRef.current += 1

      const response = await sendAudio(
        audioBlob,
        selectedPersonaId,
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

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          resumeListening()
        }

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl)
          resumeListening()
        }

        await audio.play()
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
                position.coords.longitude,
                selectedPersonaId
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
                const weatherData = await getWeather(location, null, null, selectedPersonaId)
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
          const weatherData = await getWeather(location, null, null, selectedPersonaId)
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
      const dateTimeData = await getDateTime('Asia/Kolkata', selectedPersonaId)
      setStatus(dateTimeData.formatted_response)
    } catch (error) {
      setStatus("Couldn't get the time right now.")
    }
  }

  const handleCreatePersona = async () => {
    if (!newPersonaName.trim() || !newPersonaPrompt.trim()) return

    try {
      await createPersona({
        name: newPersonaName,
        base_prompt: newPersonaPrompt
      })
      setNewPersonaName('')
      setNewPersonaPrompt('')
      setShowPersonaModal(false)
      loadPersonas()
    } catch (error) {
      console.error('Failed to create persona:', error)
    }
  }

  const handleDeletePersona = async (id) => {
    try {
      await deletePersona(id)
      loadPersonas()
    } catch (error) {
      console.error('Failed to delete persona:', error)
    }
  }

  const handleEditPersona = (persona) => {
    setEditingPersonaId(persona.id)
    setEditPersonaName(persona.name)
    setEditPersonaPrompt(persona.base_prompt)
  }

  const handleUpdatePersona = async (id) => {
    if (!editPersonaName.trim() || !editPersonaPrompt.trim()) return

    try {
      await updatePersona(id, {
        name: editPersonaName,
        base_prompt: editPersonaPrompt
      })
      setEditingPersonaId(null)
      setEditPersonaName('')
      setEditPersonaPrompt('')
      loadPersonas()
    } catch (error) {
      console.error('Failed to update persona:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingPersonaId(null)
    setEditPersonaName('')
    setEditPersonaPrompt('')
  }

  const selectedPersona = personas.find(p => p.id === selectedPersonaId)

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
          Voice Companion
        </h1>
        <button
          className="persona-btn"
          onClick={() => setShowPersonaModal(true)}
        >
          ⚙️ Personas
        </button>
      </header>

      <main className="main-content">
        {/* Persona Selector */}
        <div className="persona-selector">
          <div className="persona-chips">
            {personas.map(persona => (
              <button
                key={persona.id}
                className={`persona-chip ${selectedPersonaId === persona.id ? 'active' : ''}`}
                onClick={() => setSelectedPersonaId(persona.id)}
              >
                {persona.name}
              </button>
            ))}
          </div>
        </div>

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

      {/* Persona Modal */}
      {showPersonaModal && (
        <div className="modal-overlay" onClick={() => setShowPersonaModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Manage Personas</h2>
              <button className="close-btn" onClick={() => setShowPersonaModal(false)}>×</button>
            </div>

            <div className="modal-body">
              {/* Existing Personas */}
              <div className="persona-list">
                {personas.map(persona => (
                  <div key={persona.id} className="persona-item">
                    {editingPersonaId === persona.id ? (
                      // Edit mode
                      <div className="persona-edit-form">
                        <input
                          type="text"
                          className="persona-input"
                          value={editPersonaName}
                          onChange={(e) => setEditPersonaName(e.target.value)}
                          placeholder="Persona name"
                        />
                        <textarea
                          className="persona-textarea"
                          value={editPersonaPrompt}
                          onChange={(e) => setEditPersonaPrompt(e.target.value)}
                          placeholder="Base prompt"
                          rows={3}
                        />
                        <div className="edit-actions">
                          <button
                            className="save-btn"
                            onClick={() => handleUpdatePersona(persona.id)}
                          >
                            ✓ Save
                          </button>
                          <button
                            className="cancel-btn"
                            onClick={handleCancelEdit}
                          >
                            ✕ Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="persona-info">
                          <span className="persona-name">
                            {persona.is_default && '★ '}
                            {persona.name}
                          </span>
                          <span className="persona-preview">
                            {persona.base_prompt.substring(0, 60)}...
                          </span>
                        </div>
                        <div className="persona-actions">
                          <button
                            className="edit-btn"
                            onClick={() => handleEditPersona(persona)}
                          >
                            ✏️
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => handleDeletePersona(persona.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Create New Persona */}
              <div className="create-persona">
                <h3>Create New Persona</h3>
                <input
                  type="text"
                  placeholder="Persona name (e.g., 'Calm Advisor')"
                  value={newPersonaName}
                  onChange={(e) => setNewPersonaName(e.target.value)}
                  className="persona-input"
                />
                <textarea
                  placeholder="Base prompt - describe the personality, tone, and how this persona should respond..."
                  value={newPersonaPrompt}
                  onChange={(e) => setNewPersonaPrompt(e.target.value)}
                  className="persona-textarea"
                  rows={4}
                />
                <button
                  className="create-btn"
                  onClick={handleCreatePersona}
                  disabled={!newPersonaName.trim() || !newPersonaPrompt.trim()}
                >
                  Create Persona
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
