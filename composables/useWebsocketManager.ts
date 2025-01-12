import { useWebSocket } from '@vueuse/core'

export const useWebsocketManager = (url: string) => {
  const { status, data, send, open, close } = useWebSocket(url)

  const handleMessage = (cb: (newValue: string) => void) => {
    watch(data, newValue => {
      try {
        cb(newValue)
      } catch (error) {
        console.error('Failed to parse message:', error)
      }
    })
  }

  return {
    status,
    data,
    send,
    open,
    close,
    handleMessage
  }
}
