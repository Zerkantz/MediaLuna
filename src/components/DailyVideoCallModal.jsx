import { useEffect, useRef, useState } from 'react'
import DailyIframe from '@daily-co/daily-js'
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Loader2,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  ShieldAlert,
  Video,
  X,
} from 'lucide-react'
import { getDailyRoom, getDailyToken } from '../services/backendService'

export function DailyVideoCallModal({ reservation, currentUser, onClose, onCallStateChange }) {
  const [callObject, setCallObject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [callStatus, setCallStatus] = useState('conectando')

  const containerRef = useRef(null)

  const ownerId = Array.isArray(reservation.duenoId) ? reservation.duenoId[0] : (reservation.duenoId || '')
  const clientId = reservation.clienteId

  // Protección: Solo el cliente o el dueño de la reservación (o admin) pueden unirse
  const isParticipant = currentUser && (
    currentUser.id === clientId ||
    currentUser.id === ownerId ||
    currentUser.rol === 'administrador'
  )

  const storedRoomName = reservation.identificadorSalaVideo
  const roomName = storedRoomName && storedRoomName !== 'pendiente' ? storedRoomName : `video-res-${reservation.id}`

  useEffect(() => {
    if (!isParticipant) {
      setLoading(false)
      setError('Acceso denegado: Solo el cliente y el dueño de esta reservación pueden ingresar a la videollamada.')
      return
    }

    let dailyCall = null
    let isMounted = true

    async function startCall() {
      try {
        setLoading(true)
        setError(null)
        setCallStatus('conectando')

        // 1. Solicitar creación/existencia de la sala en Daily mediante el backend
        await getDailyRoom(roomName, 120)

        if (!isMounted) return

        // 2. Solicitar token privado de acceso para este usuario específico
        const tokenData = await getDailyToken(
          roomName,
          currentUser.nombre || 'Usuario MediaLuna',
          currentUser.id,
          120,
        )

        if (!isMounted) return

        // 3. Crear el marco de llamada de Daily con @daily-co/daily-js
        dailyCall = DailyIframe.createFrame(containerRef.current, {
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: '0',
            borderRadius: '12px',
          },
          showLeaveButton: false,
          showFullscreenButton: true,
        })

        setCallObject(dailyCall)

        // Event listeners
        dailyCall.on('joined-meeting', () => {
          if (isMounted) {
            setLoading(false)
            setCallStatus('en_curso')
            if (onCallStateChange) onCallStateChange('en_curso')
          }
        })

        dailyCall.on('left-meeting', () => {
          if (isMounted) {
            setCallStatus('finalizada')
            if (onCallStateChange) onCallStateChange('finalizada')
            onClose()
          }
        })

        dailyCall.on('error', (e) => {
          console.error('Error de Daily:', e)
          if (isMounted) {
            setError(e.errorMsg || 'Ocurrió un error en la videollamada.')
            setLoading(false)
          }
        })

        // 4. Unirse a la sala privada usando el token generado por el backend
        await dailyCall.join({
          url: tokenData.roomUrl,
          token: tokenData.token,
        })
      } catch (err) {
        console.error('Error iniciando videollamada:', err)
        if (isMounted) {
          setError(err.message || 'No se pudo iniciar la videollamada.')
          setLoading(false)
        }
      }
    }

    startCall()

    return () => {
      isMounted = false
      if (dailyCall) {
        dailyCall.destroy().catch((err) => console.error('Error al destruir DailyCall:', err))
      }
    }
  }, [reservation.id, roomName, currentUser?.id])

  const toggleAudio = () => {
    if (!callObject) return
    const nextMuted = !isAudioMuted
    callObject.setLocalAudio(!nextMuted)
    setIsAudioMuted(nextMuted)
  }

  const toggleVideo = () => {
    if (!callObject) return
    const nextMuted = !isVideoMuted
    callObject.setLocalVideo(!nextMuted)
    setIsVideoMuted(nextMuted)
  }

  const toggleScreenShare = async () => {
    if (!callObject) return
    if (isScreenSharing) {
      callObject.stopScreenShare()
      setIsScreenSharing(false)
    } else {
      try {
        await callObject.startScreenShare()
        setIsScreenSharing(true)
      } catch (err) {
        console.error('Error compartiendo pantalla:', err)
      }
    }
  }

  const handleLeaveCall = () => {
    if (callObject) {
      callObject.leave()
    } else {
      onClose()
    }
  }

  return (
    <div className="video-modal-backdrop">
      <div className="video-modal-container">
        {/* Floating Header */}
        <div className="video-modal-header">
          <div className="video-modal-title">
            <Video size={20} />
            <span>Videollamada de Reservación</span>
            <span className={`call-badge call-badge--${callStatus}`}>
              {callStatus === 'conectando' && 'Conectando…'}
              {callStatus === 'en_curso' && 'En Vivo'}
              {callStatus === 'finalizada' && 'Finalizada'}
            </span>
          </div>
          <button type="button" className="video-close-button" onClick={handleLeaveCall} title="Cerrar">
            <X size={20} />
          </button>
        </div>

        {/* Video Area */}
        <div className="video-viewport">
          {!isParticipant ? (
            <div className="video-denied-state">
              <ShieldAlert size={48} className="text-danger" />
              <h3>Acceso Restringido</h3>
              <p>Solo el cliente y el dueño asociados a esta reservación tienen autorización para entrar a la llamada.</p>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Volver
              </button>
            </div>
          ) : error ? (
            <div className="video-error-state">
              <AlertTriangle size={48} className="text-warning" />
              <h3>No se pudo conectar</h3>
              <p>{error}</p>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          ) : (
            <>
              {loading && (
                <div className="video-loading-overlay">
                  <Loader2 className="spin" size={36} />
                  <p>Estableciendo conexión privada con Daily.co…</p>
                </div>
              )}
              <div ref={containerRef} className="daily-video-frame" />
            </>
          )}
        </div>

        {/* Custom Toolbar */}
        {isParticipant && !error && (
          <div className="video-modal-controls">
            <button
              type="button"
              className={`video-control-btn ${isAudioMuted ? 'video-control-btn--muted' : ''}`}
              onClick={toggleAudio}
              disabled={loading}
              title={isAudioMuted ? 'Activar Micrófono' : 'Silenciar Micrófono'}
            >
              {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button
              type="button"
              className={`video-control-btn ${isVideoMuted ? 'video-control-btn--muted' : ''}`}
              onClick={toggleVideo}
              disabled={loading}
              title={isVideoMuted ? 'Activar Cámara' : 'Apagar Cámara'}
            >
              {isVideoMuted ? <CameraOff size={20} /> : <Camera size={20} />}
            </button>

            <button
              type="button"
              className={`video-control-btn ${isScreenSharing ? 'video-control-btn--active' : ''}`}
              onClick={toggleScreenShare}
              disabled={loading}
              title={isScreenSharing ? 'Detener Compartir Pantalla' : 'Compartir Pantalla'}
            >
              <Monitor size={20} />
            </button>

            <button
              type="button"
              className="video-control-btn video-control-btn--hangup"
              onClick={handleLeaveCall}
              title="Colgar videollamada"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
