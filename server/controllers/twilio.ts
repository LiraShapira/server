import { Request, Response } from "express";
import { CheckVerifyRequest, TwilioCheckVerifyResponse, StartVerifyRequest, TwilioStartVerifyResponse } from "../../types/twilioTypes";

type RequestBody<T> = Request<{}, {}, T>;

export const startVerify = async (req: RequestBody<StartVerifyRequest>, res: Response) => {
  const data = JSON.stringify({
    to: req.body.phoneNumber,
    channel: "sms",
  });

  try {
    const response = await fetch(`${process.env.TWILIO_URL}/start-verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data
    });

    // Read response body as text first (can only be read once)
    const responseText = await response.text();

    // Check if response is OK before parsing JSON
    if (!response.ok) {
      let errorMessage = `Twilio API error: ${response.status} ${response.statusText}`;
      try {
        // Try to parse as JSON to get structured error
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        // If not JSON, use the raw text
        errorMessage = responseText || errorMessage;
      }
      return res.status(400).json({ 
        success: false, 
        error: errorMessage 
      });
    }

    // Parse the successful response as JSON
    const json: TwilioStartVerifyResponse = JSON.parse(responseText);
    res.status(200).json(json);
  } catch (e: any) {
    console.error('Error in startVerify:', e);
    res.status(500).json({ 
      success: false, 
      error: e.message || 'Failed to send verification code' 
    });
  }
}

export const checkVerify = async (req: RequestBody<CheckVerifyRequest>, res: Response) => {
  try {
    const data = JSON.stringify({
      to: req.body.phoneNumber,
      code: req.body.code
    });

    const response = await fetch(`${process.env.TWILIO_URL}/check-verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: data,
    });

    // Read response body as text first (can only be read once)
    const responseText = await response.text();

    // Check if response is OK before parsing JSON
    if (!response.ok) {
      let errorMessage = `Twilio API error: ${response.status} ${response.statusText}`;
      try {
        // Try to parse as JSON to get structured error
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        // If not JSON, use the raw text
        errorMessage = responseText || errorMessage;
      }
      return res.status(400).json({ 
        success: false, 
        error: errorMessage 
      });
    }

    // Parse the successful response as JSON
    const json: TwilioCheckVerifyResponse = JSON.parse(responseText);
    res.status(200).json(json);
  } catch (e: any) {
    console.error('Error in checkVerify:', e);
    res.status(500).json({ 
      success: false, 
      error: e.message || 'Failed to verify code' 
    });
  }
}
