import { useState, useRef } from 'react'
import { sendAudio, getJoke, getQuote } from './api'
import './App.css'

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [status, setStatus] = useState("Hi, I'm Sunoji. I'm here to listen.")
  const [isLoading, setIsLoading] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        handleAudioUpload(audioBlob)
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      setStatus("Listening...")
    } catch (error) {
      console.error("Error accessing microphone:", error)
      setStatus("Error accessing microphone. Please allow permissions.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setStatus("Thinking...")
      // Stop all tracks to release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
  }

  const handleAudioUpload = async (audioBlob) => {
    setIsLoading(true)
    try {
      const audioResponseBlob = await sendAudio(audioBlob)

      setStatus("Responding...")
      const audioUrl = URL.createObjectURL(audioResponseBlob)
      const audio = new Audio(audioUrl)

      audio.onended = () => {
        setStatus("I'm listening...")
        URL.revokeObjectURL(audioUrl)
      }

      await audio.play()
    } catch (error) {
      console.error("Error processing audio:", error)
      setStatus("Sorry, I had trouble hearing you.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoke = async () => {
    setIsLoading(true)
    try {
      const joke = await getJoke()
      setStatus(joke)
    } catch (error) {
      setStatus("Couldn't think of a joke right now.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuote = async () => {
    setIsLoading(true)
    try {
      const quote = await getQuote()
      setStatus(quote)
    } catch (error) {
      setStatus("Couldn't find a quote right now.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container">
      <header>
        <h1>Sunoji.me</h1>
      </header>

      <main>
        <div className="status-display">
          <p>{status}</p>
        </div>

        <div className="mic-container">
          <button
            className={`mic-button ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="spinner"></div>
            ) : (
              isRecording ? "Stop" : "Listen"
            )}
          </button>
        </div>

        <div className="actions">
          <button onClick={handleJoke} disabled={isLoading || isRecording}>
            Tell me a Joke
          </button>
          <button onClick={handleQuote} disabled={isLoading || isRecording}>
            Inspire Me
          </button>
        </div>
      </main>
    </div>
  )
}

export default App
