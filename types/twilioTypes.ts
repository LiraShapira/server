export interface StartVerifyRequest {
  phoneNumber: string;
}

export interface CheckVerifyRequest {
  phoneNumber: string;
  code: string;
}



export type TwilioStartVerifyResponse = {
  success: true,
} | {
  success: false
  error?: string
}

export interface TwilioCheckVerifyResponse {
  success: boolean,
  message: string
}
