import { useEffect, useRef, useState } from 'react'
import { StreamChat } from 'stream-chat'
import { AlertCircle, Loader2, MessageCircle, Send } from 'lucide-react'
import { createStreamChannel, getStreamToken } from '../services/backendService'

export function StreamChatWidget({ reservation, currentUser, counterpartName, counterpartRole }) {
  const [client, setClient] = useState(null)
  const [channel, setChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)

  const channelId = reservation.identificadorChat || `chat_res_${reservation.id}`
  const ownerId = Array.isArray(reservation.duenoId) ? reservation.duenoId[0] : (reservation.duenoId || '')
  const clientId = reservation.clienteId

  const isParticipant = currentUser && (currentUser.id === clientId || currentUser.id === ownerId || currentUser.rol === 'administrador')

  // Auto-scroll al último mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!currentUser || !isParticipant) {
      setLoading(false)
      setError('Acceso denegado: Solo el cliente o el dueño de la reservación pueden ver el chat.')
      return
    }

    let isMounted = true
    let chatClient = null

    async function initChat() {
      try {
        setLoading(true)
        setError(null)

        // 1. Solicitar token al backend en Render
        const tokenData = await getStreamToken(currentUser.id, currentUser.nombre)

        if (!isMounted) return

        // 2. Inicializar cliente Stream Chat
        chatClient = StreamChat.getInstance(tokenData.apiKey)

        // Conectar usuario si no está ya conectado
        if (chatClient.userID !== tokenData.userId) {
          await chatClient.connectUser(
            { id: tokenData.userId, name: currentUser.nombre },
            tokenData.token,
          )
        }

        if (!isMounted) return

        // 3. Crear/Obtener el canal en Stream a través del backend
        const members = [clientId, ownerId].filter(Boolean)
        await createStreamChannel(channelId, members, {
          reservationId: reservation.id,
          fecha: reservation.fecha,
        })

        if (!isMounted) return

        // 4. Suscribirse al canal en el cliente SDK
        const targetChannel = chatClient.channel('messaging', channelId)
        await targetChannel.watch()

        if (!isMounted) return

        setClient(chatClient)
        setChannel(targetChannel)
        setMessages(targetChannel.state.messages || [])

        // 5. Escuchar nuevos mensajes en tiempo real
        targetChannel.on('message.new', (event) => {
          if (isMounted) {
            setMessages((prev) => [...prev, event.message])
          }
        })
      } catch (err) {
        console.error('Error conectando a Stream Chat:', err)
        if (isMounted) {
          setError(err.message || 'No se pudo conectar al chat en vivo.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initChat()

    return () => {
      isMounted = false
      if (chatClient) {
        chatClient.disconnectUser().catch((err) => console.error('Error desconectando Stream user:', err))
      }
    }
  }, [reservation.id, currentUser?.id])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputText.trim() || !channel) return

    const text = inputText.trim()
    setInputText('')

    try {
      await channel.sendMessage({ text })
    } catch (err) {
      console.error('Error al enviar mensaje:', err)
      setError('No se pudo enviar el mensaje.')
    }
  }

  if (!isParticipant) {
    return (
      <div className="stream-chat-empty">
        <AlertCircle size={24} className="text-warning" />
        <p>No tienes permisos para ver esta conversación.</p>
      </div>
    )
  }

  return (
    <div className="stream-chat-container">
      <div className="chat-card__head">
        <span className="avatar">
          {counterpartName ? counterpartName.split(' ').map((p) => p[0]).join('').slice(0, 2) : 'ML'}
        </span>
        <div>
          <strong>{counterpartName || 'MediaLuna Chat'}</strong>
          <small>{counterpartRole || 'Participante'} · En vivo</small>
        </div>
        <span className="chat-status-dot" title="Conectado vía Stream Chat" />
      </div>

      <div className="chat-body">
        {loading ? (
          <div className="chat-loading">
            <Loader2 className="spin" size={24} />
            <span>Conectando chat en tiempo real…</span>
          </div>
        ) : error ? (
          <div className="chat-error-state">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty-messages">
            <MessageCircle size={28} />
            <p>Aún no hay mensajes. ¡Envía un saludo para iniciar la conversación!</p>
          </div>
        ) : (
          <div className="chat-messages-list">
            {messages.map((msg) => {
              const isMe = msg.user?.id === currentUser?.id?.replace(/[^a-zA-Z0-9@_-]/g, '_')
              return (
                <div
                  key={msg.id || Math.random()}
                  className={`chat-bubble ${isMe ? 'chat-bubble--me' : 'chat-bubble--owner'}`}
                >
                  <div className="chat-bubble__text">{msg.text}</div>
                  <div className="chat-bubble__time">
                    {msg.created_at
                      ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Escribe un mensaje…"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={loading || !channel}
        />
        <button type="submit" disabled={loading || !channel || !inputText.trim()} className="chat-send-button">
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
