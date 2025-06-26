export interface IWebSocketMessage {
  type: string; // The type of message (e.g., "listen", "publish", "getVal", etc.)
  response?: boolean; // Indicates if this is a response to a request
  requestId?: string; // Optional request ID for tracking responses
  message?: string; // Optional message for responses
  status?: string; // Optional status message
  error?: string; // Optional error message
  payload?: any; // The payload of the message
  [extra: string]: any; // Allow extra fields
}
